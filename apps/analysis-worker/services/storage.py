import logging
from google.cloud import storage

logger = logging.getLogger(__name__)
storage_client = storage.Client()

def get_snapshot_text(gcs_uri):
    """Download text content from GCS."""
    try:
        bucket_name = gcs_uri.split("/")[2]
        blob_name = "/".join(gcs_uri.split("/")[3:])
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.download_as_text()
    except Exception as e:
        logger.error(f"GCS Download Failed: {e}")
        return None
