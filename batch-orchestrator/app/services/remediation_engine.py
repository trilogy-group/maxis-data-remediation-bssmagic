"""
Remediation Engine - Single source of truth for the 5-step solution remediation flow.

Used by:
  - BatchExecutor._process_single() for batch remediation
  - POST /remediate/{solution_id} for single-solution remediation from frontend/CLI

Flow:
    1. VALIDATE     → GET /solutionInfo/{id}         (+ MACD eligibility check)
    2. DELETE       → DELETE /solutionMigration/{id}
    3. MIGRATE      → POST /solutionMigration         (captures jobId)
    4. POLL         → GET /migrationStatus/{id}        (exponential backoff)
    5. POST_UPDATE  → POST /solutionPostUpdate         (forwards jobId + sfdcUpdates)
"""

import json
import logging
import time as time_module
from dataclasses import dataclass, field
from typing import Callable, Optional

from ..models.schemas import RemediationState, SolutionResult
from .state_engine import StateEngine, InvalidTransitionError
from .tmf_client import TMFClient

logger = logging.getLogger(__name__)

# Default SFDC field updates applied during POST_UPDATE
DEFAULT_SFDC_UPDATES = {
    "isMigratedToHeroku": True,
    "isConfigurationUpdatedToHeroku": True,
    "externalIdentifier": "",
}

# Default polling configuration
DEFAULT_INITIAL_DELAY = 10.0
DEFAULT_POLL_INTERVAL = 10.0
DEFAULT_MAX_INTERVAL = 60.0
DEFAULT_BACKOFF_FACTOR = 2.0
DEFAULT_MAX_DURATION = 1800.0  # 30 minutes

# MACD eligibility constants
SENSITIVE_STAGES = {"Order Enrichment", "Submitted"}
MAX_AGE_DAYS = 60


# =============================================================================
# Result dataclasses
# =============================================================================

@dataclass
class StepResult:
    """Result of a single remediation step."""
    action: str          # VALIDATE | DELETE | MIGRATE | POLL | POST_UPDATE
    success: bool
    duration_ms: int = 0
    message: str = ""
    job_id: Optional[str] = None   # only for MIGRATE
    status: Optional[str] = None   # only for POLL


@dataclass
class RemediationResult:
    """Full result of a remediation attempt."""
    solution_id: str
    success: bool
    steps: list[StepResult] = field(default_factory=list)
    service_problem_updated: bool = False
    total_duration_ms: int = 0
    failed_at: Optional[str] = None
    message: str = ""
    solution_result: Optional[SolutionResult] = None


# =============================================================================
# Helper functions (moved from batch_executor.py)
# =============================================================================

def is_success(response: dict) -> bool:
    """Check if a Salesforce REST response indicates success."""
    success = response.get("success", "")
    if isinstance(success, bool):
        return success
    return str(success).lower() in ("true", "1", "yes")


def should_skip_macd(info: dict) -> tuple[bool, str]:
    """
    Granular MACD eligibility check using basketDetails.

    Rules:
      - If any basket is in "Order Enrichment" or "Submitted" -> skip
      - If any basket is < 60 days old -> skip (could be an active journey)
      - If all baskets are >= 60 days AND none in sensitive stages -> include
      - If basketDetails is empty but MACD exists -> skip (play safe)

    Returns:
        (should_skip, reason) - True with reason if solution must be skipped.
    """
    macd = info.get("macdDetails", "")
    if not macd:
        return False, ""

    try:
        if isinstance(macd, str):
            macd = json.loads(macd)
    except (json.JSONDecodeError, TypeError):
        return False, ""

    if not isinstance(macd, dict):
        return False, ""

    macd_exists = (
        macd.get("macdBasketExists") is True
        or len(macd.get("macdSolutionIds", [])) > 0
    )
    if not macd_exists:
        return False, ""

    baskets = macd.get("basketDetails") or []
    if not isinstance(baskets, list):
        baskets = []

    if len(baskets) == 0:
        return True, "MACD exists but no basket details available - skipping for safety"

    sensitive = [b for b in baskets if b.get("basketStage") in SENSITIVE_STAGES]
    if sensitive:
        stages = ", ".join(b.get("basketStage", "?") for b in sensitive)
        return True, f"MACD basket in sensitive stage: {stages}"

    recent = [b for b in baskets if (b.get("basketAgeInDays") or 0) < MAX_AGE_DAYS]
    if recent:
        youngest = min(b.get("basketAgeInDays", 0) for b in recent)
        return True, f"MACD basket too recent (youngest: {youngest} days, threshold: {MAX_AGE_DAYS})"

    logger.info(
        f"MACD exists but all {len(baskets)} baskets are >={MAX_AGE_DAYS} days old "
        f"and not in sensitive stages - proceeding"
    )
    return False, ""


# =============================================================================
# RemediationEngine
# =============================================================================

class RemediationEngine:
    """
    Single source of truth for the 5-step solution remediation flow.

    Encapsulates: VALIDATE -> DELETE -> MIGRATE -> POLL -> POST_UPDATE
    with exponential backoff polling, jobId forwarding, and step-by-step
    result tracking.
    """

    def __init__(
        self,
        tmf_client: TMFClient,
        *,
        initial_delay: float = DEFAULT_INITIAL_DELAY,
        poll_interval: float = DEFAULT_POLL_INTERVAL,
        max_interval: float = DEFAULT_MAX_INTERVAL,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        max_duration: float = DEFAULT_MAX_DURATION,
    ):
        self.tmf = tmf_client
        self.initial_delay = initial_delay
        self.poll_interval = poll_interval
        self.max_interval = max_interval
        self.backoff_factor = backoff_factor
        self.max_duration = max_duration

    def remediate(
        self,
        solution_id: str,
        *,
        service_problem_id: Optional[str] = None,
        skip_validation: bool = False,
        sfdc_updates: Optional[dict] = None,
        on_step: Optional[Callable[[str, bool, int], None]] = None,
    ) -> RemediationResult:
        """
        Execute the full 5-step remediation for a single solution.

        Args:
            solution_id:        18-char Salesforce Solution ID
            service_problem_id: Optional SP ID to update after remediation
            skip_validation:    Skip MACD eligibility check
            sfdc_updates:       Override default SFDC field updates
            on_step:            Callback(action, success, duration_ms) for progress

        Returns:
            RemediationResult with step-by-step details
        """
        engine = StateEngine(solution_id)
        result = RemediationResult(solution_id=solution_id, success=False)
        overall_start = time_module.monotonic()

        def _notify(action: str, success: bool, duration_ms: int):
            if on_step:
                try:
                    on_step(action, success, duration_ms)
                except Exception:
                    pass

        try:
            # -----------------------------------------------------------------
            # Step 1: VALIDATE
            # -----------------------------------------------------------------
            step_start = time_module.monotonic()
            engine.transition(RemediationState.VALIDATING, "Starting validation")
            _notify("VALIDATE", True, 0)

            info = self.tmf.validate_solution(solution_id)
            step_ms = int((time_module.monotonic() - step_start) * 1000)

            if not is_success(info):
                msg = info.get("message", "Validation failed")
                result.steps.append(StepResult("VALIDATE", False, step_ms, msg))
                _notify("VALIDATE", False, step_ms)
                engine.transition(RemediationState.FAILED, msg)
                self._update_sp(service_problem_id, "rejected", "FAILED", "Validation failed")
                result.failed_at = "VALIDATE"
                result.message = msg
                result.solution_result = engine.get_result()
                result.service_problem_updated = service_problem_id is not None
                return self._finalize(result, overall_start)

            if not skip_validation:
                skip, skip_reason = should_skip_macd(info)
                if skip:
                    result.steps.append(StepResult("VALIDATE", True, step_ms, f"Skipped: {skip_reason}"))
                    _notify("VALIDATE", True, step_ms)
                    engine.transition(RemediationState.SKIPPED, skip_reason)
                    self._update_sp(service_problem_id, "rejected", "SKIPPED", skip_reason)
                    result.message = skip_reason
                    result.solution_result = engine.get_result()
                    result.service_problem_updated = service_problem_id is not None
                    return self._finalize(result, overall_start)

            engine.transition(RemediationState.VALIDATED, "Eligibility confirmed")
            result.steps.append(StepResult("VALIDATE", True, step_ms, "Eligibility confirmed"))
            _notify("VALIDATE", True, step_ms)

            # -----------------------------------------------------------------
            # Step 2: DELETE
            # -----------------------------------------------------------------
            step_start = time_module.monotonic()
            engine.transition(RemediationState.DELETING_SM_DATA, "Deleting SM artifacts")
            _notify("DELETE", True, 0)

            try:
                delete_result = self.tmf.delete_solution(solution_id)
                step_ms = int((time_module.monotonic() - step_start) * 1000)

                if not is_success(delete_result):
                    msg = delete_result.get("message", "Delete failed")
                    result.steps.append(StepResult("DELETE", False, step_ms, msg))
                    _notify("DELETE", False, step_ms)
                    engine.transition(RemediationState.DELETE_FAILED, msg)
                    engine.transition(RemediationState.FAILED, "Delete operation failed")
                    self._update_sp(service_problem_id, "rejected", "FAILED", msg)
                    result.failed_at = "DELETE"
                    result.message = msg
                    result.solution_result = engine.get_result()
                    result.service_problem_updated = service_problem_id is not None
                    return self._finalize(result, overall_start)
            except Exception as e:
                step_ms = int((time_module.monotonic() - step_start) * 1000)
                msg = str(e)
                result.steps.append(StepResult("DELETE", False, step_ms, msg))
                _notify("DELETE", False, step_ms)
                engine.transition(RemediationState.DELETE_FAILED, msg)
                engine.transition(RemediationState.FAILED, f"Delete exception: {e}")
                self._update_sp(service_problem_id, "rejected", "FAILED", msg)
                result.failed_at = "DELETE"
                result.message = msg
                result.solution_result = engine.get_result()
                result.service_problem_updated = service_problem_id is not None
                return self._finalize(result, overall_start)

            result.steps.append(StepResult("DELETE", True, step_ms, "SM artifacts deleted"))
            _notify("DELETE", True, step_ms)

            # -----------------------------------------------------------------
            # Step 3: MIGRATE
            # -----------------------------------------------------------------
            step_start = time_module.monotonic()
            engine.transition(RemediationState.MIGRATING, "Starting migration")
            _notify("MIGRATE", True, 0)
            job_id = None

            try:
                migrate_result = self.tmf.migrate_solution(solution_id)
                step_ms = int((time_module.monotonic() - step_start) * 1000)
                job_id = migrate_result.get("jobId")

                if not is_success(migrate_result):
                    msg = migrate_result.get("message", "Migration failed")
                    result.steps.append(StepResult("MIGRATE", False, step_ms, msg))
                    _notify("MIGRATE", False, step_ms)
                    engine.transition(RemediationState.MIGRATION_FAILED, msg)
                    engine.transition(RemediationState.FAILED, "Migration failed")
                    self._update_sp(service_problem_id, "rejected", "FAILED", msg)
                    result.failed_at = "MIGRATE"
                    result.message = msg
                    result.solution_result = engine.get_result()
                    result.service_problem_updated = service_problem_id is not None
                    return self._finalize(result, overall_start)
            except Exception as e:
                step_ms = int((time_module.monotonic() - step_start) * 1000)
                msg = str(e)
                result.steps.append(StepResult("MIGRATE", False, step_ms, msg))
                _notify("MIGRATE", False, step_ms)
                engine.transition(RemediationState.MIGRATION_FAILED, msg)
                engine.transition(RemediationState.FAILED, f"Migration exception: {e}")
                self._update_sp(service_problem_id, "rejected", "FAILED", msg)
                result.failed_at = "MIGRATE"
                result.message = msg
                result.solution_result = engine.get_result()
                result.service_problem_updated = service_problem_id is not None
                return self._finalize(result, overall_start)

            result.steps.append(StepResult("MIGRATE", True, step_ms, "Migration started", job_id=job_id))
            _notify("MIGRATE", True, step_ms)

            # -----------------------------------------------------------------
            # Step 4: POLL (exponential backoff)
            # -----------------------------------------------------------------
            step_start = time_module.monotonic()
            engine.transition(RemediationState.WAITING_CONFIRMATION, "Polling migration status")
            _notify("POLL", True, 0)

            poll_ok, poll_status, poll_msg = self._step_poll(solution_id)
            step_ms = int((time_module.monotonic() - step_start) * 1000)

            if not poll_ok:
                result.steps.append(StepResult("POLL", False, step_ms, poll_msg, status=poll_status))
                _notify("POLL", False, step_ms)
                engine.transition(RemediationState.MIGRATION_FAILED, poll_msg)
                engine.transition(RemediationState.FAILED, f"Migration polling: {poll_msg}")
                self._update_sp(service_problem_id, "rejected", "FAILED", poll_msg)
                result.failed_at = "POLL"
                result.message = poll_msg
                result.solution_result = engine.get_result()
                result.service_problem_updated = service_problem_id is not None
                return self._finalize(result, overall_start)

            engine.transition(RemediationState.CONFIRMED, "Migration confirmed")
            result.steps.append(StepResult("POLL", True, step_ms, "Migration confirmed", status="COMPLETED"))
            _notify("POLL", True, step_ms)

            # -----------------------------------------------------------------
            # Step 5: POST_UPDATE (non-fatal on 404)
            # -----------------------------------------------------------------
            step_start = time_module.monotonic()
            engine.transition(RemediationState.POST_UPDATE, "Running post-migration update")
            _notify("POST_UPDATE", True, 0)

            try:
                self.tmf.post_update_solution(
                    solution_id,
                    job_id=job_id,
                    sfdc_updates=sfdc_updates,
                )
                step_ms = int((time_module.monotonic() - step_start) * 1000)
                result.steps.append(StepResult("POST_UPDATE", True, step_ms, "SFDC fields updated"))
                _notify("POST_UPDATE", True, step_ms)
            except Exception as e:
                step_ms = int((time_module.monotonic() - step_start) * 1000)
                is_404 = "404" in str(e) or "Not Found" in str(e)
                if is_404:
                    logger.info(f"Post-update endpoint not available for {solution_id}, skipping (non-fatal)")
                else:
                    logger.warning(f"Post-update failed for {solution_id}: {e} (non-fatal, continuing)")
                result.steps.append(StepResult("POST_UPDATE", False, step_ms, str(e)))
                _notify("POST_UPDATE", False, step_ms)

            # -----------------------------------------------------------------
            # SUCCESS
            # -----------------------------------------------------------------
            engine.transition(RemediationState.COMPLETED, "Remediation completed successfully")
            self._update_sp(service_problem_id, "resolved", "COMPLETED", "Remediation completed")

            result.success = True
            result.message = "Remediation completed successfully"
            result.service_problem_updated = service_problem_id is not None
            result.solution_result = engine.get_result()
            return self._finalize(result, overall_start)

        except InvalidTransitionError as e:
            logger.error(f"Invalid state transition for {solution_id}: {e}")
            engine.error = str(e)
            self._update_sp(service_problem_id, "rejected", "FAILED", f"State error: {e}")
            result.failed_at = engine.current_state.value
            result.message = str(e)
            result.solution_result = engine.get_result()
            result.service_problem_updated = service_problem_id is not None
            return self._finalize(result, overall_start)
        except Exception as e:
            logger.error(f"Unexpected error processing {solution_id}: {e}", exc_info=True)
            try:
                engine.transition(RemediationState.FAILED, f"Unexpected error: {e}")
            except InvalidTransitionError:
                engine.error = str(e)
            self._update_sp(service_problem_id, "rejected", "FAILED", str(e))
            result.failed_at = engine.current_state.value
            result.message = str(e)
            result.solution_result = engine.get_result()
            result.service_problem_updated = service_problem_id is not None
            return self._finalize(result, overall_start)

    # =========================================================================
    # Internal steps
    # =========================================================================

    def _step_poll(self, solution_id: str) -> tuple[bool, str, str]:
        """
        Poll migration status with exponential backoff.

        Returns: (success, final_status, error_message)
        """
        time_module.sleep(self.initial_delay)
        elapsed = self.initial_delay
        current_interval = self.poll_interval

        while elapsed < self.max_duration:
            try:
                status_resp = self.tmf.poll_migration_status(solution_id)
                poll_status = status_resp.get("status", "").upper()

                if poll_status in ("COMPLETED", "SUCCESS"):
                    return True, "COMPLETED", ""
                elif poll_status in ("FAILED", "ERROR"):
                    return False, "FAILED", status_resp.get("message", "Migration failed")

            except Exception as e:
                logger.warning(f"Poll attempt failed for {solution_id}: {e}")

            wait = min(current_interval, self.max_interval)
            time_module.sleep(wait)
            elapsed += wait
            current_interval *= self.backoff_factor

        return False, "TIMEOUT", f"Polling timed out after {self.max_duration}s"

    def _update_sp(
        self,
        sp_id: Optional[str],
        status: str,
        remediation_state: str,
        reason: str = "",
    ):
        """Update ServiceProblem if ID was provided."""
        if not sp_id:
            return
        try:
            self.tmf.update_service_problem(sp_id, status, remediation_state, reason)
            logger.info(f"Updated ServiceProblem {sp_id} -> status={status}, state={remediation_state}")
        except Exception as e:
            logger.warning(f"Failed to update ServiceProblem {sp_id}: {e}")

    def _finalize(self, result: RemediationResult, start_time: float) -> RemediationResult:
        """Set total duration and return."""
        result.total_duration_ms = int((time_module.monotonic() - start_time) * 1000)
        return result
