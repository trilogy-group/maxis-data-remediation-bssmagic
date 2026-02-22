"""
Configuration settings for 1147 Gateway
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Salesforce
    SF_LOGIN_URL: str = "https://test.salesforce.com"  # or https://login.salesforce.com for production
    SF_INSTANCE: str = "https://maxis--fdrv2.sandbox.my.salesforce.com"
    SF_USERNAME: str
    SF_PASSWORD: str
    SF_SECURITY_TOKEN: str
    SF_CLIENT_ID: str
    SF_CLIENT_SECRET: str
    
    # Rate limiting
    BATCH_DELAY_SECONDS: int = 2
    MAX_CONCURRENT_BATCHES: int = 5
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8081  # 1147-gateway on 8081, CloudSense JS Gateway on 8080
    
    # API Security
    API_KEY: str = "bssmagic-d58d6761265b01accc13e8b21bae8282"  # Must match ALB/CloudFront key
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()








