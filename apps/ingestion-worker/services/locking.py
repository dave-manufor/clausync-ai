import logging
import redis
import config

logger = logging.getLogger(__name__)

# Initialize Redis client
redis_client = redis.Redis(
    host=config.settings.REDIS_HOST, 
    port=config.settings.REDIS_PORT, 
    decode_responses=True
)

LOCK_TTL_SECONDS = 300  # 5 minute lock

def get_lock(url_hash: str) -> bool:
    """Attempt to acquire a distributed lock for a URL."""
    lock_key = f"lock:scrape:{url_hash}"
    try:
        # SETNX with TTL
        result = redis_client.set(lock_key, "1", nx=True, ex=LOCK_TTL_SECONDS)
        if result:
            logger.debug(f"Acquired lock for {url_hash[:16]}...")
            return True
        else:
            logger.debug(f"Lock already held for {url_hash[:16]}...")
            return False
    except Exception as e:
        logger.error(f"Error acquiring lock: {e}")
        # Fail open - allow scraping if Redis is down
        return True

def release_lock(url_hash: str) -> bool:
    """Release a distributed lock for a URL."""
    lock_key = f"lock:scrape:{url_hash}"
    try:
        redis_client.delete(lock_key)
        logger.debug(f"Released lock for {url_hash[:16]}...")
        return True
    except Exception as e:
        logger.error(f"Error releasing lock: {e}")
        return False
