"""
Data models for the Batch Orchestrator.
Mirrors the BatchJob/BatchSchedule API entities.
"""

from datetime import datetime, time
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# =============================================================================
# Enums
# =============================================================================

class BatchJobState(str, Enum):
    """BatchJob lifecycle states."""
    PENDING = "pending"
    OPEN = "open"
    IN_PROGRESS = "inProgress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class RemediationState(str, Enum):
    """Per-solution remediation states (from LLD Section 6.2.4)."""
    DETECTED = "DETECTED"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    DELETING_SM_DATA = "DELETING_SM_DATA"
    DELETE_FAILED = "DELETE_FAILED"
    MIGRATING = "MIGRATING"
    MIGRATION_FAILED = "MIGRATION_FAILED"
    WAITING_CONFIRMATION = "WAITING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    POST_UPDATE = "POST_UPDATE"
    POST_UPDATE_FAILED = "POST_UPDATE_FAILED"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


class RecurrencePattern(str, Enum):
    """Schedule recurrence patterns."""
    ONCE = "once"
    DAILY = "daily"
    WEEKDAYS = "weekdays"
    WEEKLY = "weekly"
    CUSTOM = "custom"


# =============================================================================
# State Machine: Valid Transitions
# =============================================================================

VALID_TRANSITIONS: dict[RemediationState, list[RemediationState]] = {
    RemediationState.DETECTED: [RemediationState.VALIDATING],
    RemediationState.VALIDATING: [
        RemediationState.VALIDATED,
        RemediationState.SKIPPED,      # MACD exists
        RemediationState.FAILED,       # Validation error
    ],
    RemediationState.VALIDATED: [RemediationState.DELETING_SM_DATA],
    RemediationState.DELETING_SM_DATA: [
        RemediationState.MIGRATING,
        RemediationState.DELETE_FAILED,
    ],
    RemediationState.DELETE_FAILED: [RemediationState.FAILED],
    RemediationState.MIGRATING: [
        RemediationState.WAITING_CONFIRMATION,
        RemediationState.MIGRATION_FAILED,
    ],
    RemediationState.MIGRATION_FAILED: [RemediationState.FAILED],
    RemediationState.WAITING_CONFIRMATION: [
        RemediationState.CONFIRMED,
        RemediationState.MIGRATION_FAILED,
    ],
    RemediationState.CONFIRMED: [RemediationState.POST_UPDATE],
    RemediationState.POST_UPDATE: [
        RemediationState.COMPLETED,
        RemediationState.POST_UPDATE_FAILED,
    ],
    RemediationState.POST_UPDATE_FAILED: [RemediationState.FAILED],
    # Terminal states have no valid transitions
    RemediationState.COMPLETED: [],
    RemediationState.SKIPPED: [],
    RemediationState.FAILED: [],
}

TERMINAL_STATES = {RemediationState.COMPLETED, RemediationState.SKIPPED, RemediationState.FAILED}


# =============================================================================
# API Models
# =============================================================================

class BatchJobSummary(BaseModel):
    """Summary statistics for a batch job."""
    total: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
    pending: int = 0


class SolutionResult(BaseModel):
    """Result of processing a single solution."""
    solution_id: str
    solution_name: Optional[str] = None
    final_state: RemediationState
    state_history: list[tuple[str, str, str]] = Field(default_factory=list)  # (from, to, reason)
    error: Optional[str] = None
    duration_seconds: float = 0.0


class BatchJob(BaseModel):
    """Mirrors the TMF API BatchJob entity."""
    id: str
    name: str
    description: Optional[str] = None
    state: BatchJobState = BatchJobState.PENDING
    category: str = "SolutionEmpty"
    priority: int = 5
    requested_quantity: int = 0
    actual_quantity: int = 0
    x_summary: BatchJobSummary = Field(default_factory=BatchJobSummary)
    x_current_item_id: Optional[str] = None
    x_current_item_state: Optional[str] = None
    x_configuration: dict = Field(default_factory=dict)
    x_last_error: Optional[str] = None
    x_parent_schedule_id: Optional[str] = None
    x_execution_number: int = 1
    creation_date: Optional[datetime] = None
    last_update: Optional[datetime] = None


class BatchSchedule(BaseModel):
    """Mirrors the TMF API BatchSchedule entity."""
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool = True
    category: str = "SolutionEmpty"
    recurrence_pattern: RecurrencePattern = RecurrencePattern.DAILY
    window_start_time: time = time(0, 0)
    window_end_time: time = time(6, 0)
    timezone: str = "UTC"
    max_batch_size: int = 100
    selection_criteria: dict = Field(default_factory=dict)
    total_executions: int = 0
    successful_executions: int = 0
    failed_executions: int = 0
    next_execution_date: Optional[datetime] = None
    last_execution_date: Optional[datetime] = None


# =============================================================================
# Module 1867: OE Partial Data Missing
# =============================================================================

class OERemediationState(str, Enum):
    """Per-service OE remediation states (Module 1867)."""
    DETECTED = "DETECTED"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    NOT_IMPACTED = "NOT_IMPACTED"
    ANALYZING = "ANALYZING"
    ATTACHMENT_UPDATED = "ATTACHMENT_UPDATED"
    REMEDIATION_STARTED = "REMEDIATION_STARTED"
    REMEDIATED = "REMEDIATED"
    PARTIALLY_REMEDIATED = "PARTIALLY_REMEDIATED"
    ENRICHMENT_UNAVAILABLE = "ENRICHMENT_UNAVAILABLE"
    ATTACHMENT_CORRUPT = "ATTACHMENT_CORRUPT"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


OE_VALID_TRANSITIONS: dict[OERemediationState, list[OERemediationState]] = {
    OERemediationState.DETECTED: [OERemediationState.VALIDATING],
    OERemediationState.VALIDATING: [
        OERemediationState.VALIDATED,
        OERemediationState.SKIPPED,
        OERemediationState.FAILED,
    ],
    OERemediationState.VALIDATED: [
        OERemediationState.ANALYZING,
        OERemediationState.NOT_IMPACTED,
    ],
    OERemediationState.ANALYZING: [
        OERemediationState.ATTACHMENT_UPDATED,
        OERemediationState.NOT_IMPACTED,
        OERemediationState.FAILED,
    ],
    OERemediationState.NOT_IMPACTED: [],
    OERemediationState.ATTACHMENT_UPDATED: [
        OERemediationState.REMEDIATION_STARTED,
        OERemediationState.FAILED,
    ],
    OERemediationState.REMEDIATION_STARTED: [
        OERemediationState.REMEDIATED,
        OERemediationState.FAILED,
    ],
    OERemediationState.REMEDIATED: [],
    OERemediationState.PARTIALLY_REMEDIATED: [
        OERemediationState.REMEDIATED,
        OERemediationState.PARTIALLY_REMEDIATED,
        OERemediationState.FAILED,
    ],
    OERemediationState.ENRICHMENT_UNAVAILABLE: [
        OERemediationState.REMEDIATED,
        OERemediationState.PARTIALLY_REMEDIATED,
        OERemediationState.ENRICHMENT_UNAVAILABLE,
        OERemediationState.FAILED,
    ],
    OERemediationState.ATTACHMENT_CORRUPT: [
        OERemediationState.REMEDIATED,
        OERemediationState.ATTACHMENT_CORRUPT,
    ],
    OERemediationState.SKIPPED: [],
    OERemediationState.FAILED: [],
}

OE_TERMINAL_STATES = {
    OERemediationState.REMEDIATED,
    OERemediationState.NOT_IMPACTED,
    OERemediationState.SKIPPED,
    OERemediationState.FAILED,
    OERemediationState.ATTACHMENT_CORRUPT,
}


class OEResult(BaseModel):
    """Result of processing a single service for OE remediation."""
    service_id: str
    service_name: Optional[str] = None
    service_type: Optional[str] = None
    final_state: OERemediationState
    fields_patched: list[str] = Field(default_factory=list)
    unresolved_fields: list[str] = Field(default_factory=list)
    failure_stage: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0


class OEBatchJobSummary(BaseModel):
    """Summary statistics for an OE batch job."""
    total: int = 0
    remediated: int = 0
    partially_remediated: int = 0
    enrichment_unavailable: int = 0
    attachment_corrupt: int = 0
    not_impacted: int = 0
    skipped: int = 0
    failed: int = 0
    pending: int = 0


# =============================================================================
# Module IoT QBS: Service-to-PC Mismatch Remediation
# =============================================================================

class IoTQBSRemediationState(str, Enum):
    """Per-orchestration remediation states (IoT QBS module).

    State machine (from LLD v2 Section 6.4):
    RECEIVED -> LOADING_DATA -> VALIDATING -> SAFE_TO_PATCH -> PATCHING
    -> REVALIDATING -> RELEASING -> RELEASED

    FAILED is reachable from VALIDATING, PATCHING, REVALIDATING, RELEASING.
    """
    RECEIVED = "RECEIVED"
    LOADING_DATA = "LOADING_DATA"
    VALIDATING = "VALIDATING"
    SAFE_TO_PATCH = "SAFE_TO_PATCH"
    PATCHING = "PATCHING"
    REVALIDATING = "REVALIDATING"
    RELEASING = "RELEASING"
    RELEASED = "RELEASED"
    FAILED = "FAILED"


QBS_VALID_TRANSITIONS: dict[IoTQBSRemediationState, list[IoTQBSRemediationState]] = {
    IoTQBSRemediationState.RECEIVED: [IoTQBSRemediationState.LOADING_DATA],
    IoTQBSRemediationState.LOADING_DATA: [
        IoTQBSRemediationState.VALIDATING,
        IoTQBSRemediationState.FAILED,
    ],
    IoTQBSRemediationState.VALIDATING: [
        IoTQBSRemediationState.SAFE_TO_PATCH,
        IoTQBSRemediationState.RELEASING,       # all services already correct
        IoTQBSRemediationState.FAILED,           # unsafe scenario detected
    ],
    IoTQBSRemediationState.SAFE_TO_PATCH: [
        IoTQBSRemediationState.PATCHING,
    ],
    IoTQBSRemediationState.PATCHING: [
        IoTQBSRemediationState.REVALIDATING,
        IoTQBSRemediationState.FAILED,           # patch API error
    ],
    IoTQBSRemediationState.REVALIDATING: [
        IoTQBSRemediationState.RELEASING,
        IoTQBSRemediationState.FAILED,           # remaining issues found
    ],
    IoTQBSRemediationState.RELEASING: [
        IoTQBSRemediationState.RELEASED,
        IoTQBSRemediationState.FAILED,           # release API error
    ],
    IoTQBSRemediationState.RELEASED: [],
    IoTQBSRemediationState.FAILED: [],
}

QBS_TERMINAL_STATES = {
    IoTQBSRemediationState.RELEASED,
    IoTQBSRemediationState.FAILED,
}

# OE attribute name -> Salesforce service field API name
QBS_OE_FIELD_MAPPING: dict[str, str] = {
    "MSISDN": "External_ID__c",
    "APN Name": "APN_Name__c",
    "APN Type": "APN_Adress_Type__c",
    "Billing Account": "Billing_Account__c",
}

# Config attribute name -> Salesforce service field API name
# These are blocked until getConfigurations returns data (configData empty in sandbox)
QBS_CONFIG_FIELD_MAPPING: dict[str, str] = {
    "PriceItemId": "Commercial_Product__c",
    "Plan": "Commitment__c",
    "ContractTerm": "Contract_Term__c",
}


class ValidationFinding(BaseModel):
    """A single mismatch finding for one service."""
    service_id: str
    sim_serial_number: Optional[str] = None
    current_pc_id: Optional[str] = None
    correct_pc_id: Optional[str] = None
    rule: int = 1  # 1 = wrong PC linkage, 2 = wrong field values
    field_mismatches: dict[str, dict] = Field(default_factory=dict)
    # field_mismatches: { "APN_Name__c": {"current": "X", "expected": "Y"} }


class IoTQBSSafetyCheck(BaseModel):
    """Result of safety validation before patching."""
    orphan_sims: list[str] = Field(default_factory=list)
    duplicate_sims: list[str] = Field(default_factory=list)
    empty_oe_pcs: list[str] = Field(default_factory=list)
    is_safe: bool = True


class IoTQBSResult(BaseModel):
    """Result of processing a single orchestration for IoT QBS remediation."""
    orchestration_process_id: str
    order_id: Optional[str] = None
    final_state: IoTQBSRemediationState
    findings: list[ValidationFinding] = Field(default_factory=list)
    safety_check: Optional[IoTQBSSafetyCheck] = None
    patched_services: list[str] = Field(default_factory=list)
    state_history: list[tuple[str, str, str]] = Field(default_factory=list)
    failure_stage: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0
    service_count: int = 0
    pc_count: int = 0
    mismatch_count: int = 0


class IoTQBSBatchSummary(BaseModel):
    """Summary statistics for an IoT QBS batch run."""
    total: int = 0
    released: int = 0
    failed: int = 0
    pending: int = 0


# =============================================================================
# Module IoT QBS: API Request/Response Models
# =============================================================================


class IoTQBSOrchestrationSummary(BaseModel):
    """Summary of a single held orchestration from the detect endpoint."""
    orchestration_process_id: str
    name: str = ""
    order_id: str = ""
    created_date: str = ""
    pc_count: int = 0
    service_count: int = 0
    mismatch_count: int = 0
    is_safe: bool = False


class IoTQBSDetectRequest(BaseModel):
    """Request to discover held IoT orchestrations."""
    max_count: int = 50


class IoTQBSDetectResponse(BaseModel):
    """Response from the IoT QBS detect endpoint."""
    orchestrations: list[IoTQBSOrchestrationSummary] = Field(default_factory=list)
    total_found: int = 0


class IoTQBSSingleRemediateRequest(BaseModel):
    """Request to remediate a single IoT QBS orchestration."""
    dry_run: bool = False


class IoTQBSSingleRemediateResponse(BaseModel):
    """Response from single IoT QBS remediation."""
    success: bool
    result: IoTQBSResult
    message: str = ""


class IoTQBSBatchRemediateRequest(BaseModel):
    """Request to batch-remediate multiple IoT QBS orchestrations."""
    orchestration_ids: list[str] = Field(default_factory=list)
    max_count: Optional[int] = None
    dry_run: bool = False


class IoTQBSBatchRemediateResponse(BaseModel):
    """Response from batch IoT QBS remediation."""
    message: str = ""
    results: list[IoTQBSResult] = Field(default_factory=list)
    summary: IoTQBSBatchSummary = Field(default_factory=IoTQBSBatchSummary)
