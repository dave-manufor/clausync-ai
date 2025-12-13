import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import config

logger = logging.getLogger(__name__)

def get_db_connection():
    """Get a database connection."""
    try:
        return psycopg2.connect(config.settings.DATABASE_URL)
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

def update_resource_hash(resource_id: str, new_hash: str) -> bool:
    """Update the current hash and last_scraped_at for a resource."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE monitored_resources 
                SET current_hash = %s, last_scraped_at = NOW(), updated_at = NOW()
                WHERE id = %s
                """,
                (new_hash, resource_id)
            )
            conn.commit()
        conn.close()
        logger.info(f"Updated resource {resource_id} with hash {new_hash[:16]}...")
        return True
    except Exception as e:
        logger.error(f"Failed to update resource hash: {e}")
        return False

def create_snapshot(resource_id: str, gcs_uri: str, content_hash: str) -> str | None:
    """Create a new snapshot record and return its ID."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO resource_snapshots (id, resource_id, gcs_uri, content_hash)
                VALUES (gen_random_uuid(), %s, %s, %s)
                RETURNING id
                """,
                (resource_id, gcs_uri, content_hash)
            )
            result = cur.fetchone()
            conn.commit()
        conn.close()
        
        if result:
            logger.info(f"Created snapshot {result['id']} for resource {resource_id}")
            return str(result['id'])
        return None
    except Exception as e:
        logger.error(f"Failed to create snapshot: {e}")
        return None

def get_resource_current_hash(resource_id: str) -> str | None:
    """Get the current hash for a resource from the database."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT current_hash FROM monitored_resources WHERE id = %s",
                (resource_id,)
            )
            result = cur.fetchone()
        conn.close()
        
        if result:
            return result['current_hash']
        return None
    except Exception as e:
        logger.error(f"Failed to get resource hash: {e}")
        return None
