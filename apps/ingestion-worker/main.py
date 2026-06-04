import json
import hashlib
import time
import logging
import signal
import sys
from concurrent.futures import TimeoutError
from pythonjsonlogger import jsonlogger
from google.cloud import pubsub_v1
import config
from services.locking import get_lock, release_lock
from services.scraper import fetch_content
from services.storage import upload_to_gcs
from services.database import update_resource_hash, create_snapshot, get_resource_current_hash

# Setup Structured Logging
logger = logging.getLogger()
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(message)s %(name)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

# Initialize Publishers/Subscribers
publisher = pubsub_v1.PublisherClient()
subscriber = pubsub_v1.SubscriberClient()
topic_path = publisher.topic_path(config.settings.GCP_PROJECT_ID, config.settings.PUBSUB_TOPIC_ID)
subscription_path = subscriber.subscription_path(config.settings.GCP_PROJECT_ID, config.settings.PUBSUB_SUBSCRIPTION_ID)


def process_scrape_request(data: dict) -> bool:
    """
    Process a scrape request.
    Returns True on success, False if should be retried.
    """
    url = data.get("url")
    resource_id = data.get("resource_id")
    selector = data.get("selector", "body")

    if not url or not resource_id:
        logger.error("Missing URL or Resource ID - will not retry (bad message format)")
        return True  # Ack - bad message format, retry won't help

    url_hash = hashlib.sha256(url.encode()).hexdigest()

    # 1. Check Lock
    if not get_lock(url_hash):
        logger.info(f"Skipping {url} - Locked by another worker")
        return True  # Ack - another worker is handling this URL

    try:
        # 2. Get current hash from DB
        last_known_hash = get_resource_current_hash(resource_id)

        # 3. Fetch content (returns both HTML and Markdown)
        html_content, markdown_content = fetch_content(url, selector)
        if not html_content:
            logger.error("Failed to fetch content", extra={"url": url})
            return False  # Nack - might be temporary network/site issue, retry

        # 4. Hash the markdown content (for semantic comparison)
        current_hash = hashlib.sha256(markdown_content.encode()).hexdigest()

        # 5. Compare
        if current_hash != last_known_hash:
            logger.info("Change detected", extra={"url": url, "new_hash": current_hash[:16]})
            
            # 6. Upload Evidence (store HTML for legal compliance, markdown for analysis)
            gcs_uri = upload_to_gcs(resource_id, current_hash, html_content)
            
            if not gcs_uri:
                logger.error("Failed to upload to GCS", extra={"url": url})
                return False  # Nack - GCS might be temporarily unavailable

            # 7. Create snapshot in DB
            snapshot_id = create_snapshot(resource_id, gcs_uri, current_hash)
            
            if not snapshot_id:
                logger.error("Failed to create snapshot in DB", extra={"url": url})
                return False  # Nack - DB might be temporarily unavailable
            
            # 8. Update resource hash
            if not update_resource_hash(resource_id, current_hash):
                logger.error("Failed to update resource hash", extra={"url": url})
                return False  # Nack - DB issue
            
            # 9. Publish Event with markdown for analysis
            event_data = {
                "resource_id": resource_id,
                "snapshot_id": snapshot_id,
                "old_hash": last_known_hash,
                "new_hash": current_hash,
                "gcs_uri": gcs_uri,
                "markdown_content": markdown_content,
                "timestamp": time.time()
            }
            publisher.publish(topic_path, json.dumps(event_data).encode("utf-8"))
            logger.info("Published change event", extra={"resource_id": resource_id})
        else:
            logger.info("No change detected", extra={"url": url})
            # Still update last_scraped_at
            update_resource_hash(resource_id, current_hash)

        return True  # Success
        
    finally:
        # Always release lock
        release_lock(url_hash)


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
            success = process_scrape_request(data)
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
