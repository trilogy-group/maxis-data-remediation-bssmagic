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
    OERemediationState.SKIPPED: [],
    OERemediationState.FAILED: [],
}

OE_TERMINAL_STATES = {
    OERemediationState.REMEDIATED,
    OERemediationState.NOT_IMPACTED,
    OERemediationState.SKIPPED,
    OERemediationState.FAILED,
}


class OEResult(BaseModel):
    """Result of processing a single service for OE remediation."""
    service_id: str
    service_name: Optional[str] = None
    service_type: Optional[str] = None
    final_state: OERemediationState
    fields_patched: list[str] = Field(default_factory=list)
    failure_stage: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0


class OEBatchJobSummary(BaseModel):
    """Summary statistics for an OE batch job."""
    total: int = 0
    remediated: int = 0
    not_impacted: int = 0
    skipped: int = 0
    failed: int = 0
    pending: int = 0
