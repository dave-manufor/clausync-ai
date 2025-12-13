import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GCP_PROJECT_ID: str = "clausync-dev"
    GCP_REGION: str = "us-central1"
    PUBSUB_SUBSCRIPTION_ID: str = "cmd.vectorize_doc-sub"
    GCS_BUCKET_NAME: str = "legalwatch-uploads"
    DATABASE_URL: str = "postgresql://clausync:localdev@localhost:5432/clausync_db"
    
    # Vertex AI Embedding Model
    EMBEDDING_MODEL: str = "text-embedding-004"
    EMBEDDING_DIMENSION: int = 768
    
    # Chunking settings
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    class Config:
        env_file = ".env"

settings = Settings()
