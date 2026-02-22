"""
OE Batch Executor - Batch wrapper for Module 1867 (OE Partial Data Missing).

Mirrors the pattern of batch_executor.py (Module 1147) but delegates
per-service processing to OEExecutor instead of RemediationEngine.

Manages batch-level concerns:
  - BatchJob lifecycle (pending -> inProgress -> completed/failed)
  - Per-service ServiceProblem updates
  - Summary statistics (remediated, not_impacted, skipped, failed)
  - Cancellation support
  - Enrichment data resolution (via TMF API, NOT via JOIN views)
"""

import json
import logging
from typing import Optional

from ..models.schemas import (
    BatchJobState,
    OEBatchJobSummary,
    OERemediationState,
    OEResult,
    OE_TERMINAL_STATES,
)
from .oe_executor import OEExecutor
from .tmf_client import TMFClient

logger = logging.getLogger(__name__)


class OEBatchExecutor:
    """
    Executes batch OE remediation by processing each service through
    the 4-step flow via OEExecutor.

    Usage (from scheduler or API route):
        tmf = TMFClient(base_url)
        executor = OEBatchExecutor(tmf, job_id="batch-job-id")
        results = executor.execute_batch(service_entries)
    """

    def __init__(
        self,
        tmf_client: TMFClient,
        job_id: Optional[str] = None,
        dry_run: bool = False,
    ):
        self.tmf = tmf_client
        self.job_id = job_id
        self.dry_run = dry_run
        self.oe_executor = OEExecutor(tmf_client)
        self.results: list[OEResult] = []
        self.summary = OEBatchJobSummary()
        self._cancelled = False

    def cancel(self):
        """Signal the executor to stop after the current service."""
        self._cancelled = True

    def execute_batch(
        self,
        service_entries: list[dict],
        max_count: Optional[int] = None,
    ) -> list[OEResult]:
        """
        Process a batch of services through OE remediation.

        Args:
            service_entries: List of dicts from discover_oe_services():
                [{"serviceId": "...", "serviceProblemId": "...", "serviceType": "..."}, ...]
            max_count: Maximum number to process (None = all)

        Returns:
            List of OEResult objects
        """
        to_process = service_entries[:max_count] if max_count else service_entries
        self.summary = OEBatchJobSummary(
            total=len(to_process),
            pending=len(to_process),
        )

        self._update_job({
            "state": "inProgress",
            "x_summary": json.dumps(self.summary.model_dump()),
        })

        for i, entry in enumerate(to_process):
            if self._cancelled:
                logger.info(f"OE batch cancelled after {i} services")
                break

            service_id = entry["serviceId"]
            sp_id = entry.get("serviceProblemId", "")

            logger.info(f"Processing OE service {i + 1}/{len(to_process)}: {service_id}")

            self._update_job({
                "x_currentItemId": service_id,
                "x_currentItemState": "VALIDATING",
                "actualQuantity": i,
            })

            # Update ServiceProblem to inProgress
            self._update_service_problem(sp_id, "inProgress", "VALIDATING")

            result = self.oe_executor.remediate(
                service_id,
                dry_run=self.dry_run,
            )
            self.results.append(result)

            # Update summary counts
            if result.final_state == OERemediationState.REMEDIATED:
                self.summary.remediated += 1
            elif result.final_state == OERemediationState.NOT_IMPACTED:
                self.summary.not_impacted += 1
            elif result.final_state == OERemediationState.SKIPPED:
                self.summary.skipped += 1
            elif result.final_state == OERemediationState.FAILED:
                self.summary.failed += 1
            self.summary.pending -= 1

            # Update ServiceProblem based on result
            sp_status = _sp_status_from_result(result)
            sp_state = result.final_state.value
            sp_reason = result.error or (
                f"Patched: {', '.join(result.fields_patched)}" if result.fields_patched else ""
            )
            self._update_service_problem(sp_id, sp_status, sp_state, sp_reason)

            # Update BatchJob with progress
            self._update_job({
                "actualQuantity": i + 1,
                "x_currentItemState": result.final_state.value,
                "x_summary": json.dumps(self.summary.model_dump()),
            })

        # Final job update
        final_state = "completed"
        if self._cancelled:
            final_state = "cancelled"
        elif self.summary.failed > 0 and self.summary.remediated == 0:
            final_state = "failed"

        self._update_job({
            "state": final_state,
            "actualQuantity": len(self.results),
            "x_summary": json.dumps(self.summary.model_dump()),
            "x_currentItemId": "",
            "x_currentItemState": final_state.upper(),
        })

        logger.info(
            f"OE batch complete: {self.summary.model_dump()} "
            f"(final_state={final_state})"
        )
        return self.results

    def _update_job(self, patch: dict):
        """Update the tracking BatchJob if we have one."""
        if not self.job_id:
            return
        try:
            self.tmf.update_job(self.job_id, patch)
        except Exception as e:
            logger.warning(f"Failed to update BatchJob {self.job_id}: {e}")

    def _update_service_problem(
        self,
        sp_id: str,
        status: str,
        remediation_state: str,
        reason: str = "",
    ):
        if not sp_id:
            return
        try:
            self.tmf.update_service_problem(sp_id, status, remediation_state, reason)
        except Exception as e:
            logger.warning(f"Failed to update ServiceProblem {sp_id}: {e}")


def _sp_status_from_result(result: OEResult) -> str:
    """Map OE result state to ServiceProblem status."""
    if result.final_state == OERemediationState.REMEDIATED:
        return "resolved"
    if result.final_state in (OERemediationState.NOT_IMPACTED, OERemediationState.SKIPPED):
        return "closed"
    if result.final_state == OERemediationState.FAILED:
        return "pending"
    return "inProgress"
