from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Configuration from environment variables."""
    GCP_PROJECT_ID: str = "clausync-dev"
    DATABASE_URL: str = "postgresql://clausync:localdev@postgres:5432/clausync_db"
    GCS_BUCKET_NAME: str = "local-snapshots"
    STORAGE_EMULATOR_HOST: str | None = None
    
    # Retention settings
    RETENTION_DAYS: int = 30
    CHANGE_EVENT_RETENTION_YEARS: int = 7
    
    # Cleanup schedule (cron-like)
    RUN_INTERVAL_HOURS: int = 24

    class Config:
        env_file = ".env"

settings = Settings()
