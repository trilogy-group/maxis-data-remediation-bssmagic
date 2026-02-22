"""
Apex REST API Client for Solution Management.

Calls the deployed Apex REST APIs directly instead of using Anonymous Apex execution.

API Base Path: /services/apexrest/api/v1/solution
Endpoints:
    GET    /solution-information       - Get solution metadata and MACD details
    DELETE /solution                   - Delete solution from SM Service
    POST   /migrate/                   - Initiate solution migration
    GET    /get-migration-status       - Poll migration status
    POST   /update-post-migration-data/ - Update SFDC and SM Service after migration

See: solution-empty-api specs.txt for the full API specification.
"""
import asyncio
import httpx
import logging
from typing import Optional, Dict, Any, Literal
from dataclasses import dataclass, field
from app.auth.salesforce import get_access_token, get_instance_url

logger = logging.getLogger(__name__)

# Terminal migration statuses - stop polling when one of these is reached
TERMINAL_STATUSES = {"COMPLETED", "FAILED"}

# Default polling configuration
DEFAULT_INITIAL_DELAY = 10      # seconds before first poll
DEFAULT_POLL_INTERVAL = 10      # initial polling interval (seconds)
DEFAULT_MAX_INTERVAL = 60       # maximum polling interval (seconds)
DEFAULT_BACKOFF_FACTOR = 2.0    # exponential backoff multiplier
DEFAULT_MAX_DURATION = 1800     # 30 minutes max polling duration


@dataclass
class ApexApiResponse:
    """Standard response from Apex REST API (delete, migrate)"""
    success: bool
    message: str
    solutionId: Optional[str] = None
    jobId: Optional[str] = None
    status: Optional[str] = None


@dataclass
class SolutionInfoResponse:
    """Response from GET /solution-information"""
    success: bool
    message: str
    solutionId: Optional[str] = None
    solutionName: Optional[str] = None
    externalIdentifier: Optional[str] = None
    createdBy: Optional[str] = None
    createdDate: Optional[str] = None
    migrationStatus: Optional[str] = None
    migrationDate: Optional[str] = None
    macdDetails: Optional[Dict[str, Any]] = None
    smServiceStatus: Optional[Dict[str, Any]] = None
    additionalMetadata: Optional[Dict[str, Any]] = None


@dataclass
class MigrationStatusResult:
    """Response from GET /get-migration-status"""
    success: bool
    message: str
    solutionId: Optional[str] = None
    status: Optional[str] = None  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    subscriptionCount: Optional[int] = None


@dataclass
class UpdatePostMigrationResult:
    """Response from POST /update-post-migration-data/"""
    success: bool
    message: str
    solutionId: Optional[str] = None
    sfdcUpdateStatus: Optional[str] = None
    smServiceUpdateStatus: Optional[str] = None
    updatedFields: Optional[list] = None
    errors: Optional[list] = None


class ApexRestClient:
    """
    Client for the Solution Management Apex REST API.
    
    Replaces Anonymous Apex execution with proper REST API calls.
    
    Benefits over Anonymous Apex:
        - Structured JSON responses (no log parsing)
        - Proper audit trail (runs in Apex context)
        - Job IDs returned directly
        - Standard error responses
        - Async migration with status polling
    """
    
    BASE_PATH = "/services/apexrest/api/v1/solution"
    
    async def _make_request(
        self,
        method: Literal["GET", "POST", "DELETE"],
        endpoint: str,
        params: Optional[Dict[str, str]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        timeout: float = 120.0,
    ) -> Dict[str, Any]:
        """
        Make authenticated request to Apex REST API.
        
        Args:
            method: HTTP method (GET, POST, DELETE)
            endpoint: API endpoint path (e.g., '/solution-information')
            params: Query parameters (for GET/DELETE requests)
            json_body: JSON request body (for POST requests)
            timeout: Request timeout in seconds
            
        Returns:
            Parsed JSON response as dict
            
        Raises:
            Exception on HTTP errors or connection failures
        """
        access_token = await get_access_token()
        instance_url = await get_instance_url()
        
        url = f"{instance_url}{self.BASE_PATH}{endpoint}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        
        logger.info(f"[ApexREST] {method} {endpoint} params={params}")
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_body,
                timeout=timeout,
            )
            
            logger.info(f"[ApexREST] Response: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            else:
                # Try to parse error response
                try:
                    data = response.json()
                    return data
                except Exception:
                    return {
                        "success": False,
                        "message": f"HTTP {response.status_code}: {response.text}",
                    }
    
    # ==========================================
    # Endpoint Methods
    # ==========================================
    
    async def get_solution_information(self, solution_id: str) -> SolutionInfoResponse:
        """
        GET /solution-information - Retrieve solution metadata.
        
        Returns MACD details, migration status, SM Service status, and account info.
        The caller uses this to determine eligibility for remigration.
        
        Args:
            solution_id: 18-character Salesforce Solution ID
            
        Returns:
            SolutionInfoResponse with full solution metadata
        """
        data = await self._make_request(
            method="GET",
            endpoint="/solution-information",
            params={"solutionId": solution_id},
            timeout=30.0,
        )
        
        return SolutionInfoResponse(
            success=data.get("success", False),
            message=data.get("message", ""),
            solutionId=data.get("solutionId"),
            solutionName=data.get("solutionName"),
            externalIdentifier=data.get("externalIdentifier"),
            createdBy=data.get("createdBy"),
            createdDate=data.get("createdDate"),
            migrationStatus=data.get("migrationStatus"),
            migrationDate=data.get("migrationDate"),
            macdDetails=data.get("macdDetails"),
            smServiceStatus=data.get("smServiceStatus"),
            additionalMetadata=data.get("additionalMetadata"),
        )
    
    async def delete_solution(self, solution_id: str) -> ApexApiResponse:
        """
        DELETE /solution - Delete a solution from SM Service.
        
        Clears any partial or inconsistent SM artifacts for clean re-migration.
        Should always be called before migrate.
        
        Args:
            solution_id: 18-character Salesforce Solution ID
            
        Returns:
            ApexApiResponse with success status
        """
        data = await self._make_request(
            method="DELETE",
            endpoint="/solution",
            params={"solutionId": solution_id},
            timeout=60.0,
        )
        
        return ApexApiResponse(
            success=data.get("success", False),
            message=data.get("message", ""),
            solutionId=data.get("solutionId"),
            jobId=data.get("jobId"),
            status=data.get("status"),
        )
    
    async def migrate_solution(self, solution_id: str) -> ApexApiResponse:
        """
        POST /migrate/ - Initiate solution migration to SM Service.
        
        IMPORTANT: Always call delete_solution() first!
        
        Returns a jobId for status polling via get_migration_status().
        
        Args:
            solution_id: 18-character Salesforce Solution ID
            
        Returns:
            ApexApiResponse with jobId for status polling
        """
        data = await self._make_request(
            method="POST",
            endpoint="/migrate/",
            json_body={"solutionId": solution_id},
            timeout=120.0,
        )
        
        return ApexApiResponse(
            success=data.get("success", False),
            message=data.get("message", ""),
            solutionId=data.get("solutionId"),
            jobId=data.get("jobId"),
            status=data.get("status"),
        )
    
    async def get_migration_status(self, solution_id: str) -> MigrationStatusResult:
        """
        GET /get-migration-status - Poll migration status.
        
        Status values:
            PENDING     - Not yet started (non-terminal)
            IN_PROGRESS - Currently processing (non-terminal)
            COMPLETED   - Successfully completed (terminal)
            FAILED      - Migration failed (terminal)
        
        Args:
            solution_id: 18-character Salesforce Solution ID
            
        Returns:
            MigrationStatusResult with current status
        """
        data = await self._make_request(
            method="GET",
            endpoint="/get-migration-status",
            params={"solutionId": solution_id},
            timeout=30.0,
        )
        
        return MigrationStatusResult(
            success=data.get("success", False),
            message=data.get("message", ""),
            solutionId=data.get("solutionId"),
            status=data.get("status"),
            subscriptionCount=data.get("subscriptionCount"),
        )
    
    async def update_post_migration_data(
        self,
        solution_id: str,
        migration_status: str = "completed",
        job_id: Optional[str] = None,
        sfdc_updates: Optional[Dict[str, Any]] = None,
        sm_service_data: Optional[Dict[str, Any]] = None,
    ) -> UpdatePostMigrationResult:
        """
        POST /update-post-migration-data/ - Update SFDC fields and SM Service data.
        
        Should be called after migration is confirmed complete (COMPLETED status).
        
        Args:
            solution_id: 18-character Salesforce Solution ID
            migration_status: Final migration status ("completed", "failed", "partial")
            job_id: Migration job ID for reference
            sfdc_updates: Key-value pairs of SFDC fields to update
            sm_service_data: Key-value pairs for SM Service sync
            
        Returns:
            UpdatePostMigrationResult with update statuses
        """
        body: Dict[str, Any] = {
            "solutionId": solution_id,
            "migrationStatus": migration_status,
        }
        if job_id:
            body["jobId"] = job_id
        if sfdc_updates:
            body["sfdcUpdates"] = sfdc_updates
        if sm_service_data:
            body["smServiceData"] = sm_service_data
        
        data = await self._make_request(
            method="POST",
            endpoint="/update-post-migration-data/",
            json_body=body,
            timeout=60.0,
        )
        
        return UpdatePostMigrationResult(
            success=data.get("success", False),
            message=data.get("message", ""),
            solutionId=data.get("solutionId"),
            sfdcUpdateStatus=data.get("sfdcUpdateStatus"),
            smServiceUpdateStatus=data.get("smServiceUpdateStatus"),
            updatedFields=data.get("updatedFields"),
            errors=data.get("errors"),
        )
    
    # ==========================================
    # Orchestration Methods
    # ==========================================
    
    async def poll_migration_status(
        self,
        solution_id: str,
        initial_delay: float = DEFAULT_INITIAL_DELAY,
        poll_interval: float = DEFAULT_POLL_INTERVAL,
        max_interval: float = DEFAULT_MAX_INTERVAL,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        max_duration: float = DEFAULT_MAX_DURATION,
    ) -> MigrationStatusResult:
        """
        Poll migration status with exponential backoff until terminal status.
        
        Polling strategy (per API spec):
            - Initial delay: 10s after calling /migrate/
            - Polling interval: exponential backoff (10s → 20s → 40s → 60s max)
            - Terminal condition: COMPLETED or FAILED
            - Timeout: 30 minutes max
        
        Args:
            solution_id: 18-character Salesforce Solution ID
            initial_delay: Seconds to wait before first poll
            poll_interval: Initial polling interval in seconds
            max_interval: Maximum polling interval in seconds
            backoff_factor: Exponential backoff multiplier
            max_duration: Maximum total polling duration in seconds
            
        Returns:
            MigrationStatusResult with terminal status
            
        Raises:
            TimeoutError if max_duration exceeded
        """
        logger.info(f"[ApexREST] Starting migration polling for {solution_id}, "
                     f"initial_delay={initial_delay}s, max_duration={max_duration}s")
        
        # Wait initial delay before first poll
        await asyncio.sleep(initial_delay)
        
        elapsed = initial_delay
        current_interval = poll_interval
        last_status = None
        
        while elapsed < max_duration:
            result = await self.get_migration_status(solution_id)
            current_status = result.status
            
            logger.info(f"[ApexREST] Poll status={current_status}, "
                        f"subscriptionCount={result.subscriptionCount}, "
                        f"elapsed={elapsed:.0f}s")
            
            # Check for terminal status
            if current_status in TERMINAL_STATUSES:
                logger.info(f"[ApexREST] Migration reached terminal status: {current_status}")
                return result
            
            # Check for error in polling itself
            if not result.success:
                logger.warning(f"[ApexREST] Polling returned error: {result.message}")
                # Don't fail immediately on transient polling errors, retry
            
            last_status = current_status
            
            # Wait with exponential backoff
            wait_time = min(current_interval, max_interval)
            await asyncio.sleep(wait_time)
            elapsed += wait_time
            current_interval *= backoff_factor
        
        # Timeout reached
        logger.error(f"[ApexREST] Migration polling timed out after {max_duration}s, "
                     f"last_status={last_status}")
        return MigrationStatusResult(
            success=False,
            message=f"Migration polling timed out after {max_duration}s. "
                    f"Last status: {last_status}",
            solutionId=solution_id,
            status="TIMEOUT",
        )
    
    async def full_remediation(
        self,
        solution_id: str,
        skip_info_check: bool = False,
    ) -> Dict[str, Any]:
        """
        Execute full remediation workflow:
            1. GET /solution-information (check eligibility)
            2. DELETE /solution (clean SM artifacts)
            3. POST /migrate/ (initiate migration)
            4. GET /get-migration-status (poll until terminal)
            5. POST /update-post-migration-data/ (update SFDC fields)
        
        Args:
            solution_id: 18-character Salesforce Solution ID
            skip_info_check: Skip the initial solution-information check
            
        Returns:
            Dict with step results and overall success
        """
        results = {
            "solutionId": solution_id,
            "steps": [],
            "success": False,
            "failedAt": None,
            "message": None,
        }
        
        # Step 1: Check solution information (optional)
        if not skip_info_check:
            info = await self.get_solution_information(solution_id)
            results["steps"].append({
                "action": "SOLUTION_INFORMATION",
                "success": info.success,
                "message": info.message,
                "data": {
                    "solutionName": info.solutionName,
                    "migrationStatus": info.migrationStatus,
                    "macdDetails": info.macdDetails,
                },
            })
            
            if not info.success:
                results["failedAt"] = "SOLUTION_INFORMATION"
                results["message"] = f"Failed to get solution info: {info.message}"
                return results
            
            # Check MACD eligibility
            macd = info.macdDetails or {}
            if macd.get("macdBasketExists"):
                results["failedAt"] = "ELIGIBILITY_CHECK"
                results["message"] = (
                    f"Solution not eligible for remigration. "
                    f"MACD basket exists with {macd.get('macdCount', 0)} solutions."
                )
                return results
        
        # Step 2: Delete from SM Service
        delete_result = await self.delete_solution(solution_id)
        results["steps"].append({
            "action": "DELETE",
            "success": delete_result.success,
            "message": delete_result.message,
            "jobId": delete_result.jobId,
        })
        
        if not delete_result.success:
            results["failedAt"] = "DELETE"
            results["message"] = f"Delete failed: {delete_result.message}"
            return results
        
        # Step 3: Migrate to SM Service
        migrate_result = await self.migrate_solution(solution_id)
        results["steps"].append({
            "action": "MIGRATE",
            "success": migrate_result.success,
            "message": migrate_result.message,
            "jobId": migrate_result.jobId,
            "status": migrate_result.status,
        })
        
        if not migrate_result.success:
            results["failedAt"] = "MIGRATE"
            results["message"] = f"Migration failed: {migrate_result.message}"
            return results
        
        # Step 4: Poll migration status
        poll_result = await self.poll_migration_status(solution_id)
        results["steps"].append({
            "action": "POLL_STATUS",
            "success": poll_result.success and poll_result.status == "COMPLETED",
            "message": poll_result.message,
            "status": poll_result.status,
            "subscriptionCount": poll_result.subscriptionCount,
        })
        
        if poll_result.status != "COMPLETED":
            results["failedAt"] = "POLL_STATUS"
            results["message"] = (
                f"Migration did not complete successfully. "
                f"Status: {poll_result.status}, Message: {poll_result.message}"
            )
            return results
        
        # Step 5: Update post-migration data
        update_result = await self.update_post_migration_data(
            solution_id=solution_id,
            migration_status="completed",
            job_id=migrate_result.jobId,
        )
        results["steps"].append({
            "action": "UPDATE",
            "success": update_result.success,
            "message": update_result.message,
            "sfdcUpdateStatus": update_result.sfdcUpdateStatus,
            "smServiceUpdateStatus": update_result.smServiceUpdateStatus,
            "updatedFields": update_result.updatedFields,
        })
        
        if not update_result.success:
            results["failedAt"] = "UPDATE"
            results["message"] = f"Post-migration update failed: {update_result.message}"
            return results
        
        # All steps succeeded
        results["success"] = True
        results["message"] = "Full remediation completed successfully"
        results["jobId"] = migrate_result.jobId
        
        return results


# Singleton instance
apex_client = ApexRestClient()


# Convenience functions
async def get_solution_information(solution_id: str) -> SolutionInfoResponse:
    """Get solution metadata and MACD details"""
    return await apex_client.get_solution_information(solution_id)


async def delete_solution(solution_id: str) -> ApexApiResponse:
    """Delete a solution from SM Service"""
    return await apex_client.delete_solution(solution_id)


async def migrate_solution(solution_id: str) -> ApexApiResponse:
    """Migrate a solution to SM Service"""
    return await apex_client.migrate_solution(solution_id)


async def get_migration_status(solution_id: str) -> MigrationStatusResult:
    """Get current migration status"""
    return await apex_client.get_migration_status(solution_id)


async def update_post_migration_data(
    solution_id: str,
    migration_status: str = "completed",
    job_id: Optional[str] = None,
) -> UpdatePostMigrationResult:
    """Update SFDC and SM Service after migration"""
    return await apex_client.update_post_migration_data(
        solution_id=solution_id,
        migration_status=migration_status,
        job_id=job_id,
    )


async def full_remediation(solution_id: str) -> Dict[str, Any]:
    """Execute full DELETE → MIGRATE → POLL → UPDATE workflow"""
    return await apex_client.full_remediation(solution_id)