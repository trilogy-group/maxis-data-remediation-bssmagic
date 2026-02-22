"""
Pydantic models for API requests and responses.

Updated to align with the deployed Apex REST APIs at:
    /services/apexrest/api/v1/solution/*

See: solution-empty-api specs.txt for the full API specification.
"""
from pydantic import BaseModel
from typing import Literal, Optional, List, Dict, Any


# ============================================
# Legacy Models (kept for backward compatibility)
# ============================================

class RemediationRequest(BaseModel):
    solutionId: str
    action: Literal["DELETE", "MIGRATE", "UPDATE"]


class RemediationResponse(BaseModel):
    success: bool
    solutionId: str
    action: str
    jobId: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None
    compiled: Optional[bool] = None
    line: Optional[int] = None
    column: Optional[int] = None


class BulkRemediationRequest(BaseModel):
    solutionIds: List[str]
    action: Literal["DELETE", "MIGRATE", "UPDATE"]


class BulkRemediationResponse(BaseModel):
    total: int
    successful: int
    failed: int
    results: List[RemediationResponse]


class FullRemediationRequest(BaseModel):
    solutionId: str


class FullRemediationResponse(BaseModel):
    success: bool
    solutionId: str
    results: List[RemediationResponse]
    failedAt: Optional[str] = None


class SolutionStatusResponse(BaseModel):
    solution_id: str
    name: Optional[str] = None
    status: Optional[str] = None
    is_migrated: bool
    is_config_updated: bool
    external_identifier: Optional[str] = None
    path: str  # A, B, C, or NONE
    steps: List[str]


class SmartRemediationResponse(BaseModel):
    success: bool
    solutionId: str
    path: str  # A, B, C, or NONE
    steps_executed: List[str]
    results: List[RemediationResponse]
    failedAt: Optional[str] = None
    message: Optional[str] = None


# ============================================
# Apex REST API Models (Direct CloudSense API)
# Base Path: /services/apexrest/api/v1/solution
# ============================================

# --- Solution Information (GET /solution-information) ---

class MACDDetails(BaseModel):
    """MACD details from solution-information response"""
    macdBasketExists: bool
    macdSolutionIds: List[str] = []
    lastMacdDate: Optional[str] = None
    macdCount: int = 0


class SMServiceStatus(BaseModel):
    """SM Service status from solution-information response"""
    existsInSmService: bool
    smServiceId: Optional[str] = None
    lastSyncDate: Optional[str] = None


class AdditionalMetadata(BaseModel):
    """Additional metadata from solution-information response"""
    accountId: Optional[str] = None
    accountName: Optional[str] = None
    solutionDefinitionId: Optional[str] = None
    productFamily: Optional[str] = None


class SolutionInformationResponse(BaseModel):
    """
    Response from GET /solution-information.
    
    Contains solution metadata, MACD details, migration status, and SM Service status.
    The caller uses this to determine eligibility for remigration.
    """
    success: bool
    message: str
    solutionId: Optional[str] = None
    solutionName: Optional[str] = None
    externalIdentifier: Optional[str] = None
    createdBy: Optional[str] = None
    createdDate: Optional[str] = None
    migrationStatus: Optional[str] = None
    migrationDate: Optional[str] = None
    macdDetails: Optional[MACDDetails] = None
    smServiceStatus: Optional[SMServiceStatus] = None
    additionalMetadata: Optional[AdditionalMetadata] = None


# --- Delete Solution (DELETE /solution) ---

class DeleteSolutionRequest(BaseModel):
    """Request for delete API (query param, but used in gateway routing)"""
    solutionId: str


class DeleteSolutionResponse(BaseModel):
    """Response from DELETE /solution"""
    success: bool
    message: str
    solutionId: Optional[str] = None
    jobId: Optional[str] = None
    status: Optional[str] = None


# --- Migrate Solution (POST /migrate/) ---

class MigrateSolutionRequest(BaseModel):
    """Request for migrate API"""
    solutionId: str


class MigrateSolutionResponse(BaseModel):
    """Response from POST /migrate/"""
    success: bool
    message: str
    solutionId: Optional[str] = None
    jobId: Optional[str] = None
    status: Optional[str] = None


# --- Get Migration Status (GET /get-migration-status) ---

class MigrationStatusResponse(BaseModel):
    """
    Response from GET /get-migration-status.
    
    Status values:
        PENDING     - Migration initiated but not started (non-terminal)
        IN_PROGRESS - Migration currently processing (non-terminal)
        COMPLETED   - Migration completed successfully (terminal)
        FAILED      - Migration failed (terminal)
    """
    success: bool
    message: str
    solutionId: Optional[str] = None
    status: Optional[str] = None  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    subscriptionCount: Optional[int] = None


# --- Update Post Migration Data (POST /update-post-migration-data/) ---

class UpdatePostMigrationRequest(BaseModel):
    """Request for update-post-migration-data API"""
    solutionId: str
    migrationStatus: str = "completed"  # "completed", "failed", "partial"
    jobId: Optional[str] = None
    sfdcUpdates: Optional[Dict[str, Any]] = None
    smServiceData: Optional[Dict[str, Any]] = None


class UpdatePostMigrationResponse(BaseModel):
    """Response from POST /update-post-migration-data/"""
    success: bool
    message: str
    solutionId: Optional[str] = None
    sfdcUpdateStatus: Optional[str] = None  # "success", "failed", "skipped"
    smServiceUpdateStatus: Optional[str] = None  # "success", "failed", "skipped"
    updatedFields: Optional[List[str]] = None
    errors: Optional[List[Dict[str, Any]]] = None


# --- Legacy aliases (backward compatibility) ---

class ValidateRemigrationRequest(BaseModel):
    """Legacy request - now maps to GET /solution-information"""
    solutionId: str


class ValidateRemigrationResponse(BaseModel):
    """
    Legacy response for validate-remigration API.
    Now wraps SolutionInformationResponse with eligibility logic.
    """
    success: bool
    message: str
    solutionId: str
    eligible: Optional[bool] = None
    macdBasketExists: Optional[bool] = None
    macdBasketId: Optional[str] = None
    # New fields from solution-information
    solutionName: Optional[str] = None
    migrationStatus: Optional[str] = None
    migrationDate: Optional[str] = None
    macdDetails: Optional[MACDDetails] = None
    smServiceStatus: Optional[SMServiceStatus] = None
    additionalMetadata: Optional[AdditionalMetadata] = None

