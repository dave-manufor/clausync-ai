import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import vertexai
from vertexai.language_models import TextEmbeddingModel
import config

logger = logging.getLogger(__name__)

# Initialize Vertex AI for embeddings
vertexai.init(project=config.settings.GCP_PROJECT_ID, location=config.settings.GCP_REGION)


def get_db_connection():
    """Get a database connection."""
    try:
        return psycopg2.connect(config.settings.DATABASE_URL)
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise


def generate_query_embedding(text: str) -> list[float] | None:
    """Generate embedding for a query text using Vertex AI."""
    try:
        model = TextEmbeddingModel.from_pretrained(config.settings.EMBEDDING_MODEL)
        embeddings = model.get_embeddings([text])
        if embeddings:
            return embeddings[0].values
        return None
    except Exception as e:
        logger.error(f"Failed to generate query embedding: {e}")
        return None


def get_old_snapshot(resource_id: str, content_hash: str) -> dict | None:
    """
    Get the previous snapshot for a resource by its content hash.
    Returns snapshot info including id and gcs_uri, or None if not found.
    """
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, gcs_uri, content_hash, scraped_at
                FROM resource_snapshots
                WHERE resource_id = %s AND content_hash = %s
                ORDER BY scraped_at DESC
                LIMIT 1
                """,
                (resource_id, content_hash)
            )
            result = cur.fetchone()
        conn.close()
        
        if result:
            return dict(result)
        return None
        
    except Exception as e:
        logger.error(f"Failed to get old snapshot: {e}")
        return None


async def get_user_policy_context(user_id: str, query_text: str, limit: int = None) -> list[str]:
    """
    Perform vector similarity search to find relevant user policy chunks.
    Uses pgvector for semantic search with cosine distance.
    
    Args:
        user_id: The user's ID
        query_text: Text to find similar content for (analysis summary, keywords, etc.)
        limit: Number of chunks to retrieve (default from config)
    
    Returns:
        List of relevant content chunks sorted by similarity
    """
    limit = limit or config.settings.RAG_TOP_K
    
    try:
        # Generate embedding for the query text
        query_embedding = generate_query_embedding(query_text)
        
        if not query_embedding:
            logger.warning("Could not generate query embedding, falling back to recent chunks")
            # Fallback to recent chunks if embedding fails
            return await _get_recent_chunks(user_id, limit)
        
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Use pgvector cosine distance operator <=> for similarity search
            # Lower distance = more similar
            cur.execute(
                """
                SELECT content_chunk, source_filename,
                       1 - (embedding <=> %s::vector) as similarity
                FROM user_context_embeddings
                WHERE user_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (query_embedding, user_id, query_embedding, limit)
            )
            results = cur.fetchall()
        conn.close()
        
        if results:
            logger.info(f"Found {len(results)} similar chunks via vector search",
                       extra={"top_similarity": results[0].get("similarity", 0) if results else 0})
            return [r['content_chunk'] for r in results]
        
        return []
        
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        # Fallback to recent chunks on error
        return await _get_recent_chunks(user_id, limit)


async def _get_recent_chunks(user_id: str, limit: int) -> list[str]:
    """Fallback: Get most recent chunks when vector search unavailable."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT content_chunk, source_filename
                FROM user_context_embeddings
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit)
            )
            results = cur.fetchall()
        conn.close()
        
        if results:
            logger.info(f"Fallback: returning {len(results)} recent chunks")
            return [r['content_chunk'] for r in results]
        return []
        
    except Exception as e:
        logger.error(f"Failed to get recent chunks: {e}")
        return []

async def get_subscribers_with_personalization(resource_id: str) -> list[dict]:
    """Get all users subscribed to a resource with personalization enabled."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT u.id as user_id, u.email, s.id as subscription_id
                FROM subscriptions s
                JOIN users u ON s.user_id = u.id
                WHERE s.resource_id = %s AND s.personalization_enabled = TRUE
                """,
                (resource_id,)
            )
            results = cur.fetchall()
        conn.close()
        return [dict(r) for r in results]
        
    except Exception as e:
        logger.error(f"Failed to get subscribers: {e}")
        return []


async def get_all_subscribers(resource_id: str) -> list[dict]:
    """
    Get all active, non-paused subscribers with their notification preferences.
    
    Returns:
        List of dicts with: user_id, email, subscription_id, personalization_enabled,
        email_enabled, risk_threshold, digest_frequency, display_name, url_normalized
    """
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    u.id as user_id, 
                    u.email, 
                    s.id as subscription_id,
                    s.personalization_enabled,
                    s.display_name,
                    mr.url_normalized,
                    COALESCE(np.email_enabled, TRUE) as email_enabled,
                    COALESCE(np.risk_threshold, 5) as risk_threshold,
                    COALESCE(np.digest_frequency, 'instant') as digest_frequency
                FROM subscriptions s
                JOIN users u ON s.user_id = u.id
                JOIN monitored_resources mr ON s.resource_id = mr.id
                LEFT JOIN notification_preferences np ON np.user_id = u.id
                WHERE s.resource_id = %s 
                  AND s.deleted_at IS NULL 
                  AND s.paused_at IS NULL
                  AND u.deleted_at IS NULL
                """,
                (resource_id,)
            )
            results = cur.fetchall()
        conn.close()
        
        logger.info(f"Found {len(results)} active subscribers for resource", 
                   extra={"resource_id": resource_id})
        return [dict(r) for r in results]
        
    except Exception as e:
        logger.error(f"Failed to get all subscribers: {e}")
        return []


def create_change_event(resource_id: str, old_snapshot_id: str | None, new_snapshot_id: str, 
                        diff_json: dict, ai_summary: str, risk_score: int, keywords: list[str]) -> str | None:
    """Create a change event record."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO change_events 
                (id, resource_id, old_snapshot_id, new_snapshot_id, diff_json, global_ai_summary, global_risk_score, risk_keywords)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (resource_id, old_snapshot_id, new_snapshot_id, 
                 psycopg2.extras.Json(diff_json), ai_summary, risk_score, keywords)
            )
            result = cur.fetchone()
            conn.commit()
        conn.close()
        
        if result:
            logger.info(f"Created change event {result['id']}")
            return str(result['id'])
        return None
        
    except Exception as e:
        logger.error(f"Failed to create change event: {e}")
        return None

def create_notification(user_id: str, change_event_id: str, personalized_summary: str, risk_level: str) -> str | None:
    """Create a notification record."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO notifications 
                (id, user_id, change_event_id, personalized_summary, risk_level)
                VALUES (gen_random_uuid(), %s, %s, %s, %s)
                RETURNING id
                """,
                (user_id, change_event_id, personalized_summary, risk_level)
            )
            result = cur.fetchone()
            conn.commit()
        conn.close()
        
        if result:
            logger.info(f"Created notification {result['id']} for user {user_id}")
            return str(result['id'])
        return None
        
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        return None
