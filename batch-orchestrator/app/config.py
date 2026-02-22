"""Configuration for the Batch Orchestrator."""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, loaded from environment variables."""
    
    # TMF Runtime
    tmf_base_url: str = os.getenv(
        "TMF_BASE_URL",
        "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com"
    )
    tmf_api_key: str = os.getenv(
        "TMF_API_KEY",
        "bssmagic-d58d6761265b01accc13e8b21bae8282"
    )
    
    # Scheduler
    scheduler_interval_seconds: int = int(os.getenv("SCHEDULER_INTERVAL", "60"))
    scheduler_enabled: bool = os.getenv("SCHEDULER_ENABLED", "false").lower() == "true"
    
    # Executor (legacy - used by batch_executor direct polling)
    max_poll_attempts: int = int(os.getenv("MAX_POLL_ATTEMPTS", "60"))
    poll_interval_seconds: int = int(os.getenv("POLL_INTERVAL", "5"))

    # Remediation Engine (exponential backoff polling)
    remediation_initial_delay: float = float(os.getenv("REMEDIATION_INITIAL_DELAY", "10.0"))
    remediation_poll_interval: float = float(os.getenv("REMEDIATION_POLL_INTERVAL", "10.0"))
    remediation_max_interval: float = float(os.getenv("REMEDIATION_MAX_INTERVAL", "60.0"))
    remediation_backoff_factor: float = float(os.getenv("REMEDIATION_BACKOFF_FACTOR", "2.0"))
    remediation_max_duration: float = float(os.getenv("REMEDIATION_MAX_DURATION", "1800.0"))
    
    # Server
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8082"))
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
