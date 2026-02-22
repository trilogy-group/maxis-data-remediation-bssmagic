"""
Execute Anonymous Apex via Salesforce Tooling API
"""
import httpx
import asyncio
from typing import Optional
from datetime import datetime, timedelta
from app.config import settings
from app.auth.salesforce import get_access_token, get_instance_url


async def query_latest_batch_job(access_token: str, instance_url: str, job_type: str = None) -> Optional[str]:
    """
    Query the most recent AsyncApexJob to get the batch job ID.
    
    Args:
        access_token: Salesforce OAuth token
        instance_url: Salesforce instance URL
        job_type: Optional filter for ApexClassName containing this string
    
    Returns:
        Batch job ID or None
    """
    # Query for batch jobs - get most recent ones, filter by time in code
    # Note: LAST_N_MINUTES doesn't work well via REST API
    soql = """
        SELECT Id, ApexClassId, ApexClass.Name, Status, JobType, CreatedDate 
        FROM AsyncApexJob 
        WHERE JobType = 'BatchApex' 
        ORDER BY CreatedDate DESC 
        LIMIT 10
    """
    
    url = f"{instance_url}/services/data/v59.0/query/"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                params={"q": soql},
                timeout=15.0
            )
            
            if response.status_code == 200:
                result = response.json()
                records = result.get("records", [])
                
                # Filter to jobs created in the last 2 minutes
                cutoff_time = datetime.utcnow() - timedelta(minutes=2)
                
                if records:
                    for record in records:
                        # Parse created date
                        created_str = record.get("CreatedDate", "")
                        try:
                            # Format: 2026-01-06T12:49:21.000+0000
                            created_dt = datetime.fromisoformat(created_str.replace("+0000", "+00:00").replace("Z", "+00:00"))
                            created_dt = created_dt.replace(tzinfo=None)  # Make naive for comparison
                            
                            # Skip jobs older than 2 minutes
                            if created_dt < cutoff_time:
                                continue
                        except:
                            pass  # If we can't parse date, include it anyway
                        
                        apex_class = record.get("ApexClass", {})
                        class_name = apex_class.get("Name", "") if apex_class else ""
                        
                        # If job_type specified, filter by ApexClass name
                        if job_type:
                            if job_type.lower() in class_name.lower():
                                print(f"[apex_executor] Found matching job: {record.get('Id')} ({class_name})")
                                return record.get("Id")
                        else:
                            # Return first recent job
                            return record.get("Id")
                    
        except Exception as e:
            print(f"[apex_executor] Error querying AsyncApexJob: {e}")
    
    return None


async def execute_anonymous_apex(apex_script: str, job_type_hint: str = None) -> dict:
    """
    Execute Anonymous Apex via Salesforce Tooling API.
    
    Args:
        apex_script: The Apex code to execute
        job_type_hint: Hint for the type of batch job (DELETE, MIGRATE, UPDATE)
                      Used to find the correct job ID after execution
    
    Returns:
        dict with success, compiled, output, error, jobId fields
    """
    access_token = await get_access_token()
    instance_url = await get_instance_url()
    
    url = f"{instance_url}/services/data/v59.0/tooling/executeAnonymous/"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            params={
                "anonymousBody": apex_script
            },
            timeout=60.0
        )
        
        if response.status_code != 200:
            return {
                "success": False,
                "compiled": False,
                "error": f"HTTP {response.status_code}: {response.text}",
                "output": None,
                "line": None,
                "column": None,
                "jobId": None
            }
        
        result = response.json()
        
        # Check if execution was successful
        success = result.get("success", False)
        compiled = result.get("compiled", False)
        output = result.get("logs", "")
        
        # Try to get batch job ID
        job_id = None
        
        # First try to extract from debug logs (if available)
        if output and "batch started:" in output:
            try:
                job_id = output.split("batch started:")[-1].strip().split()[0]
            except:
                pass
        
        # If no job ID from logs and execution was successful, query AsyncApexJob
        if not job_id and success and compiled:
            # Wait a moment for the batch job to be created
            await asyncio.sleep(1)
            
            # Map job_type_hint to Apex class name pattern
            class_pattern = None
            if job_type_hint == "DELETE":
                class_pattern = "DeleteSolution"
            elif job_type_hint == "MIGRATE":
                class_pattern = "MigrateSubscriptions"
            elif job_type_hint == "UPDATE":
                class_pattern = "UpdateConfigurations"
            
            job_id = await query_latest_batch_job(access_token, instance_url, class_pattern)
            
            if job_id:
                print(f"[apex_executor] Found batch job ID via SOQL query: {job_id}")
        
        return {
            "success": success,
            "compiled": compiled,
            "output": output,
            "error": result.get("compileProblem") or result.get("exceptionMessage"),
            "line": result.get("line"),
            "column": result.get("column"),
            "jobId": job_id
        }








