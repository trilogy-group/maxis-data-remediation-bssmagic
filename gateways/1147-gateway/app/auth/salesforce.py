"""
Salesforce OAuth authentication
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional
from app.config import settings

_cached_token: Optional[str] = None
_token_expiry: Optional[datetime] = None


async def get_access_token() -> str:
    """
    Get Salesforce OAuth access token.
    Uses Username-Password flow for server-to-server auth.
    
    Returns:
        OAuth access token
    """
    global _cached_token, _token_expiry
    
    # Check if cached token is still valid
    if _cached_token and _token_expiry and datetime.now() < _token_expiry:
        return _cached_token
    
    url = f"{settings.SF_LOGIN_URL}/services/oauth2/token"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            data={
                "grant_type": "password",
                "client_id": settings.SF_CLIENT_ID,
                "client_secret": settings.SF_CLIENT_SECRET,
                "username": settings.SF_USERNAME,
                "password": f"{settings.SF_PASSWORD}{settings.SF_SECURITY_TOKEN}"
            },
            timeout=30.0
        )
        
        if response.status_code != 200:
            raise Exception(f"Salesforce auth failed: {response.status_code} - {response.text}")
        
        result = response.json()
        _cached_token = result["access_token"]
        # Tokens typically valid for 2 hours, refresh after 1.5 hours
        _token_expiry = datetime.now() + timedelta(hours=1, minutes=30)
        
        return _cached_token


async def get_instance_url() -> str:
    """
    Get Salesforce instance URL from OAuth response.
    Cached along with access token.
    """
    # For now, use the configured instance URL
    # In a full implementation, we'd store this from the OAuth response
    return settings.SF_INSTANCE

