import json
import logging
import signal
from concurrent.futures import TimeoutError
from pythonjsonlogger import jsonlogger
from google.cloud import pubsub_v1
import config
from services.parser import extract_text, chunk_text
from services.embeddings import generate_embeddings
from services.database import store_embeddings, delete_user_embeddings

# Setup Structured Logging
logger = logging.getLogger()
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(message)s %(name)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

# Initialize Pub/Sub
subscriber = pubsub_v1.SubscriberClient()
subscription_path = subscriber.subscription_path(config.settings.GCP_PROJECT_ID, config.settings.PUBSUB_SUBSCRIPTION_ID)


def process_vectorize_request(data: dict) -> bool:
    """
    Process document vectorization request.
    Returns True on success, False if should be retried.
    """
    user_id = data.get("user_id")
    gcs_uri = data.get("gcs_uri")
    filename = data.get("filename")
    file_type = data.get("file_type", "pdf")
    action = data.get("action", "create")  # "create" or "delete"

    if not user_id:
        logger.error("Missing user_id - will not retry (bad message format)")
        return True  # Ack - bad format

    # Handle delete action
    if action == "delete":
        try:
            deleted = delete_user_embeddings(user_id, filename)
            logger.info(f"Deleted {deleted} embeddings", extra={"user_id": user_id})
            return True  # Success
        except Exception as e:
            logger.error(f"Failed to delete embeddings: {e}")
            return False  # Nack - DB might be temporarily unavailable

    if not gcs_uri or not filename:
        logger.error("Missing gcs_uri or filename - will not retry (bad message format)")
        return True  # Ack - bad format

    # 1. Extract text from document
    logger.info(f"Extracting text from {filename}", extra={"file_type": file_type})
    try:
        text = extract_text(gcs_uri, file_type)
    except Exception as e:
        logger.error(f"Failed to extract text: {e}")
        return False  # Nack - might be temporary GCS issue
    
    if not text:
        logger.error("Failed to extract text from document - empty result")
        return False  # Nack - might be temporary issue
    
    logger.info(f"Extracted {len(text)} characters")

    # 2. Chunk the text
    try:
        chunks = chunk_text(text)
        logger.info(f"Created {len(chunks)} chunks")
    except Exception as e:
        logger.error(f"Failed to chunk text: {e}")
        return True  # Ack - parsing issue won't fix on retry

    # 3. Generate embeddings
    try:
        embeddings = generate_embeddings(chunks)
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        return False  # Nack - embedding service might be temporarily unavailable
    
    if not embeddings or len(embeddings) != len(chunks):
        logger.error("Embedding count mismatch or empty embeddings")
        return False  # Nack - might be temporary service issue

    # 4. Store in database
    try:
        stored = store_embeddings(user_id, filename, chunks, embeddings)
        logger.info(f"Stored {stored} embeddings for document {filename}")
        return True  # Success
    except Exception as e:
        logger.error(f"Failed to store embeddings: {e}")
        return False  # Nack - DB might be temporarily unavailable


import os
import base64
from flask import Flask, request

app = Flask(__name__)

@app.route("/", methods=["POST"])
def pubsub_push():
    envelope = request.get_json()
    if not envelope:
        msg = "no Pub/Sub message received"
        logger.error(f"error: {msg}")
        return f"Bad Request: {msg}", 400

    if not isinstance(envelope, dict) or "message" not in envelope:
        msg = "invalid Pub/Sub message format"
        logger.error(f"error: {msg}")
        return f"Bad Request: {msg}", 400

    pubsub_message = envelope["message"]
    
    if isinstance(pubsub_message, dict) and "data" in pubsub_message:
        try:
            data = json.loads(base64.b64decode(pubsub_message["data"]).decode("utf-8"))
            logger.info("Received message", extra={"data": data})
            success = process_vectorize_request(data)
            if success:
                return ("", 204)
            else:
                return ("Internal Server Error", 500)  # Nacks the message to trigger retry
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message: {e}")
            return ("", 204)  # Ack bad format so it doesn't loop forever
        except Exception as e:
            logger.exception("Unexpected error processing message")
            return ("Internal Server Error", 500)
    
    return ("Bad Request: no data in message", 400)

@app.route("/health", methods=["GET"])
def health_check():
    return ("OK", 200)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
