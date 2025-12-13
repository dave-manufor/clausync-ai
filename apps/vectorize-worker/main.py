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


def callback(message):
    """Process document vectorization requests with retry support."""
    try:
        logger.info("Received message", extra={
            "message_id": message.message_id,
            "data": message.data.decode("utf-8")
        })
        data = json.loads(message.data.decode("utf-8"))
        
        success = process_vectorize_request(data)
        
        if success:
            message.ack()
            logger.info("Message processed successfully", extra={"message_id": message.message_id})
        else:
            message.nack()
            logger.warning("Message processing failed, will be retried", 
                          extra={"message_id": message.message_id})

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in message: {e}")
        message.ack()  # Bad format, retry won't help
    except Exception as e:
        logger.exception("Unexpected error processing message")
        message.nack()  # Unknown error, might be temporary

def main():
    logger.info(f"Vectorize Worker Starting...", extra={"subscription": subscription_path})
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)
    
    # Graceful Shutdown
    def shutdown_handler(signum, frame):
        logger.info("Received termination signal. Shutting down...")
        streaming_pull_future.cancel()
        
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    with subscriber:
        try:
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()
            streaming_pull_future.result()
        except Exception as e:
            pass

if __name__ == "__main__":
    main()
