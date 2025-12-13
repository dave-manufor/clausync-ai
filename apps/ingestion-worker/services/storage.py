import logging
from google.cloud import storage
import config

logger = logging.getLogger(__name__)
storage_client = storage.Client()

def upload_to_gcs(resource_id: str, content_hash: str, content: str) -> str | None:
    """Upload raw HTML to GCS."""
    try:
        bucket = storage_client.bucket(config.settings.GCS_BUCKET_NAME)
        # Structure: year/month/day/resource_id_hash.html
        blob_name = f"{resource_id}_{content_hash}.html"
        blob = bucket.blob(blob_name)
        blob.upload_from_string(content, content_type="text/html")
        logger.info(f"Uploaded snapshot", extra={"gcs_uri": f"gs://{config.settings.GCS_BUCKET_NAME}/{blob_name}"})
        return f"gs://{config.settings.GCS_BUCKET_NAME}/{blob_name}"
    except Exception as e:
        logger.error(f"GCS Upload Failed: {e}")
        return None
