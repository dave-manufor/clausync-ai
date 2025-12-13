import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GCP_PROJECT_ID: str = "clausync-dev"
    GCP_REGION: str = "us-central1"
    PUBSUB_SUBSCRIPTION_ID: str = "cmd.analyse_change-sub"
    PUBSUB_TOPIC_NOTIFY: str = "cmd.send_notification"
    GCS_BUCKET_NAME: str = "legalwatch-snapshots"
    DATABASE_URL: str = "postgresql://clausync:localdev@localhost:5432/clausync_db"
    
    # Vertex AI Model - use versioned model name
    AI_MODEL: str = "gemini-2.0-flash-001"

    class Config:
        env_file = ".env"

settings = Settings()
