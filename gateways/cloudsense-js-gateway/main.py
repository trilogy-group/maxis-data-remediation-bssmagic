"""
CloudSense JS API Gateway Service
================================
A FastAPI service that exposes CloudSense JavaScript APIs via REST endpoints.

Security note:
- Do NOT hardcode credentials in this repository.
- Provide Salesforce credentials via environment variables or request payload.

Usage:
    cd cloudsense_api_service
    pip install -r requirements.txt
    python main.py

Endpoints:
    GET  /health                     - Health check
    POST /api/configurations         - Get all configurations for a solution
    POST /api/oe/update              - Update OE attributes for a solution
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
import json
import os

# Salesforce auth
from cloudsense_js_engine import (
    CloudSenseJSEngine,
    SalesforceCredentials as EngineSalesforceCredentials,
    log,
)

# =============================================================================
# CONFIGURATION
# =============================================================================

def _env_or_none(key: str) -> Optional[str]:
    v = os.getenv(key)
    return v if v and v.strip() else None


DEFAULT_SF_CONFIG = {
    "username": _env_or_none("SF_USERNAME"),
    "password": _env_or_none("SF_PASSWORD"),
    "security_token": _env_or_none("SF_TOKEN") or _env_or_none("SF_SECURITY_TOKEN"),
    "domain": _env_or_none("SF_DOMAIN") or "test",
}

# =============================================================================
# MODELS
# =============================================================================

class SalesforceCredentials(BaseModel):
    username: Optional[str] = DEFAULT_SF_CONFIG["username"]
    password: Optional[str] = DEFAULT_SF_CONFIG["password"]
    security_token: Optional[str] = DEFAULT_SF_CONFIG["security_token"]
    domain: str = DEFAULT_SF_CONFIG["domain"]

    def to_engine_creds(self) -> EngineSalesforceCredentials:
        if not self.username or not self.password or not self.security_token:
            raise ValueError(
                "Missing Salesforce credentials. Provide them in the request or set "
                "SF_USERNAME, SF_PASSWORD, SF_TOKEN (or SF_SECURITY_TOKEN) environment variables."
            )
        return EngineSalesforceCredentials(
            username=self.username,
            password=self.password,
            security_token=self.security_token,
            domain=self.domain,
        )

class GetConfigurationsRequest(BaseModel):
    basket_id: str                    # Salesforce Basket ID (cscfga__Product_Basket__c)
    solution_name: str                # Name of the solution to select (e.g., "IOT Solution", "Mobile Solution")
    credentials: Optional[SalesforceCredentials] = None

class OEAttribute(BaseModel):
    name: str
    value: str
    displayValue: Optional[str] = None

class OEUpdateRequest(BaseModel):
    basket_id: str                    # Salesforce Basket ID (cscfga__Product_Basket__c)
    solution_name: str                # Name of the solution to select
    config_guid: Optional[str] = None # If None, updates all configs
    oe_guid: Optional[str] = None     # If None, updates all OEs in config
    attributes: List[OEAttribute]
    credentials: Optional[SalesforceCredentials] = None

class VerifyOERequest(BaseModel):
    basket_id: str                    # Salesforce Basket ID
    solution_name: str                # Name of the solution to select
    credentials: Optional[SalesforceCredentials] = None

def _to_engine_creds(creds: SalesforceCredentials) -> EngineSalesforceCredentials:
    return creds.to_engine_creds()

# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(
    title="CloudSense JS API Gateway",
    description="REST API gateway for CloudSense JavaScript APIs",
    version="2.1.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "service": "CloudSense JS API Gateway",
        "version": "2.1.0",
        "description": "Requires basket_id + solution_name",
        "endpoints": [
            "GET  /health",
            "POST /api/configurations  - Get configs for a solution",
            "POST /api/oe/update       - Update OE attributes"
        ],
        "example": {
            "basket_id": "a0uMS000001KiqnYAC",
            "solution_name": "IOT Solution"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/configurations")
async def get_configurations(request: GetConfigurationsRequest):
    """
    Get all configurations and OE data for a specific solution in a basket.
    
    Args:
        basket_id: Salesforce Product Basket ID (cscfga__Product_Basket__c)
        solution_name: Name of the solution to select (e.g., "IOT Solution", "Mobile Solution")
    
    This executes `solution.getAllConfigurations()` in the CloudSense Solution Console.
    """
    log(f"\n{'='*60}")
    log(f"GET CONFIGURATIONS")
    log(f"  basket_id: {request.basket_id}")
    log(f"  solution_name: {request.solution_name}")
    log(f"{'='*60}")
    
    credentials = request.credentials or SalesforceCredentials()
    
    try:
        async with CloudSenseJSEngine(_to_engine_creds(credentials)) as engine:
            # Navigate to Solution Console and select the solution
            success = await engine.navigate_to_solution_console(
                request.basket_id, 
                request.solution_name
            )
            if not success:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to load Solution Console or solution '{request.solution_name}' not found"
                )
            
            # Get configurations
            result = await engine.get_all_configurations()
            
            return {
                "success": True,
                "basket_id": request.basket_id,
                "solution_name": request.solution_name,
                "timestamp": datetime.now().isoformat(),
                **result
            }
    except HTTPException:
        raise
    except Exception as e:
        log(f"❌ Error: {e}", "ERROR")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/oe/update")
async def update_oe_attributes(request: OEUpdateRequest):
    """
    Update OE attributes for a specific solution using JS API.
    
    Args:
        basket_id: Salesforce Product Basket ID
        solution_name: Name of the solution to select
        attributes: List of attributes to update
        config_guid: (Optional) Only update this specific configuration
        oe_guid: (Optional) Only update this specific OE item
    
    This executes `solution.updateOrderEnrichmentConfigurationAttribute()` 
    in the CloudSense Solution Console.
    """
    log(f"\n{'='*60}")
    log(f"UPDATE OE")
    log(f"  basket_id: {request.basket_id}")
    log(f"  solution_name: {request.solution_name}")
    log(f"  attributes: {[a.name for a in request.attributes]}")
    log(f"{'='*60}")
    
    credentials = request.credentials or SalesforceCredentials()
    
    try:
        async with CloudSenseJSEngine(_to_engine_creds(credentials)) as engine:
            # Navigate to Solution Console and select the solution
            success = await engine.navigate_to_solution_console(
                request.basket_id,
                request.solution_name
            )
            if not success:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to load Solution Console or solution '{request.solution_name}' not found"
                )
            
            # Get current configurations
            configs_result = await engine.get_all_configurations()
            configs = configs_result.get('configurations', [])
            
            # Prepare updates
            updates = []
            attrs_to_update = [a.dict() for a in request.attributes]
            
            for config in configs:
                # Skip if specific config_guid provided and doesn't match
                if request.config_guid and config['guid'] != request.config_guid:
                    continue
                
                for oe in config.get('orderEnrichmentList', []):
                    # Skip if specific oe_guid provided and doesn't match
                    if request.oe_guid and oe['guid'] != request.oe_guid:
                        continue
                    
                    # Update attributes
                    result = await engine.update_oe_attributes(
                        config['guid'],
                        oe['guid'],
                        attrs_to_update
                    )
                    
                    updates.append({
                        "config_name": config['name'],
                        "config_guid": config['guid'],
                        "oe_name": oe['name'],
                        "oe_guid": oe['guid'],
                        "result": result
                    })
            
            # Persist changes
            persist_result = await engine.click_calculate_totals()
            
            return {
                "success": True,
                "basket_id": request.basket_id,
                "solution_name": request.solution_name,
                "timestamp": datetime.now().isoformat(),
                "updates": updates,
                "persist": persist_result
            }
    except HTTPException:
        raise
    except Exception as e:
        log(f"❌ Error: {e}", "ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/verify-oe")
async def verify_oe_in_cloudsense_db(request: VerifyOERequest):
    """
    Verify what's in CloudSense internal database (Heroku).
    
    This fetches OE data via Solution Console JavaScript APIs,
    which reads from CloudSense's internal database (not the Salesforce attachment).
    
    Use this to verify if BillingAccount and other fields exist in the DB
    that CloudSense uses for order processing.
    """
    creds = (request.credentials or SalesforceCredentials()).to_engine_creds()
    
    try:
        async with CloudSenseJSEngine(creds, headless=True) as engine:
            # Navigate to Solution Console
            success = await engine.navigate_to_solution_console(
                request.basket_id,
                request.solution_name
            )
            if not success:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to load Solution Console or solution '{request.solution_name}' not found"
                )
            
            # Get all configurations from CloudSense internal DB
            configs_result = await engine.get_all_configurations()
            configs = configs_result.get('configurations', [])
            
            # Analyze OE data
            oe_fields_found = {}
            total_oe_configs = 0
            
            for config in configs:
                for oe in config.get('orderEnrichmentList', []):
                    total_oe_configs += 1
                    oe_name = oe.get('name', 'Unknown')
                    
                    if oe_name not in oe_fields_found:
                        oe_fields_found[oe_name] = {
                            'attributes': [],
                            'count': 0
                        }
                    
                    oe_fields_found[oe_name]['count'] += 1
                    
                    # Extract all attribute names and check for key fields
                    for attr in oe.get('attributes', []):
                        attr_name = attr.get('name', '')
                        attr_value = attr.get('value', '')
                        
                        # Check for important fields
                        if 'billing' in attr_name.lower() or 'reserved' in attr_name.lower() or 'pic' in attr_name.lower():
                            oe_fields_found[oe_name]['attributes'].append({
                                'name': attr_name,
                                'value': attr_value,
                                'label': attr.get('displayValue', attr_value)
                            })
            
            return {
                "success": True,
                "basket_id": request.basket_id,
                "solution_name": request.solution_name,
                "timestamp": datetime.now().isoformat(),
                "source": "CloudSense Internal DB (Heroku)",
                "totalOEConfigurations": total_oe_configs,
                "oeFieldsBySchema": oe_fields_found,
                "rawConfigurations": configs  # Full data for inspection
            }
    
    except HTTPException:
        raise
    except Exception as e:
        log(f"❌ Error: {e}", "ERROR")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*60)
    print("  CloudSense JS API Gateway v2.1")
    print("="*60)
    print(f"\n  Starting server on http://localhost:8080")
    print(f"\n  Endpoints:")
    print(f"    GET  http://localhost:8080/health")
    print(f"    POST http://localhost:8080/api/configurations")
    print(f"    POST http://localhost:8080/api/oe/update")
    print(f"\n  Swagger UI: http://localhost:8080/docs")
    print(f"\n  Required inputs: basket_id + solution_name")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8080)
