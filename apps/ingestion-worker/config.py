import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GCP_PROJECT_ID: str = "clausync-dev"
    PUBSUB_SUBSCRIPTION_ID: str = "cmd.scrape_url-sub"
    PUBSUB_TOPIC_ID: str = "cmd.analyse_change"
    GCS_BUCKET_NAME: str = "legalwatch-snapshots"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    DATABASE_URL: str = "postgresql://clausync:localdev@localhost:5432/clausync_db"
    
    # Bright Data Proxy Configuration
    PROXY_HOST: str = ""
    PROXY_PORT: int = 22225
    PROXY_USER: str = ""
    PROXY_PASS: str = ""
    
    @property
    def proxy_url(self) -> str | None:
        if self.PROXY_HOST and self.PROXY_USER:
            return f"http://{self.PROXY_USER}:{self.PROXY_PASS}@{self.PROXY_HOST}:{self.PROXY_PORT}"
        return None

    class Config:
        env_file = ".env"

settings = Settings()
