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


def process_deletion_requests(conn) -> int:
    """
    Process pending GDPR deletion requests (Art. 17 - Right to Erasure).
    Only processes requests where scheduledAt has passed.
    """
    processed_count = 0
    
    with conn.cursor() as cur:
        # Find deletion requests ready for processing
        cur.execute("""
            SELECT dr.id, dr.user_id, u.email
            FROM deletion_requests dr
            JOIN users u ON dr.user_id = u.id
            WHERE dr.status = 'pending' 
              AND dr.scheduled_at <= NOW()
        """)
        requests = cur.fetchall()
        
        for request in requests:
            try:
                user_id = request['user_id']
                logger.info(f"Processing deletion request for user {user_id}")
                
                # Step 1: Anonymize audit logs (preserve trail, remove PII)
                anonymize_audit_logs(conn, user_id)
                
                # Step 2: Delete user data (most will CASCADE from user delete)
                # Delete subscriptions first to avoid FK issues
                cur.execute("DELETE FROM subscriptions WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM notifications WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM api_keys WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM data_exports WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM notification_preferences WHERE user_id = %s", (user_id,))
                
                # Step 3: Mark user as deleted (soft delete for audit)
                cur.execute("""
                    UPDATE users 
                    SET deleted_at = NOW(), 
                        email = 'deleted_' || id::text || '@deleted.local',
                        name = NULL,
                        identity_provider_uid = 'deleted_' || id::text
                    WHERE id = %s
                """, (user_id,))
                
                # Step 4: Update deletion request status
                cur.execute("""
                    UPDATE deletion_requests 
                    SET status = 'completed', completed_at = NOW()
                    WHERE id = %s
                """, (request['id'],))
                
                # Step 5: Log completion (with anonymized reference)
                cur.execute("""
                    INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at)
                    VALUES (
                        gen_random_uuid(),
                        'GDPR_DELETION_COMPLETED',
                        'user',
                        %s,
                        jsonb_build_object(
                            'deletion_request_id', %s,
                            'completed_at', NOW()::text,
                            'compliance', 'GDPR Art. 17'
                        ),
                        NOW()
                    )
                """, (user_id, request['id']))
                
                conn.commit()
                processed_count += 1
                logger.info(f"Successfully processed deletion for user {user_id}")
                
            except Exception as e:
                conn.rollback()
                logger.error(f"Error processing deletion request {request['id']}: {e}")
    
    return processed_count


def anonymize_audit_logs(conn, user_id: str) -> int:
    """
    Anonymize audit logs for a deleted user (SOC2 - preserve audit trail).
    Replaces user_id with a hash but keeps the log intact.
    """
    import hashlib
    
    # Create a one-way hash of the user_id for anonymization
    user_hash = hashlib.sha256(str(user_id).encode()).hexdigest()[:16]
    
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE audit_logs 
            SET user_id = NULL,
                details = details || jsonb_build_object('anonymized_user_ref', %s)
            WHERE user_id = %s
        """, (user_hash, user_id))
        
        return cur.rowcount


def cleanup_expired_exports(conn, storage_client) -> int:
    """
    Clean up expired data exports.
    - Updates status to 'expired'
    - Deletes GCS files
    """
    cleaned_count = 0
    bucket = storage_client.bucket(config.settings.GCS_BUCKET_NAME)
    
    with conn.cursor() as cur:
        # Find expired exports
        cur.execute("""
            SELECT id, file_url FROM data_exports
            WHERE status = 'ready' AND expires_at < NOW()
        """)
        exports = cur.fetchall()
        
        for export in exports:
            try:
                # Delete from GCS if file exists
                if export['file_url']:
                    file_url = export['file_url']
                    if file_url.startswith('gs://'):
                        blob_path = file_url.split('/', 3)[-1]
                    else:
                        blob_path = file_url
                    
                    blob = bucket.blob(blob_path)
                    if blob.exists():
                        blob.delete()
                        logger.info(f"Deleted export file: {blob_path}")
                
                # Update status
                cur.execute("""
                    UPDATE data_exports 
                    SET status = 'expired', file_url = NULL
                    WHERE id = %s
                """, (export['id'],))
                
                cleaned_count += 1
                
            except Exception as e:
                logger.error(f"Error cleaning export {export['id']}: {e}")
        
        conn.commit()
    
    return cleaned_count


def run_cleanup() -> dict:
    """Run the cleanup job and return results."""
    logger.info("Starting cleanup job")
    
    retention_date = datetime.utcnow() - timedelta(days=config.settings.RETENTION_DAYS)
    logger.info(f"Cleaning records deleted before: {retention_date.isoformat()}")
    
    conn = get_db_connection()
    storage_client = get_storage_client()
    
    results = {
        'gdpr_deletions': 0,
        'subscriptions': 0,
        'resources': 0,
        'snapshots': 0,
        'exports': 0,
    }
    
    try:
        # GDPR Art. 17: Process deletion requests that have passed their grace period
        results['gdpr_deletions'] = process_deletion_requests(conn)
        logger.info(f"Processed {results['gdpr_deletions']} GDPR deletion requests")
        
        # Cleanup subscriptions
        results['subscriptions'] = cleanup_subscriptions(conn, retention_date)
        logger.info(f"Hard deleted {results['subscriptions']} subscriptions")
        
        # Cleanup resources
        results['resources'] = cleanup_resources(conn, retention_date)
        logger.info(f"Hard deleted {results['resources']} resources")
        
        # Cleanup GCS snapshots
        results['snapshots'] = cleanup_gcs_snapshots(conn, storage_client, retention_date)
        logger.info(f"Hard deleted {results['snapshots']} GCS snapshots")
        
        # Cleanup expired data exports
        results['exports'] = cleanup_expired_exports(conn, storage_client)
        logger.info(f"Cleaned {results['exports']} expired data exports")
        
        total = sum(results.values())
        logger.info(f"Cleanup complete. Total: {total} records processed")
        
        return results
        
    finally:
        conn.close()


# ============================================================
# Flask HTTP Server (for Cloud Scheduler / manual trigger)
# ============================================================

from flask import Flask, jsonify, request
import os

app = Flask(__name__)

CRON_SECRET = os.environ.get('CRON_SECRET', 'dev-cron-secret')


def verify_cron_auth() -> bool:
    """Verify cron request authentication."""
    auth_header = request.headers.get('X-Cron-Secret') or request.headers.get('Authorization', '')
    if auth_header == CRON_SECRET:
        return True
    if auth_header == f'Bearer {CRON_SECRET}':
        return True
    if os.environ.get('NODE_ENV') == 'development' or os.environ.get('FLASK_ENV') == 'development':
        return True
    return False


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({'healthy': True, 'database': True})
    except Exception as e:
        return jsonify({'healthy': False, 'database': False, 'error': str(e)}), 503


@app.route('/run', methods=['POST'])
def run():
    """Run cleanup job (triggered by Cloud Scheduler)."""
    if not verify_cron_auth():
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        start_time = datetime.utcnow()
        results = run_cleanup()
        duration = (datetime.utcnow() - start_time).total_seconds()
        
        return jsonify({
            'success': True,
            'duration_seconds': duration,
            **results
        })
    except Exception as e:
        logger.error(f"Cleanup job failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


def main():
    """Main entry point - runs Flask server."""
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"Cleanup worker starting on port {port}")
    logger.info(f"Retention period: {config.settings.RETENTION_DAYS} days")
    
    # Run Flask server
    app.run(host='0.0.0.0', port=port, debug=False)


if __name__ == "__main__":
    main()

