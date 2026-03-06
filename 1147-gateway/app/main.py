"""
1147 Solution Empty Gateway - FastAPI Application

Uses direct Apex REST API calls to CloudSense for solution management.
Replaced Anonymous Apex execution with proper REST API calls for:
    - Structured JSON responses (no log parsing)
    - Proper audit trail
    - Async migration with status polling
    - Clear error messages

API Spec: /services/apexrest/api/v1/solution/*
"""
import asyncio
import logging
import httpx
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from app.models.schemas import (
    RemediationRequest,
    RemediationResponse,
    BulkRemediationRequest,
    BulkRemediationResponse,
    FullRemediationRequest,
    FullRemediationResponse,
    SolutionStatusResponse,
    SmartRemediationResponse,
    # Apex REST API Models
    SolutionInformationResponse,
    MACDDetails,
    SMServiceStatus,
    AdditionalMetadata,
    ValidateRemigrationRequest,
    ValidateRemigrationResponse,
    DeleteSolutionRequest,
    DeleteSolutionResponse,
    MigrateSolutionRequest,
    MigrateSolutionResponse,
    MigrationStatusResponse,
    UpdatePostMigrationRequest,
    UpdatePostMigrationResponse,
)
from app.models.patch_schemas import (
    PatchOERequest,
    PatchOEResponse
)
# Direct Apex REST API client (replaces Anonymous Apex execution)
from app.services.apex_rest_client import apex_client
# Legacy imports (kept for 1867/OE patching and legacy remediate endpoint)
from app.services.apex_executor import execute_anonymous_apex
from app.services.script_generator import generate_apex_script  # Legacy: for /api/1147/remediate
from app.auth.salesforce import get_access_token, get_instance_url
from app.services.attachment_service import fetch_attachment_for_service
from app.services.oe_patcher import analyze_and_patch_service, get_service_patch_preview
from app.services.attachment_patcher import patch_service_with_attachment_update, get_attachment_regeneration_status
from app.services.apex_oe_patcher_complete import generate_and_execute_complete_patch_apex
from app.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title="1147 Solution Empty Gateway",
    description="Executes Apex batch scripts for 1147 remediation",
    version="1.0.0"
)

# Debug: Print registered routes at startup
@app.on_event("startup")
async def log_routes():
    print("=" * 50)
    print("1147-GATEWAY REGISTERED ROUTES:")
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            print(f"  {list(route.methods)} {route.path}")
    print("=" * 50)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "1147-gateway",
        "version": "1.0.0"
    }


# ============================================
# Direct Apex REST APIs (CloudSense Solution Management)
# Base: /services/apexrest/api/v1/solution
# ============================================

@app.get("/api/1147/solution-information", response_model=SolutionInformationResponse)
async def get_solution_information(solutionId: str):
    """
    Get solution metadata, MACD details, and migration status.
    
    Calls: GET /services/apexrest/api/v1/solution/solution-information
    
    Returns full solution info that the caller uses to determine
    eligibility for remigration.
    """
    try:
        result = await apex_client.get_solution_information(solutionId)
        
        return SolutionInformationResponse(
            success=result.success,
            message=result.message,
            solutionId=result.solutionId,
            solutionName=result.solutionName,
            externalIdentifier=result.externalIdentifier,
            createdBy=result.createdBy,
            createdDate=result.createdDate,
            migrationStatus=result.migrationStatus,
            migrationDate=result.migrationDate,
            macdDetails=MACDDetails(**result.macdDetails) if result.macdDetails else None,
            smServiceStatus=SMServiceStatus(**result.smServiceStatus) if result.smServiceStatus else None,
            additionalMetadata=AdditionalMetadata(**result.additionalMetadata) if result.additionalMetadata else None,
        )
        
    except Exception as e:
        logger.exception(f"Failed to get solution information for {solutionId}")
        return SolutionInformationResponse(
            success=False,
            message=f"Failed to retrieve solution information: {str(e)}",
            solutionId=solutionId,
        )


@app.post("/api/1147/validate-remigration", response_model=ValidateRemigrationResponse)
async def validate_remigration(request: ValidateRemigrationRequest):
    """
    Validate if a solution is eligible for remigration.
    
    Calls GET /solution-information and applies eligibility logic:
    - If macdDetails.macdBasketExists is true → NOT eligible
    - Otherwise → eligible for remigration
    
    This is a wrapper around solution-information for backward compatibility.
    """
    try:
        result = await apex_client.get_solution_information(request.solutionId)
        
        if not result.success:
            return ValidateRemigrationResponse(
                success=False,
                message=result.message,
                solutionId=request.solutionId,
                eligible=None,
                macdBasketExists=None,
                macdBasketId=None,
            )
        
        # Apply eligibility logic
        macd = result.macdDetails or {}
        macd_exists = macd.get("macdBasketExists", False)
        macd_ids = macd.get("macdSolutionIds", [])
        
        if macd_exists or len(macd_ids) > 0:
            return ValidateRemigrationResponse(
                success=True,
                message=f"Solution is not eligible for remigration. "
                        f"MACD basket exists with {macd.get('macdCount', len(macd_ids))} solution(s).",
                solutionId=request.solutionId,
                eligible=False,
                macdBasketExists=True,
                macdBasketId=macd_ids[0] if macd_ids else None,
                solutionName=result.solutionName,
                migrationStatus=result.migrationStatus,
                migrationDate=result.migrationDate,
                macdDetails=MACDDetails(**macd) if macd else None,
                smServiceStatus=SMServiceStatus(**result.smServiceStatus) if result.smServiceStatus else None,
                additionalMetadata=AdditionalMetadata(**result.additionalMetadata) if result.additionalMetadata else None,
            )
        else:
            return ValidateRemigrationResponse(
                success=True,
                message="Solution is eligible for remigration. No MACD basket found.",
                solutionId=request.solutionId,
                eligible=True,
                macdBasketExists=False,
                macdBasketId=None,
                solutionName=result.solutionName,
                migrationStatus=result.migrationStatus,
                migrationDate=result.migrationDate,
                macdDetails=MACDDetails(**macd) if macd else None,
                smServiceStatus=SMServiceStatus(**result.smServiceStatus) if result.smServiceStatus else None,
                additionalMetadata=AdditionalMetadata(**result.additionalMetadata) if result.additionalMetadata else None,
            )
                
    except Exception as e:
        logger.exception(f"Validation failed for {request.solutionId}")
        return ValidateRemigrationResponse(
            success=False,
            message=f"Validation failed: {str(e)}",
            solutionId=request.solutionId,
            eligible=None,
            macdBasketExists=None,
            macdBasketId=None,
        )


@app.post("/api/1147/delete", response_model=DeleteSolutionResponse)
async def delete_solution_endpoint(request: DeleteSolutionRequest):
    """
    Delete a solution from SM Service.
    
    Calls: DELETE /services/apexrest/api/v1/solution/solution
    
    Clears any partial or inconsistent SM artifacts for clean re-migration.
    """
    try:
        result = await apex_client.delete_solution(request.solutionId)
        
        return DeleteSolutionResponse(
            success=result.success,
            message=result.message,
            solutionId=result.solutionId or request.solutionId,
            jobId=result.jobId,
            status=result.status,
        )
            
    except Exception as e:
        logger.exception(f"Delete failed for {request.solutionId}")
        return DeleteSolutionResponse(
            success=False,
            message=f"Delete failed: {str(e)}",
            solutionId=request.solutionId,
            jobId=None,
            status="failed",
        )


@app.post("/api/1147/migrate", response_model=MigrateSolutionResponse)
async def migrate_solution_endpoint(request: MigrateSolutionRequest):
    """
    Migrate a solution to SM Service.
    
    Calls: POST /services/apexrest/api/v1/solution/migrate/
    
    Returns jobId for status polling via GET /get-migration-status.
    IMPORTANT: Always call DELETE first!
    """
    try:
        result = await apex_client.migrate_solution(request.solutionId)
        
        return MigrateSolutionResponse(
            success=result.success,
            message=result.message,
            solutionId=result.solutionId or request.solutionId,
            jobId=result.jobId,
            status=result.status,
        )
            
    except Exception as e:
        logger.exception(f"Migration failed for {request.solutionId}")
        return MigrateSolutionResponse(
            success=False,
            message=f"Migration failed: {str(e)}",
            solutionId=request.solutionId,
            jobId=None,
            status="failed",
        )


@app.get("/api/1147/get-migration-status", response_model=MigrationStatusResponse)
async def get_migration_status_endpoint(solutionId: str):
    """
    Poll migration status for a solution.
    
    Calls: GET /services/apexrest/api/v1/solution/get-migration-status
    
    Status values:
        PENDING     - Not yet started
        IN_PROGRESS - Currently processing
        COMPLETED   - Successfully completed (terminal)
        FAILED      - Migration failed (terminal)
    """
    try:
        result = await apex_client.get_migration_status(solutionId)
        
        return MigrationStatusResponse(
            success=result.success,
            message=result.message,
            solutionId=result.solutionId or solutionId,
            status=result.status,
            subscriptionCount=result.subscriptionCount,
        )
        
    except Exception as e:
        logger.exception(f"Failed to get migration status for {solutionId}")
        return MigrationStatusResponse(
            success=False,
            message=f"Failed to retrieve migration status: {str(e)}",
            solutionId=solutionId,
            status=None,
            subscriptionCount=None,
        )


@app.post("/api/1147/update-post-migration-data", response_model=UpdatePostMigrationResponse)
async def update_post_migration_data_endpoint(request: UpdatePostMigrationRequest):
    """
    Update SFDC fields and SM Service data after successful migration.
    
    Calls: POST /services/apexrest/api/v1/solution/update-post-migration-data/
    
    Should be called after migration reaches COMPLETED status.
    """
    try:
        result = await apex_client.update_post_migration_data(
            solution_id=request.solutionId,
            migration_status=request.migrationStatus,
            job_id=request.jobId,
            sfdc_updates=request.sfdcUpdates,
            sm_service_data=request.smServiceData,
        )
        
        return UpdatePostMigrationResponse(
            success=result.success,
            message=result.message,
            solutionId=result.solutionId or request.solutionId,
            sfdcUpdateStatus=result.sfdcUpdateStatus,
            smServiceUpdateStatus=result.smServiceUpdateStatus,
            updatedFields=result.updatedFields,
            errors=result.errors,
        )
            
    except Exception as e:
        logger.exception(f"Update failed for {request.solutionId}")
        return UpdatePostMigrationResponse(
            success=False,
            message=f"Update failed: {str(e)}",
            solutionId=request.solutionId,
            sfdcUpdateStatus="failed",
            smServiceUpdateStatus="failed",
            updatedFields=None,
            errors=[{"target": "apex_rest_api", "message": str(e)}],
        )


# ============================================
# Legacy APIs (kept for backward compatibility)
# ============================================

@app.post("/api/1147/remediate", response_model=RemediationResponse)
async def remediate_solution(request: RemediationRequest):
    """
    Execute 1147 Solution Empty remediation via Apex batch.
    
    Actions:
    - DELETE: Remove existing partial data from Heroku
    - MIGRATE: Re-push data from Salesforce to Heroku
    - UPDATE: Update configuration metadata in Heroku
    """
    try:
        # Generate Apex script with actual Solution ID
        apex_script = generate_apex_script(
            solution_id=request.solutionId,
            action=request.action
        )
        
        # Execute via Salesforce Tooling API
        # Pass action as job_type_hint to help find the batch job ID
        result = await execute_anonymous_apex(apex_script, job_type_hint=request.action)
        
        return RemediationResponse(
            success=result["success"],
            solutionId=request.solutionId,
            action=request.action,
            jobId=result.get("jobId"),
            output=result.get("output"),
            error=result.get("error"),
            compiled=result.get("compiled"),
            line=result.get("line"),
            column=result.get("column")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/1147/remediate-bulk", response_model=BulkRemediationResponse)
async def remediate_bulk(request: BulkRemediationRequest):
    """
    Bulk remediation for multiple solutions.
    Processes sequentially with rate limiting.
    """
    results = []
    for solution_id in request.solutionIds:
        try:
            result = await remediate_solution(
                RemediationRequest(solutionId=solution_id, action=request.action)
            )
            results.append(result)
        except Exception as e:
            results.append(RemediationResponse(
                success=False,
                solutionId=solution_id,
                action=request.action,
                error=str(e)
            ))
        
        # Rate limiting: wait between executions
        if solution_id != request.solutionIds[-1]:  # Don't wait after last one
            await asyncio.sleep(settings.BATCH_DELAY_SECONDS)
    
    return BulkRemediationResponse(
        total=len(request.solutionIds),
        successful=sum(1 for r in results if r.success),
        failed=sum(1 for r in results if not r.success),
        results=results
    )


@app.post("/api/1147/remediate-full", response_model=FullRemediationResponse)
async def full_remediation(request: FullRemediationRequest):
    """
    Execute complete re-migration workflow via direct Apex REST APIs.
    
    Steps:
    1. DELETE /solution - Remove existing SM artifacts
    2. POST /migrate/ - Initiate migration
    3. GET /get-migration-status - Poll until COMPLETED/FAILED
    4. POST /update-post-migration-data/ - Update SFDC fields
    
    Uses proper status polling instead of hardcoded sleep timers.
    """
    results = []
    
    # Step 1: DELETE from SM Service
    try:
        delete_result = await apex_client.delete_solution(request.solutionId)
        results.append(RemediationResponse(
            success=delete_result.success,
            solutionId=request.solutionId,
            action="DELETE",
            jobId=delete_result.jobId,
            output=delete_result.message,
        ))
        
        if not delete_result.success:
            return FullRemediationResponse(
                success=False,
                solutionId=request.solutionId,
                results=results,
                failedAt="DELETE",
            )
        
    except Exception as e:
        logger.exception(f"DELETE failed for {request.solutionId}")
        results.append(RemediationResponse(
            success=False, solutionId=request.solutionId,
            action="DELETE", error=str(e),
        ))
        return FullRemediationResponse(
            success=False, solutionId=request.solutionId,
            results=results, failedAt="DELETE",
        )
    
    # Step 2: MIGRATE to SM Service
    try:
        migrate_result = await apex_client.migrate_solution(request.solutionId)
        results.append(RemediationResponse(
            success=migrate_result.success,
            solutionId=request.solutionId,
            action="MIGRATE",
            jobId=migrate_result.jobId,
            output=migrate_result.message,
        ))
        
        if not migrate_result.success:
            return FullRemediationResponse(
                success=False,
                solutionId=request.solutionId,
                results=results,
                failedAt="MIGRATE",
            )
        
    except Exception as e:
        logger.exception(f"MIGRATE failed for {request.solutionId}")
        results.append(RemediationResponse(
            success=False, solutionId=request.solutionId,
            action="MIGRATE", error=str(e),
        ))
        return FullRemediationResponse(
            success=False, solutionId=request.solutionId,
            results=results, failedAt="MIGRATE",
        )
    
    # Step 3: Poll migration status until terminal
    try:
        poll_result = await apex_client.poll_migration_status(request.solutionId)
        poll_success = poll_result.status == "COMPLETED"
        results.append(RemediationResponse(
            success=poll_success,
            solutionId=request.solutionId,
            action="POLL_STATUS",
            jobId=None,
            output=f"Status: {poll_result.status}, "
                   f"Subscriptions: {poll_result.subscriptionCount}, "
                   f"Message: {poll_result.message}",
        ))
        
        if not poll_success:
            return FullRemediationResponse(
                success=False,
                solutionId=request.solutionId,
                results=results,
                failedAt="POLL_STATUS",
            )
        
    except Exception as e:
        logger.exception(f"POLL_STATUS failed for {request.solutionId}")
        results.append(RemediationResponse(
            success=False, solutionId=request.solutionId,
            action="POLL_STATUS", error=str(e),
        ))
        return FullRemediationResponse(
            success=False, solutionId=request.solutionId,
            results=results, failedAt="POLL_STATUS",
        )
    
    # Step 4: UPDATE post-migration data
    try:
        update_result = await apex_client.update_post_migration_data(
            solution_id=request.solutionId,
            migration_status="completed",
            job_id=migrate_result.jobId,
        )
        results.append(RemediationResponse(
            success=update_result.success,
            solutionId=request.solutionId,
            action="UPDATE",
            jobId=None,
            output=update_result.message,
        ))
        
        return FullRemediationResponse(
            success=update_result.success,
            solutionId=request.solutionId,
            results=results,
            failedAt=None if update_result.success else "UPDATE",
        )
        
    except Exception as e:
        logger.exception(f"UPDATE failed for {request.solutionId}")
        results.append(RemediationResponse(
            success=False, solutionId=request.solutionId,
            action="UPDATE", error=str(e),
        ))
        return FullRemediationResponse(
            success=False, solutionId=request.solutionId,
            results=results, failedAt="UPDATE",
        )


@app.get("/api/1147/job/{job_id}/status")
async def get_job_status(job_id: str):
    """
    Check status of a running Apex batch job.
    TODO: Query AsyncApexJob to get batch status
    """
    # TODO: Implement AsyncApexJob query
    return {
        "jobId": job_id,
        "status": "not_implemented",
        "message": "Batch job status monitoring not yet implemented"
    }


@app.get("/api/1867/service/{service_id}/attachment")
async def get_service_attachment(service_id: str):
    """
    Fetch ProductAttributeDetails.json attachment for a service.
    
    Returns:
    - Parsed JSON content of the OE data
    - Analysis of missing mandatory fields based on service type
    - has1867Issue: boolean indicating if mandatory fields are missing
    
    Used for 1867 "Partial Data Missing" detection and inspection.
    """
    try:
        result = await fetch_attachment_for_service(service_id)
        
        if not result.get('success', False):
            raise HTTPException(
                status_code=404 if 'not found' in result.get('error', '').lower() else 500,
                detail=result.get('error', 'Unknown error')
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/1867/service/{service_id}/patch-preview")
async def get_patch_preview(service_id: str):
    """
    Preview what will be patched for a service (dry run).
    
    Returns:
    - Missing fields
    - Fields that can be auto-patched with their values
    - Fields that cannot be patched (missing Salesforce data)
    - Warnings
    
    Used to show users what will happen before clicking "Patch OE" button.
    """
    try:
        result = await get_service_patch_preview(service_id)
        
        if not result.get('success', False):
            raise HTTPException(
                status_code=404 if 'not found' in result.get('error', '').lower() else 500,
                detail=result.get('error', 'Unknown error')
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/1867/patch", response_model=PatchOEResponse)
async def patch_service_oe(request: PatchOERequest):
    """
    Automatically patch missing OE fields for a service.
    
    Process:
    1. Fetch service data from Salesforce
    2. Read OE JSON from attachment
    3. Identify missing fields
    4. Fetch correct values from Salesforce
    5. Generate and execute Apex script
    6. CloudSense API updates OE
    
    No manual attachment editing required!
    """
    try:
        result = await analyze_and_patch_service(
            service_id=request.serviceId,
            dry_run=request.dryRun
        )
        
        if not result.get('success', False) and not request.dryRun:
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Patch failed')
            )
        
        return PatchOEResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/1867/patch-complete")
async def patch_service_complete(request: PatchOERequest):
    """
    COMPLETE patch: Updates BOTH CloudSense DB AND attachment.
    
    Uses compact Apex script that:
    1. Calls cssmgnt.API_1.updateOEData() → Updates CloudSense internal DB
    2. Updates Salesforce attachment → Updates verification/inspection
    
    Both locations are updated in one operation!
    """
    from app.services.apex_compact_patcher import patch_complete_compact
    
    try:
        # Use fields provided by UI
        if not request.fieldsToPatch or len(request.fieldsToPatch) == 0:
            raise HTTPException(
                status_code=400,
                detail='No fields provided to patch'
            )
        
        fields_to_patch = [
            {
                'fieldName': f.fieldName,
                'value': f.value,
                'label': f.label or f.value
            }
            for f in request.fieldsToPatch
        ]
        
        # Use compact patcher (fits within URL limits)
        result = await patch_complete_compact(
            service_id=request.serviceId,
            fields_to_patch=fields_to_patch
        )
        
        if not result.get('success'):
            error_detail = result.get('error', 'Apex execution failed')
            if result.get('line'):
                error_detail += f" (line {result.get('line')}, col {result.get('column')})"
            raise HTTPException(
                status_code=500,
                detail=error_detail
            )
        
        return {
            'success': True,
            'serviceId': request.serviceId,
            'serviceType': request.serviceType,
            'patchedFields': result.get('patchedFields', fields_to_patch),
            'cloudsenseDBUpdated': result.get('cloudsenseDBUpdated', True),
            'attachmentUpdated': result.get('attachmentUpdated', True),
            'apexExecuted': True,
            'scriptSize': result.get('scriptSize')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/1867/patch-with-attachment-update")
async def patch_service_with_attachment(request: PatchOERequest):
    """
    Patch OE and UPDATE the attachment file (recommended method).
    
    This replicates the manual workflow:
    1. Fetch current ProductAttributeDetails.json
    2. Create backup as ProductAttributeDetails_old.json
    3. Patch JSON in memory
    4. Delete old attachment
    5. Upload new attachment with patched data
    
    This ensures:
    - Attachment LastModifiedDate is updated
    - Verification via attachment inspection works
    - No dependency on CloudSense auto-regeneration
    """
    try:
        # Use fields provided by UI (no Salesforce fetch needed!)
        if request.fieldsToPatch and len(request.fieldsToPatch) > 0:
            # UI provided the fields to patch directly from service x_ fields!
            fields_to_patch = [
                {
                    'fieldName': f.fieldName,
                    'value': f.value,
                    'label': f.label or f.value
                }
                for f in request.fieldsToPatch
            ]
            service_type = request.serviceType
        else:
            # Fallback: get patch preview if UI didn't provide data
            preview_result = await get_service_patch_preview(request.serviceId)
            
            if not preview_result.get('success'):
                raise HTTPException(
                    status_code=404,
                    detail=preview_result.get('error', 'Service not found')
                )
            
            if not preview_result.get('canPatch'):
                return {
                    'success': False,
                    'serviceId': request.serviceId,
                    'error': 'No fields can be auto-patched',
                    'warnings': preview_result.get('warnings', [])
                }
            
            fields_to_patch = preview_result.get('patchableFields', [])
            service_type = preview_result.get('serviceType')
        
        # If dry run, just return what would be patched
        if request.dryRun:
            return {
                'success': True,
                'serviceId': request.serviceId,
                'serviceType': service_type,
                'patchedFields': fields_to_patch,
                'dryRun': True,
                'apexExecuted': False
            }
        
        # Execute patch with attachment update using provided field data
        result = await patch_service_with_attachment_update(
            service_id=request.serviceId,
            fields_to_patch=fields_to_patch
        )
        
        if not result.get('success'):
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Attachment patch failed')
            )
        
        return {
            'success': True,
            'serviceId': request.serviceId,
            'serviceType': service_type,
            'patchedFields': result.get('patchedFields', fields_to_patch),
            'dryRun': False,
            'apexExecuted': False,  # Used REST API instead
            'attachmentUpdated': result.get('attachmentUpdated', False),
            'backupCreated': result.get('backupCreated', False),
            'newAttachmentId': result.get('newAttachmentId'),
            'warnings': result.get('warnings', [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/1867/service/{service_id}/verify-oe")
async def verify_service_oe_data(service_id: str, fields: str = None):
    """
    Verify OE data in CloudSense internal database (Heroku).
    
    This API checks the actual CloudSense OE database via cssmgnt.API_1.getOEData()
    to confirm that patched fields are properly stored in the internal DB.
    
    Query params:
        fields: Comma-separated list of fields to check (optional)
                e.g., "BillingAccount,PICEmail"
    
    Returns:
        - oeDataFound: bool
        - fields: dict of field name -> {value, displayValue, found}
        - componentsCount: int
        - attributesCount: int
    
    Used for double-checking after patch-complete to verify DB update.
    """
    from app.services.oe_verification_service import verify_oe_data
    
    try:
        fields_to_check = None
        if fields:
            # Convert field names to OE format (with spaces)
            field_mapping = {
                'BillingAccount': 'Billing Account',
                'PICEmail': 'PIC Email',
                'ReservedNumber': 'Reserved Number',
                'NumberStatus': 'Number Status',
                'eSMSUserName': 'eSMSUserName'
            }
            fields_to_check = [
                field_mapping.get(f.strip(), f.strip()) 
                for f in fields.split(',')
            ]
        
        result = await verify_oe_data(service_id, fields_to_check)
        
        if not result.get('success'):
            raise HTTPException(
                status_code=404 if 'not found' in result.get('error', '').lower() else 500,
                detail=result.get('error', 'Verification failed')
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/1147/solution/{solution_id}/status", response_model=SolutionStatusResponse)
async def check_solution_status(solution_id: str):
    """
    Check solution status and determine which remediation path is needed.
    
    Uses GET /solution-information to determine path:
    - A: DELETE → MIGRATE → POLL → UPDATE (needs re-migration)
    - B: MIGRATE → POLL → UPDATE (not migrated yet)
    - NONE: No action needed or MACD exists
    """
    try:
        info = await apex_client.get_solution_information(solution_id)
        
        if not info.success:
            raise HTTPException(status_code=404, detail=info.message)
        
        # Determine path from solution information
        macd = info.macdDetails or {}
        sm_status = info.smServiceStatus or {}
        migration_status = info.migrationStatus or ""
        exists_in_sm = sm_status.get("existsInSmService", False)
        
        if macd.get("macdBasketExists"):
            path = "NONE"
            steps = []
        elif migration_status == "Migrated" and exists_in_sm:
            path = "A"
            steps = ["DELETE", "MIGRATE", "POLL_STATUS", "UPDATE"]
        elif not exists_in_sm:
            path = "B"
            steps = ["MIGRATE", "POLL_STATUS", "UPDATE"]
        else:
            path = "A"
            steps = ["DELETE", "MIGRATE", "POLL_STATUS", "UPDATE"]
        
        return SolutionStatusResponse(
            solution_id=solution_id,
            name=info.solutionName,
            status=migration_status,
            is_migrated=migration_status == "Migrated",
            is_config_updated=exists_in_sm,
            external_identifier=info.externalIdentifier,
            path=path,
            steps=steps,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/apex/execute")
async def execute_apex(
    request: dict,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
):
    """
    Execute arbitrary Anonymous Apex via Salesforce Tooling API.
    
    SECURITY: Requires valid X-API-Key header.
    
    Body:
        script: The Apex code to execute
    
    Returns:
        success: bool
        output: Apex debug log output
        error: Error message if failed
    """
    # Validate API key
    if not x_api_key or x_api_key != settings.API_KEY:
        raise HTTPException(
            status_code=401, 
            detail="Unauthorized: Invalid or missing X-API-Key header"
        )
    
    try:
        apex_script = request.get('script')
        if not apex_script:
            raise HTTPException(status_code=400, detail="Missing 'script' in request body")
        
        result = await execute_anonymous_apex(apex_script)
        
        return {
            "success": result.get("success", False),
            "output": result.get("output"),
            "error": result.get("error"),
            "compiled": result.get("compiled"),
            "line": result.get("line"),
            "column": result.get("column")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/soql/query")
async def execute_soql_query(
    request: dict,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
):
    """
    Execute a SOQL query against Salesforce.
    
    SECURITY: Requires valid X-API-Key header.
    
    Body:
        query: The SOQL query to execute
    
    Returns:
        success: bool
        records: Array of records
        totalSize: Total number of records
    """
    # Validate API key
    if not x_api_key or x_api_key != settings.API_KEY:
        raise HTTPException(
            status_code=401, 
            detail="Unauthorized: Invalid or missing X-API-Key header"
        )
    
    try:
        soql = request.get('query')
        if not soql:
            raise HTTPException(status_code=400, detail="Missing 'query' in request body")
        
        # Get Salesforce credentials
        access_token = await get_access_token()
        instance_url = await get_instance_url()
        
        # Execute SOQL query
        url = f"{instance_url}/services/data/v59.0/query/"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                params={"q": soql},
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "records": result.get("records", []),
                    "totalSize": result.get("totalSize", 0),
                    "done": result.get("done", True)
                }
            else:
                return {
                    "success": False,
                    "error": f"SOQL query failed: {response.status_code} - {response.text}",
                    "records": [],
                    "totalSize": 0
                }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/1147/remediate-smart", response_model=SmartRemediationResponse)
async def smart_remediation(request: FullRemediationRequest):
    """
    Smart remediation using direct Apex REST APIs with proper status polling.
    
    Uses GET /solution-information to determine the correct path:
    - Path A: DELETE → MIGRATE → POLL → UPDATE (needs full re-migration)
    - Path B: MIGRATE → POLL → UPDATE (just needs migration)
    - Path C: UPDATE only (migrated but config not synced)
    - NONE: Already fixed, no action needed
    
    Replaces hardcoded sleep timers with proper migration status polling.
    """
    try:
        # Get solution information to determine path
        info = await apex_client.get_solution_information(request.solutionId)
        
        if not info.success:
            raise HTTPException(
                status_code=404 if "not found" in info.message.lower() else 500,
                detail=info.message,
            )
        
        # Determine path based on solution state
        macd = info.macdDetails or {}
        sm_status = info.smServiceStatus or {}
        
        # Check MACD eligibility first
        if macd.get("macdBasketExists"):
            return SmartRemediationResponse(
                success=False,
                solutionId=request.solutionId,
                path="INELIGIBLE",
                steps_executed=[],
                results=[],
                message=f"Solution not eligible for remigration. "
                        f"MACD basket exists with {macd.get('macdCount', 0)} solution(s).",
            )
        
        # Determine path from migration status
        migration_status = info.migrationStatus or ""
        exists_in_sm = sm_status.get("existsInSmService", False)
        
        if migration_status == "Migrated" and exists_in_sm:
            # Already migrated - might need re-migration (Path A)
            path = "A"
            steps = ["DELETE", "MIGRATE", "POLL_STATUS", "UPDATE"]
        elif migration_status == "Not Migrated" or not exists_in_sm:
            # Not migrated yet (Path B)
            path = "B"
            steps = ["MIGRATE", "POLL_STATUS", "UPDATE"]
        else:
            # Default: full re-migration path (safest)
            path = "A"
            steps = ["DELETE", "MIGRATE", "POLL_STATUS", "UPDATE"]
        
        logger.info(f"[Smart] Solution {request.solutionId}: path={path}, "
                     f"migrationStatus={migration_status}, existsInSm={exists_in_sm}")
        
        results = []
        steps_executed = []
        
        for step in steps:
            try:
                if step == "DELETE":
                    result = await apex_client.delete_solution(request.solutionId)
                    results.append(RemediationResponse(
                        success=result.success,
                        solutionId=request.solutionId,
                        action="DELETE",
                        jobId=result.jobId,
                        output=result.message,
                    ))
                    steps_executed.append("DELETE")
                    
                    if not result.success:
                        return SmartRemediationResponse(
                            success=False,
                            solutionId=request.solutionId,
                            path=path,
                            steps_executed=steps_executed,
                            results=results,
                            failedAt="DELETE",
                            message=f"Delete failed: {result.message}",
                        )
                
                elif step == "MIGRATE":
                    result = await apex_client.migrate_solution(request.solutionId)
                    results.append(RemediationResponse(
                        success=result.success,
                        solutionId=request.solutionId,
                        action="MIGRATE",
                        jobId=result.jobId,
                        output=result.message,
                    ))
                    steps_executed.append("MIGRATE")
                    
                    if not result.success:
                        return SmartRemediationResponse(
                            success=False,
                            solutionId=request.solutionId,
                            path=path,
                            steps_executed=steps_executed,
                            results=results,
                            failedAt="MIGRATE",
                            message=f"Migration failed: {result.message}",
                        )
                
                elif step == "POLL_STATUS":
                    poll_result = await apex_client.poll_migration_status(request.solutionId)
                    poll_success = poll_result.status == "COMPLETED"
                    results.append(RemediationResponse(
                        success=poll_success,
                        solutionId=request.solutionId,
                        action="POLL_STATUS",
                        output=f"Status: {poll_result.status}, "
                               f"Subscriptions: {poll_result.subscriptionCount}",
                    ))
                    steps_executed.append("POLL_STATUS")
                    
                    if not poll_success:
                        return SmartRemediationResponse(
                            success=False,
                            solutionId=request.solutionId,
                            path=path,
                            steps_executed=steps_executed,
                            results=results,
                            failedAt="POLL_STATUS",
                            message=f"Migration did not complete: {poll_result.status} - {poll_result.message}",
                        )
                
                elif step == "UPDATE":
                    # Find the jobId from migrate step
                    migrate_job_id = None
                    for r in results:
                        if r.action == "MIGRATE" and r.jobId:
                            migrate_job_id = r.jobId
                    
                    result = await apex_client.update_post_migration_data(
                        solution_id=request.solutionId,
                        migration_status="completed",
                        job_id=migrate_job_id,
                    )
                    results.append(RemediationResponse(
                        success=result.success,
                        solutionId=request.solutionId,
                        action="UPDATE",
                        output=result.message,
                    ))
                    steps_executed.append("UPDATE")
                    
                    if not result.success:
                        return SmartRemediationResponse(
                            success=False,
                            solutionId=request.solutionId,
                            path=path,
                            steps_executed=steps_executed,
                            results=results,
                            failedAt="UPDATE",
                            message=f"Post-migration update failed: {result.message}",
                        )
                    
            except Exception as e:
                logger.exception(f"Exception at step {step} for {request.solutionId}")
                results.append(RemediationResponse(
                    success=False,
                    solutionId=request.solutionId,
                    action=step,
                    error=str(e),
                ))
                return SmartRemediationResponse(
                    success=False,
                    solutionId=request.solutionId,
                    path=path,
                    steps_executed=steps_executed,
                    results=results,
                    failedAt=step,
                    message=f"Exception at step {step}: {str(e)}",
                )
        
        return SmartRemediationResponse(
            success=True,
            solutionId=request.solutionId,
            path=path,
            steps_executed=steps_executed,
            results=results,
            message=f"Successfully completed Path {path} remediation",
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Smart remediation failed for {request.solutionId}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# WorkOrder Management APIs (TMF697)
# ============================================
from app.services.work_order_db import (
    list_schedules, get_schedule, create_schedule, update_schedule, delete_schedule,
    list_work_orders, get_work_order, create_work_order, update_work_order, delete_work_order,
    close_pool
)
from pydantic import BaseModel
from typing import Dict, Any, List

class WorkOrderScheduleCreate(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    isActive: Optional[bool] = True
    category: str
    recurrencePattern: Optional[str] = "daily"
    recurrenceDays: Optional[List[int]] = None
    windowStartTime: Optional[str] = "00:00"
    windowEndTime: Optional[str] = "06:00"
    maxBatchSize: int = 100
    selectionCriteria: Optional[Dict[str, Any]] = None

class WorkOrderScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    isActive: Optional[bool] = None
    recurrencePattern: Optional[str] = None
    recurrenceDays: Optional[List[int]] = None
    windowStartTime: Optional[str] = None
    windowEndTime: Optional[str] = None
    maxBatchSize: Optional[int] = None
    selectionCriteria: Optional[Dict[str, Any]] = None

class WorkOrderCreate(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    category: str
    state: Optional[str] = "pending"
    priority: Optional[int] = 5
    requestedQuantity: int = 0
    x_recurrencePattern: Optional[str] = "once"
    x_isRecurrent: Optional[bool] = False
    x_parentScheduleId: Optional[str] = None
    characteristic: Optional[List[Dict[str, Any]]] = None

class WorkOrderUpdate(BaseModel):
    state: Optional[str] = None
    actualQuantity: Optional[int] = None
    x_summary: Optional[Dict[str, Any]] = None
    completionDate: Optional[str] = None


@app.get("/api/workOrder/schedule")
async def api_list_schedules(
    category: Optional[str] = None,
    isActive: Optional[bool] = None,
    limit: int = 100
):
    """List work order schedules"""
    try:
        schedules = await list_schedules(category=category, is_active=isActive, limit=limit)
        return schedules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/workOrder/schedule/{schedule_id}")
async def api_get_schedule(schedule_id: str):
    """Get a schedule by ID"""
    schedule = await get_schedule(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@app.post("/api/workOrder/schedule", status_code=201)
async def api_create_schedule(schedule: WorkOrderScheduleCreate):
    """Create a new schedule"""
    try:
        result = await create_schedule(schedule.model_dump(exclude_none=True))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/workOrder/schedule/{schedule_id}")
async def api_update_schedule(schedule_id: str, updates: WorkOrderScheduleUpdate):
    """Update a schedule"""
    existing = await get_schedule(schedule_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    try:
        result = await update_schedule(schedule_id, updates.model_dump(exclude_none=True))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/workOrder/schedule/{schedule_id}", status_code=204)
async def api_delete_schedule(schedule_id: str):
    """Delete a schedule"""
    deleted = await delete_schedule(schedule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return None


@app.get("/api/workOrder")
async def api_list_work_orders(
    category: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 100
):
    """List work orders"""
    try:
        orders = await list_work_orders(category=category, state=state, limit=limit)
        return orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/workOrder/{work_order_id}")
async def api_get_work_order(work_order_id: str):
    """Get a work order by ID"""
    order = await get_work_order(work_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Work order not found")
    return order


@app.post("/api/workOrder", status_code=201)
async def api_create_work_order(work_order: WorkOrderCreate):
    """Create a new work order"""
    try:
        result = await create_work_order(work_order.model_dump(exclude_none=True))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/workOrder/{work_order_id}")
async def api_update_work_order(work_order_id: str, updates: WorkOrderUpdate):
    """Update a work order"""
    existing = await get_work_order(work_order_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    try:
        result = await update_work_order(work_order_id, updates.model_dump(exclude_none=True))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/workOrder/{work_order_id}", status_code=204)
async def api_delete_work_order(work_order_id: str):
    """Delete a work order"""
    deleted = await delete_work_order(work_order_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Work order not found")
    return None


@app.on_event("shutdown")
async def shutdown():
    """Close database pool on shutdown"""
    await close_pool()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )

