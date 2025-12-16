import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GCP_PROJECT_ID: str = "clausync-dev"
    GCP_REGION: str = "us-central1"
    PUBSUB_SUBSCRIPTION_ID: str = "cmd.analyse_change-sub"
    PUBSUB_TOPIC_NOTIFY: str = "cmd.send_notification"
    GCS_BUCKET_NAME: str = "legalwatch-snapshots"
    DATABASE_URL: str = "postgresql://clausync:localdev@localhost:5432/clausync_db"
    
    # Vertex AI Models
    AI_MODEL: str = "gemini-2.0-flash-001"
    EMBEDDING_MODEL: str = "text-embedding-005"  # For vector similarity search
    
    # Context limits (chars) - Gemini 2.0 Flash has 1M token context (~4M chars)
    MAX_CONTENT_BASELINE: int = 500_000   # ~125K tokens for single doc analysis
    MAX_CONTENT_COMPARISON: int = 250_000  # ~62K tokens per version (500K total)
    
    # RAG settings
    RAG_TOP_K: int = 5  # Number of similar chunks to retrieve

    class Config:
        env_file = ".env"

settings = Settings()

