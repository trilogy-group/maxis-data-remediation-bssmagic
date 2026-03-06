"""
DEPRECATED: Query solution status from Salesforce to determine remediation path.

This module is no longer used. Solution status is now determined via the
Apex REST API at GET /services/apexrest/api/v1/solution/solution-information.
See apex_rest_client.py for the replacement.

Kept for reference only - safe to delete.
"""
import httpx
from typing import Optional, Literal
from app.config import settings
from app.auth.salesforce import get_access_token, get_instance_url


async def get_solution_status(solution_id: str) -> dict:
    """
    Query solution status from Salesforce.
    
    Returns:
        dict with is_migrated, is_config_updated, external_identifier, path
    """
    access_token = await get_access_token()
    instance_url = await get_instance_url()
    
    query = f"""
        SELECT Id, Name, Is_Migrated_to_Heroku__c, Is_Configuration_Updated_To_Heroku__c, 
               csord__External_Identifier__c, csord__Status__c
        FROM csord__Solution__c 
        WHERE Id = '{solution_id}'
    """
    
    url = f"{instance_url}/services/data/v59.0/query/"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            params={"q": query},
            timeout=30.0
        )
        
        if response.status_code != 200:
            raise Exception(f"SOQL query failed: {response.status_code} - {response.text}")
        
        result = response.json()
        
        if result.get("totalSize", 0) == 0:
            raise Exception(f"Solution {solution_id} not found")
        
        record = result["records"][0]
        
        is_migrated = record.get("Is_Migrated_to_Heroku__c", False)
        is_config_updated = record.get("Is_Configuration_Updated_To_Heroku__c", False)
        external_id = record.get("csord__External_Identifier__c")
        
        # Determine remediation path
        path = determine_remediation_path(is_migrated, is_config_updated, external_id)
        
        return {
            "solution_id": solution_id,
            "name": record.get("Name"),
            "status": record.get("csord__Status__c"),
            "is_migrated": is_migrated,
            "is_config_updated": is_config_updated,
            "external_identifier": external_id,
            "path": path,
            "steps": get_steps_for_path(path)
        }


def determine_remediation_path(
    is_migrated: bool, 
    is_config_updated: bool, 
    external_identifier: Optional[str]
) -> Literal["A", "B", "C", "NONE"]:
    """
    Determine which remediation path to use.
    
    Path A: DELETE → MIGRATE → UPDATE
        - Is_Migrated = FALSE
        - External_Identifier = 'Not Migrated Successfully'
    
    Path B: MIGRATE → UPDATE
        - Is_Migrated = FALSE
        - External_Identifier != 'Not Migrated Successfully'
    
    Path C: UPDATE only
        - Is_Migrated = TRUE
        - Is_Config_Updated = FALSE
    
    NONE: Already fixed
        - Is_Migrated = TRUE
        - Is_Config_Updated = TRUE
    """
    if is_migrated and is_config_updated:
        return "NONE"  # Already fixed
    
    if not is_migrated:
        if external_identifier == "Not Migrated Successfully":
            return "A"  # DELETE → MIGRATE → UPDATE
        else:
            return "B"  # MIGRATE → UPDATE
    
    if is_migrated and not is_config_updated:
        return "C"  # UPDATE only
    
    return "NONE"


def get_steps_for_path(path: Literal["A", "B", "C", "NONE"]) -> list:
    """Get the list of steps for a given path."""
    if path == "A":
        return ["DELETE", "MIGRATE", "UPDATE"]
    elif path == "B":
        return ["MIGRATE", "UPDATE"]
    elif path == "C":
        return ["UPDATE"]
    else:
        return []









