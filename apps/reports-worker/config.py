from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Configuration for the reports worker."""
    
    # GCP
    GCP_PROJECT_ID: str = "clausync-dev"
    
    # Database
    DATABASE_URL: str = "postgresql://clausync:localdev@localhost:5432/clausync_db"
    
    # GCS
    GCS_BUCKET_NAME: str = "clausync-reports"
    STORAGE_EMULATOR_HOST: Optional[str] = None
    
    # Pub/Sub
    PUBSUB_TOPIC_NOTIFICATION: str = "cmd.send_notification"
    
    # Worker settings
    RUN_INTERVAL_SECONDS: int = 30
    REPORT_EXPIRY_DAYS: int = 7
    
    class Config:
        env_file = ".env"


settings = Settings()
