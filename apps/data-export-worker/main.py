"""
Data Export Worker - GDPR Art. 20 Compliant

This worker processes pending DataExport requests by:
1. Gathering all user data
2. Creating a JSON archive
3. Uploading to GCS
4. Notifying user via Pub/Sub -> notification-worker
"""

import logging
import time
import signal
import json
import zipfile
import io
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
from google.cloud import storage, pubsub_v1

import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='{"asctime": "%(asctime)s", "levelname": "%(levelname)s", "message": "%(message)s", "name": "%(name)s"}'
)
logger = logging.getLogger(__name__)

# Graceful shutdown
shutdown_requested = False

def handle_signal(signum, frame):
    global shutdown_requested
    logger.info("Received termination signal. Will exit after current task.")
    shutdown_requested = True

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(config.settings.DATABASE_URL, cursor_factory=RealDictCursor)


def get_storage_client():
    """Get GCS storage client (with emulator support)."""
    if config.settings.STORAGE_EMULATOR_HOST:
        from google.cloud.storage import Client
        from google.auth.credentials import AnonymousCredentials
        return Client(
            credentials=AnonymousCredentials(),
            project=config.settings.GCP_PROJECT_ID,
        )
    return storage.Client(project=config.settings.GCP_PROJECT_ID)


def get_publisher():
    """Get Pub/Sub publisher client."""
    return pubsub_v1.PublisherClient()


def gather_user_data(conn, user_id: str) -> dict:
    """
    Gather all user data for GDPR Art. 15/20 compliance.
    Returns a dictionary with all user-related data.
    """
    with conn.cursor() as cur:
        # User profile
        cur.execute("""
            SELECT id, email, name, role, organization_id, created_at, updated_at
            FROM users WHERE id = %s
        """, (user_id,))
        user = cur.fetchone()
        
        # Subscriptions
        cur.execute("""
            SELECT s.id, s.display_name, s.personalization_enabled, 
                   s.paused_at, s.created_at,
                   mr.url_normalized, mr.selector
            FROM subscriptions s
            JOIN monitored_resources mr ON s.resource_id = mr.id
            WHERE s.user_id = %s AND s.deleted_at IS NULL
        """, (user_id,))
        subscriptions = cur.fetchall()
        
        # Notifications
        cur.execute("""
            SELECT id, personalized_summary, risk_level, is_read, sent_at, created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1000
        """, (user_id,))
        notifications = cur.fetchall()
        
        # API Keys (metadata only, no secrets)
        cur.execute("""
            SELECT id, name, scopes, last_used_at, expires_at, created_at
            FROM api_keys
            WHERE user_id = %s AND revoked_at IS NULL
        """, (user_id,))
        api_keys = cur.fetchall()
        
        # Notification preferences
        cur.execute("""
            SELECT email_enabled, digest_frequency, risk_threshold, created_at
            FROM notification_preferences
            WHERE user_id = %s
        """, (user_id,))
        preferences = cur.fetchone()
        
        # Change events for user's resources
        cur.execute("""
            SELECT ce.id, ce.global_ai_summary, ce.global_risk_score, 
                   ce.risk_keywords, ce.created_at, mr.url_normalized
            FROM change_events ce
            JOIN monitored_resources mr ON ce.resource_id = mr.id
            JOIN subscriptions s ON s.resource_id = mr.id
            WHERE s.user_id = %s AND s.deleted_at IS NULL
            ORDER BY ce.created_at DESC
            LIMIT 5000
        """, (user_id,))
        change_events = cur.fetchall()
        
        # Audit logs (user's own actions)
        cur.execute("""
            SELECT action, entity_type, entity_id, details, created_at
            FROM audit_logs
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1000
        """, (user_id,))
        audit_logs = cur.fetchall()
    
    # Convert to serializable format
    def serialize(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, dict):
            return {k: serialize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [serialize(i) for i in obj]
        return obj
    
    return {
        "export_generated_at": datetime.utcnow().isoformat(),
        "gdpr_compliance": "Art. 15 (Access) and Art. 20 (Portability)",
        "user": serialize(dict(user)) if user else None,
        "subscriptions": [serialize(dict(s)) for s in subscriptions],
        "notifications": [serialize(dict(n)) for n in notifications],
        "api_keys": [serialize(dict(k)) for k in api_keys],
        "preferences": serialize(dict(preferences)) if preferences else None,
        "change_events": [serialize(dict(e)) for e in change_events],
        "audit_logs": [serialize(dict(a)) for a in audit_logs],
    }


def create_export_archive(data: dict) -> bytes:
    """Create a ZIP archive containing the user's data as JSON."""
    buffer = io.BytesIO()
    
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Main data file
        zf.writestr('user_data.json', json.dumps(data, indent=2))
        
        # README
        readme = """# Clausync Data Export

This archive contains all your data from Clausync as required by GDPR Articles 15 and 20.

## Contents

- `user_data.json` - All your data in machine-readable JSON format

## Data Categories

- **user**: Your profile information
- **subscriptions**: Your monitored URLs
- **notifications**: Alert history
- **api_keys**: API key metadata (secrets not included)
- **preferences**: Your notification settings
- **change_events**: Changes detected on your monitored URLs
- **audit_logs**: Your activity history

## Questions?

Contact support@clausync.ai for any questions about your data.

Generated: {timestamp}
""".format(timestamp=data['export_generated_at'])
        zf.writestr('README.md', readme)
    
    buffer.seek(0)
    return buffer.read()


def upload_to_gcs(storage_client, data: bytes, user_id: str, export_id: str) -> str:
    """Upload export archive to GCS and return the URI."""
    bucket = storage_client.bucket(config.settings.GCS_BUCKET_NAME)
    
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    blob_name = f"exports/{user_id}/{export_id}_{timestamp}.zip"
    
    blob = bucket.blob(blob_name)
    blob.upload_from_string(data, content_type='application/zip')
    
    gcs_uri = f"gs://{config.settings.GCS_BUCKET_NAME}/{blob_name}"
    logger.info(f"Uploaded export to {gcs_uri}")
    
    return gcs_uri


def send_notification(publisher, user_email: str, export_id: str):
    """Publish notification for email delivery."""
    topic_path = publisher.topic_path(
        config.settings.GCP_PROJECT_ID,
        config.settings.PUBSUB_TOPIC_NOTIFICATION
    )
    
    message = {
        "notification_id": export_id,  # Using export_id as notification reference
        "email": user_email,
        "subject": "Your Clausync Data Export is Ready",
        "summary": "Your data export has been completed and is ready for download. Log in to your account to download your data.",
        "change_event_id": None,  # Not a change event notification
    }
    
    try:
        future = publisher.publish(topic_path, json.dumps(message).encode('utf-8'))
        future.result(timeout=30)
        logger.info(f"Published notification for export {export_id}")
    except Exception as e:
        logger.error(f"Failed to publish notification: {e}")


def process_pending_exports():
    """Process all pending DataExport records."""
    conn = get_db_connection()
    storage_client = get_storage_client()
    publisher = get_publisher()
    
    try:
        with conn.cursor() as cur:
            # Find pending exports
            cur.execute("""
                SELECT de.id, de.user_id, u.email
                FROM data_exports de
                JOIN users u ON de.user_id = u.id
                WHERE de.status = 'pending'
                ORDER BY de.created_at ASC
                LIMIT 10
            """)
            exports = cur.fetchall()
        
        for export in exports:
            try:
                export_id = export['id']
                user_id = export['user_id']
                user_email = export['email']
                
                logger.info(f"Processing export {export_id} for user {user_id}")
                
                # Mark as processing
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE data_exports SET status = 'processing'
                        WHERE id = %s
                    """, (export_id,))
                    conn.commit()
                
                # Gather data
                data = gather_user_data(conn, user_id)
                
                # Create archive
                archive = create_export_archive(data)
                
                # Upload to GCS
                gcs_uri = upload_to_gcs(storage_client, archive, user_id, export_id)
                
                # Update record
                expires_at = datetime.utcnow() + timedelta(days=config.settings.EXPORT_EXPIRY_DAYS)
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE data_exports 
                        SET status = 'ready', file_url = %s, expires_at = %s
                        WHERE id = %s
                    """, (gcs_uri, expires_at, export_id))
                    
                    # Audit log
                    cur.execute("""
                        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
                        VALUES (
                            gen_random_uuid(), %s, 'EXPORT_READY', 'data_export', %s,
                            jsonb_build_object('file_url', %s, 'expires_at', %s::text),
                            NOW()
                        )
                    """, (user_id, export_id, gcs_uri, expires_at.isoformat()))
                    conn.commit()
                
                # Send notification
                send_notification(publisher, user_email, export_id)
                
                logger.info(f"Completed export {export_id}")
                
            except Exception as e:
                logger.error(f"Error processing export {export['id']}: {e}")
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE data_exports 
                        SET status = 'pending'
                        WHERE id = %s
                    """, (export['id'],))
                    conn.commit()
    
    finally:
        conn.close()


def main():
    """Main entry point - polls for pending exports."""
    logger.info(f"Data Export Worker started. Poll interval: {config.settings.RUN_INTERVAL_SECONDS}s")
    
    while not shutdown_requested:
        try:
            process_pending_exports()
        except Exception as e:
            logger.error(f"Export processing failed: {e}")
        
        # Sleep with shutdown check
        for _ in range(config.settings.RUN_INTERVAL_SECONDS):
            if shutdown_requested:
                break
            time.sleep(1)
    
    logger.info("Data Export Worker shutdown complete")


if __name__ == "__main__":
    main()
