"""
Batch Executor - Processes solutions through the 5-step remediation flow.

Delegates per-solution remediation to RemediationEngine (single source of truth).
This class manages batch-level concerns: job tracking, summary counts, cancellation.

Flow per solution (via RemediationEngine):
    1. VALIDATE  -> GET /solutionInfo/{id}
    2. DELETE    -> DELETE /solutionMigration/{id}
    3. MIGRATE   -> POST /solutionMigration
    4. POLL      -> GET /migrationStatus/{id} (exponential backoff)
    5. POST-UPDATE -> POST /solutionPostUpdate
"""

import json
import logging
from typing import Optional

from ..config import settings
from ..models.schemas import (
    BatchJobState,
    BatchJobSummary,
    RemediationState,
    SolutionResult,
)
from .remediation_engine import RemediationEngine, is_success, should_skip_macd
from .tmf_client import TMFClient

logger = logging.getLogger(__name__)


class BatchExecutor:
    """
    Executes batch remediation by processing each solution through the
    state machine and calling the TMF API (which proxies to Salesforce).
    """

    def __init__(
        self,
        tmf_client: TMFClient,
        job_id: Optional[str] = None,
        service_problem_mapping: Optional[dict[str, str]] = None,
    ):
        self.tmf = tmf_client
        self.job_id = job_id
        # Maps solutionId -> serviceProblemId for post-remediation SP updates
        self.sp_mapping = service_problem_mapping or {}
        self.results: list[SolutionResult] = []
        self.summary = BatchJobSummary()
        self._cancelled = False

    def cancel(self):
        """Signal the executor to stop after the current solution."""
        self._cancelled = True

    def _update_job(self, patch: dict):
        """Update the tracking BatchJob if we have one."""
        if self.job_id:
            try:
                self.tmf.update_job(self.job_id, patch)
            except Exception as e:
                logger.warning(f"Failed to update BatchJob {self.job_id}: {e}")

    def _update_service_problem(
        self,
        solution_id: str,
        status: str,
        remediation_state: str,
        reason: str = "",
    ):
        """Update the corresponding ServiceProblem after remediation."""
        sp_id = self.sp_mapping.get(solution_id)
        if not sp_id:
            logger.debug(f"No ServiceProblem mapping for solution {solution_id}, skipping SP update")
            return
        try:
            self.tmf.update_service_problem(sp_id, status, remediation_state, reason)
            logger.info(f"Updated ServiceProblem {sp_id} -> status={status}, state={remediation_state}")
        except Exception as e:
            logger.warning(f"Failed to update ServiceProblem {sp_id} for solution {solution_id}: {e}")

    def execute_batch(
        self,
        solution_ids: list[str],
        max_count: Optional[int] = None,
    ) -> list[SolutionResult]:
        """
        Process a batch of solutions through the 5-step remediation flow.
        
        Args:
            solution_ids: List of Salesforce Solution IDs to process
            max_count: Maximum number to process (None = all)
            
        Returns:
            List of SolutionResult objects
        """
        to_process = solution_ids[:max_count] if max_count else solution_ids
        self.summary = BatchJobSummary(
            total=len(to_process),
            pending=len(to_process),
        )

        # Update BatchJob to inProgress
        self._update_job({
            "state": "inProgress",
            "x_summary": json.dumps(self.summary.model_dump()),
        })

        for i, solution_id in enumerate(to_process):
            if self._cancelled:
                logger.info(f"Batch cancelled after {i} solutions")
                # Mark remaining as pending
                break

            logger.info(f"Processing solution {i+1}/{len(to_process)}: {solution_id}")
            
            # Update current item in BatchJob
            self._update_job({
                "x_currentItemId": solution_id,
                "x_currentItemState": "VALIDATING",
                "actualQuantity": i,
            })

            result = self._process_single(solution_id)
            self.results.append(result)

            # Update summary counts
            if result.final_state == RemediationState.COMPLETED:
                self.summary.successful += 1
            elif result.final_state == RemediationState.SKIPPED:
                self.summary.skipped += 1
            elif result.final_state == RemediationState.FAILED:
                self.summary.failed += 1
            self.summary.pending -= 1

            # Update BatchJob with progress
            self._update_job({
                "actualQuantity": i + 1,
                "x_summary": json.dumps(self.summary.model_dump()),
            })

        # Final update
        final_state = "completed"
        if self._cancelled:
            final_state = "cancelled"
        elif self.summary.failed > 0 and self.summary.successful == 0:
            final_state = "failed"

        self._update_job({
            "state": final_state,
            "actualQuantity": len(self.results),
            "x_summary": json.dumps(self.summary.model_dump()),
            "x_currentItemId": "",
            "x_currentItemState": "COMPLETED" if final_state == "completed" else "FAILED",
        })

        return self.results

    def _process_single(self, solution_id: str) -> SolutionResult:
        """
        Process a single solution through the 5-step flow.
        Delegates to RemediationEngine (single source of truth).
        """
        sp_id = self.sp_mapping.get(solution_id)

        def on_step(action: str, success: bool, duration_ms: int):
            """Callback: update BatchJob progress as engine runs steps."""
            state_map = {
                "VALIDATE": "VALIDATING",
                "DELETE": "DELETING_SM_DATA",
                "MIGRATE": "MIGRATING",
                "POLL": "WAITING_CONFIRMATION",
                "POST_UPDATE": "POST_UPDATE",
            }
            self._update_job({"x_currentItemState": state_map.get(action, action)})

        engine = RemediationEngine(
            self.tmf,
            initial_delay=settings.remediation_initial_delay,
            poll_interval=settings.remediation_poll_interval,
            max_interval=settings.remediation_max_interval,
            backoff_factor=settings.remediation_backoff_factor,
            max_duration=settings.remediation_max_duration,
        )

        result = engine.remediate(
            solution_id,
            service_problem_id=sp_id,
            on_step=on_step,
        )

        return result.solution_result


# =============================================================================
# Backwards-compatible helper re-exports (used by tests / external callers)
# =============================================================================

def _is_success(response: dict) -> bool:
    """Check if a Salesforce REST response indicates success."""
    return is_success(response)


def _should_skip_macd(info: dict) -> tuple[bool, str]:
    """Granular MACD eligibility check using basketDetails."""
    return should_skip_macd(info)
