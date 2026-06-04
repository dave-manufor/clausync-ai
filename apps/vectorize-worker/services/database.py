import logging
import psycopg2
from psycopg2.extras import execute_values
import config

logger = logging.getLogger(__name__)

def get_db_connection():
    """Get a database connection."""
    try:
        return psycopg2.connect(config.settings.DATABASE_URL)
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

def store_embeddings(user_id: str, source_filename: str, chunks: list[str], embeddings: list[list[float]]) -> int:
    """
    Store text chunks and their embeddings in the database.
    Returns number of rows inserted.
    """
    if len(chunks) != len(embeddings):
        logger.error("Mismatch between chunks and embeddings count")
        return 0
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Prepare data for batch insert
            # Format: (user_id, source_filename, content_chunk, embedding)
            data = []
            for chunk, embedding in zip(chunks, embeddings):
                # Convert embedding list to PostgreSQL vector format
                embedding_str = f"[{','.join(map(str, embedding))}]"
                data.append((user_id, source_filename, chunk, embedding_str))
            
            # Use execute_values for efficient batch insert
            insert_query = """
                INSERT INTO user_context_embeddings 
                (id, user_id, source_filename, content_chunk, embedding)
                VALUES %s
            """
            
            execute_values(
                cur, 
                insert_query, 
                data,
                template="(gen_random_uuid(), %s, %s, %s, %s::vector)"
            )
            
            conn.commit()
            rows_inserted = len(data)
            
        conn.close()
        logger.info(f"Stored {rows_inserted} embeddings for user {user_id}")
        return rows_inserted
        
    except Exception as e:
        logger.error(f"Error storing embeddings: {e}")
        return 0

def delete_user_embeddings(user_id: str, source_filename: str = None) -> int:
    """Delete embeddings for a user, optionally filtered by source filename."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            if source_filename:
                cur.execute(
                    "DELETE FROM user_context_embeddings WHERE user_id = %s AND source_filename = %s",
                    (user_id, source_filename)
                )
            else:
                cur.execute(
                    "DELETE FROM user_context_embeddings WHERE user_id = %s",
                    (user_id,)
                )
            
            deleted = cur.rowcount
            conn.commit()
            
        conn.close()
        logger.info(f"Deleted {deleted} embeddings for user {user_id}")
        return deleted
        
    except Exception as e:
        logger.error(f"Error deleting embeddings: {e}")
        return 0
