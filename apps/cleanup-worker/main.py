"""
Cleanup Worker - GDPR/SOC2 Compliant Data Retention

This worker runs on a schedule to:
1. Hard delete soft-deleted records past retention period
2. Clean up GCS snapshots for deleted resources
3. Maintain audit trail of all deletions
"""

import logging
import time
import signal
import sys
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
from google.cloud import storage

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
    logger.info("Received termination signal. Will exit after current batch.")
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


def cleanup_subscriptions(conn, retention_date: datetime) -> int:
    """Hard delete subscriptions that have been soft-deleted past retention period."""
    with conn.cursor() as cur:
        # First, get count for logging
        cur.execute("""
            SELECT COUNT(*) as count FROM subscriptions 
            WHERE deleted_at IS NOT NULL AND deleted_at < %s
        """, (retention_date,))
        count = cur.fetchone()['count']
        
        if count > 0:
            # Log to audit before deletion
            cur.execute("""
                INSERT INTO audit_logs (id, action, entity_type, details, created_at)
                SELECT 
                    gen_random_uuid(),
                    'HARD_DELETE',
                    'subscription',
                    jsonb_build_object(
                        'subscription_id', s.id,
                        'deleted_at', s.deleted_at,
                        'hard_deleted_at', NOW(),
                        'reason', 'retention_period_expired'
                    ),
                    NOW()
                FROM subscriptions s
                WHERE s.deleted_at IS NOT NULL AND s.deleted_at < %s
            """, (retention_date,))
            
            # Perform hard delete
            cur.execute("""
                DELETE FROM subscriptions 
                WHERE deleted_at IS NOT NULL AND deleted_at < %s
            """, (retention_date,))
            
        conn.commit()
        return count


def cleanup_resources(conn, retention_date: datetime) -> int:
    """Hard delete resources with no active subscriptions past retention period."""
    with conn.cursor() as cur:
        # Get resources to delete (no active subscriptions)
        cur.execute("""
            SELECT mr.id, mr.url_normalized 
            FROM monitored_resources mr
            WHERE mr.deleted_at IS NOT NULL 
              AND mr.deleted_at < %s
              AND NOT EXISTS (
                  SELECT 1 FROM subscriptions s 
                  WHERE s.resource_id = mr.id AND s.deleted_at IS NULL
              )
        """, (retention_date,))
        resources_to_delete = cur.fetchall()
        
        for resource in resources_to_delete:
            # Log to audit
            cur.execute("""
                INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at)
                VALUES (
                    gen_random_uuid(),
                    'HARD_DELETE',
                    'monitored_resource',
                    %s,
                    jsonb_build_object(
                        'url', %s,
                        'hard_deleted_at', NOW()::text,
                        'reason', 'retention_period_expired'
                    ),
                    NOW()
                )
            """, (resource['id'], resource['url_normalized']))
            
            # Delete the resource (cascades to snapshots via FK)
            cur.execute("DELETE FROM monitored_resources WHERE id = %s", (resource['id'],))
        
        conn.commit()
        return len(resources_to_delete)


def cleanup_gcs_snapshots(conn, storage_client, retention_date: datetime) -> int:
    """Delete GCS objects for soft-deleted snapshots past retention period."""
    deleted_count = 0
    bucket = storage_client.bucket(config.settings.GCS_BUCKET_NAME)
    
    with conn.cursor() as cur:
        # Get snapshots to clean up
        cur.execute("""
            SELECT rs.id, rs.gcs_uri
            FROM resource_snapshots rs
            WHERE rs.deleted_at IS NOT NULL AND rs.deleted_at < %s
        """, (retention_date,))
        snapshots = cur.fetchall()
        
        for snapshot in snapshots:
            try:
                # Parse GCS path
                gcs_uri = snapshot['gcs_uri']
                if gcs_uri.startswith('gs://'):
                    blob_path = gcs_uri.split('/', 3)[-1]  # Remove gs://bucket/
                else:
                    blob_path = gcs_uri
                
                # Delete from GCS
                blob = bucket.blob(blob_path)
                if blob.exists():
                    blob.delete()
                    logger.info(f"Deleted GCS object: {blob_path}")
                
                # Log to audit
                cur.execute("""
                    INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at)
                    VALUES (
                        gen_random_uuid(),
                        'HARD_DELETE',
                        'resource_snapshot',
                        %s,
                        jsonb_build_object(
                            'gcs_uri', %s,
                            'hard_deleted_at', NOW()::text,
                            'reason', 'retention_period_expired'
                        ),
                        NOW()
                    )
                """, (snapshot['id'], gcs_uri))
                
                # Delete snapshot record
                cur.execute("DELETE FROM resource_snapshots WHERE id = %s", (snapshot['id'],))
                deleted_count += 1
                
            except Exception as e:
                logger.error(f"Error deleting GCS snapshot {snapshot['id']}: {e}")
        
        conn.commit()
    
    return deleted_count


def run_cleanup():
    """Run the cleanup job."""
    logger.info("Starting cleanup job")
    
    retention_date = datetime.utcnow() - timedelta(days=config.settings.RETENTION_DAYS)
    logger.info(f"Cleaning records deleted before: {retention_date.isoformat()}")
    
    conn = get_db_connection()
    storage_client = get_storage_client()
    
    try:
        # Cleanup subscriptions
        sub_count = cleanup_subscriptions(conn, retention_date)
        logger.info(f"Hard deleted {sub_count} subscriptions")
        
        # Cleanup resources
        res_count = cleanup_resources(conn, retention_date)
        logger.info(f"Hard deleted {res_count} resources")
        
        # Cleanup GCS snapshots
        snap_count = cleanup_gcs_snapshots(conn, storage_client, retention_date)
        logger.info(f"Hard deleted {snap_count} GCS snapshots")
        
        logger.info(f"Cleanup complete. Total: {sub_count + res_count + snap_count} records")
        
    finally:
        conn.close()


def main():
    """Main entry point - runs cleanup on schedule."""
    logger.info(f"Cleanup worker started. Run interval: {config.settings.RUN_INTERVAL_HOURS} hours")
    logger.info(f"Retention period: {config.settings.RETENTION_DAYS} days")
    
    while not shutdown_requested:
        try:
            run_cleanup()
        except Exception as e:
            logger.error(f"Cleanup job failed: {e}")
        
        # Sleep until next run (check for shutdown every minute)
        sleep_seconds = config.settings.RUN_INTERVAL_HOURS * 3600
        for _ in range(sleep_seconds // 60):
            if shutdown_requested:
                break
            time.sleep(60)
    
    logger.info("Cleanup worker shutdown complete")


if __name__ == "__main__":
    main()
