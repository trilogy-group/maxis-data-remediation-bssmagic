"""
Scheduler Loop for the Batch Orchestrator.
Periodically checks for active schedules and creates BatchJobs when due.
"""

import json
import logging
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from ..models.schemas import BatchSchedule, RecurrencePattern
from .schedule_checker import ScheduleChecker
from .tmf_client import TMFClient
from .batch_executor import BatchExecutor
from .oe_batch_executor import OEBatchExecutor

logger = logging.getLogger(__name__)


class Scheduler:
    """
    Main scheduler loop that:
    1. Polls active BatchSchedules from the TMF API
    2. Determines which are due for execution
    3. Creates BatchJobs and runs the BatchExecutor
    4. Updates schedule statistics after completion
    """

    def __init__(self, tmf_client: TMFClient):
        self.tmf = tmf_client
        self.checker = ScheduleChecker()

    def check_and_execute(self) -> list[str]:
        """
        One iteration of the scheduler loop.
        
        Returns:
            List of BatchJob IDs created during this cycle
        """
        created_jobs: list[str] = []

        # Step 1: Get active schedules
        try:
            raw_schedules = self.tmf.list_schedules(is_active=True)
        except Exception as e:
            logger.error(f"Failed to fetch schedules: {e}")
            return created_jobs

        # Step 2: Parse into BatchSchedule models
        schedules = []
        for raw in raw_schedules:
            try:
                schedules.append(_parse_schedule(raw))
            except Exception as e:
                logger.warning(f"Failed to parse schedule {raw.get('id', '?')}: {e}")

        # Step 3: Filter to ready schedules
        ready = self.checker.get_ready_schedules(schedules)
        if not ready:
            logger.debug("No schedules ready for execution")
            return created_jobs

        logger.info(f"{len(ready)} schedule(s) ready for execution")

        # Step 4: Execute each ready schedule
        for schedule in ready:
            try:
                job_id = self._execute_schedule(schedule)
                if job_id:
                    created_jobs.append(job_id)
            except Exception as e:
                logger.error(f"Failed to execute schedule {schedule.id}: {e}", exc_info=True)

        return created_jobs

    def _execute_schedule(self, schedule: BatchSchedule) -> Optional[str]:
        """
        Execute a single schedule: create BatchJob, run executor, update stats.
        
        Returns:
            The created BatchJob ID, or None if creation failed
        """
        logger.info(f"Executing schedule '{schedule.name}' ({schedule.id})")

        # Create a BatchJob for this execution
        job_data = {
            "name": f"{schedule.name} - Execution {schedule.total_executions + 1}",
            "description": f"Auto-created by schedule {schedule.id}",
            "category": schedule.category,
            "requestedQuantity": schedule.max_batch_size,
            "x_configuration": json.dumps(schedule.selection_criteria),
            "x_isRecurrent": True,
            "x_parentScheduleId": schedule.id,
            "x_executionNumber": schedule.total_executions + 1,
        }

        try:
            self.tmf.create_job(job_data)
        except Exception as e:
            logger.error(f"Failed to create BatchJob for schedule {schedule.id}: {e}")
            return None

        # Find the created job by listing (TMF Runtime doesn't return full record)
        jobs = self.tmf.list_jobs()
        job_id = None
        for j in jobs:
            if j.get("x_parentScheduleId") == schedule.id and j.get("state") == "pending":
                job_id = j["id"]
                break

        if not job_id:
            logger.error(f"Could not find created BatchJob for schedule {schedule.id}")
            return None

        logger.info(f"Created BatchJob {job_id} for schedule {schedule.id}")

        # Route to the appropriate executor based on schedule category
        if schedule.category == "PartialDataMissing":
            exec_success = self._execute_oe_batch(schedule, job_id)
        else:
            exec_success = self._execute_solution_batch(schedule, job_id)

        # Update schedule statistics
        try:
            next_exec = _calculate_next_execution(schedule)
            stats_patch: dict = {
                "totalExecutions": schedule.total_executions + 1,
                "lastExecutionId": job_id,
                "lastExecutionDate": datetime.now(timezone.utc).isoformat(),
                "nextExecutionDate": next_exec.isoformat() if next_exec else None,
            }
            if exec_success:
                stats_patch["successfulExecutions"] = schedule.successful_executions + 1
            else:
                stats_patch["failedExecutions"] = schedule.failed_executions + 1

            self.tmf.update_schedule(schedule.id, stats_patch)
        except Exception as e:
            logger.warning(f"Failed to update schedule stats for {schedule.id}: {e}")

        return job_id


    def _execute_solution_batch(self, schedule: BatchSchedule, job_id: str) -> bool:
        """Execute a SolutionEmpty batch (Module 1147)."""
        try:
            discovered = self.tmf.discover_solutions(
                category=schedule.category,
                max_count=schedule.max_batch_size,
            )
            solution_ids = [d["solutionId"] for d in discovered]
            sp_mapping = {d["solutionId"]: d["serviceProblemId"] for d in discovered}
        except Exception as e:
            logger.error(f"Failed to discover solutions for schedule {schedule.id}: {e}")
            solution_ids = []
            sp_mapping = {}

        if solution_ids:
            logger.info(f"Discovered {len(solution_ids)} solutions for schedule {schedule.id}")
            try:
                executor = BatchExecutor(
                    self.tmf,
                    job_id=job_id,
                    service_problem_mapping=sp_mapping,
                )
                executor.execute_batch(solution_ids, max_count=schedule.max_batch_size)
                logger.info(
                    f"Batch execution complete for schedule {schedule.id}: "
                    f"{executor.summary.successful} success, "
                    f"{executor.summary.failed} failed, "
                    f"{executor.summary.skipped} skipped"
                )
                return executor.summary.failed == 0
            except Exception as e:
                logger.error(f"Batch execution failed for schedule {schedule.id}: {e}", exc_info=True)
                return False
        else:
            logger.info(f"No solutions found for schedule {schedule.id} (category={schedule.category})")
            self._mark_job_empty(job_id)
            return True

    def _execute_oe_batch(self, schedule: BatchSchedule, job_id: str) -> bool:
        """Execute a PartialDataMissing batch (Module 1867)."""
        try:
            entries = self.tmf.discover_oe_services(max_count=schedule.max_batch_size)
        except Exception as e:
            logger.error(f"Failed to discover OE services for schedule {schedule.id}: {e}")
            entries = []

        if entries:
            logger.info(f"Discovered {len(entries)} OE services for schedule {schedule.id}")
            try:
                executor = OEBatchExecutor(self.tmf, job_id=job_id)
                executor.execute_batch(entries, max_count=schedule.max_batch_size)
                logger.info(
                    f"OE batch complete for schedule {schedule.id}: "
                    f"{executor.summary.remediated} remediated, "
                    f"{executor.summary.failed} failed, "
                    f"{executor.summary.skipped} skipped, "
                    f"{executor.summary.not_impacted} not_impacted"
                )
                return executor.summary.failed == 0
            except Exception as e:
                logger.error(f"OE batch execution failed for schedule {schedule.id}: {e}", exc_info=True)
                return False
        else:
            logger.info(f"No OE services found for schedule {schedule.id}")
            self._mark_job_empty(job_id)
            return True

    def _mark_job_empty(self, job_id: str):
        """Mark a BatchJob as completed with zero items processed."""
        try:
            self.tmf.update_job(job_id, {
                "state": "completed",
                "actualQuantity": 0,
                "x_summary": json.dumps({"total": 0, "successful": 0, "failed": 0, "skipped": 0, "pending": 0}),
            })
        except Exception as e:
            logger.warning(f"Failed to update empty BatchJob {job_id}: {e}")


def _parse_schedule(raw: dict) -> BatchSchedule:
    """Parse a raw TMF API response dict into a BatchSchedule model."""
    next_exec = raw.get("nextExecutionDate")
    if isinstance(next_exec, str) and next_exec:
        try:
            next_exec = datetime.fromisoformat(next_exec.replace("+00", "+00:00"))
        except ValueError:
            next_exec = None

    last_exec = raw.get("lastExecutionDate")
    if isinstance(last_exec, str) and last_exec:
        try:
            last_exec = datetime.fromisoformat(last_exec.replace("+00", "+00:00"))
        except ValueError:
            last_exec = None

    window_start = raw.get("windowStartTime", "00:00:00")
    window_end = raw.get("windowEndTime", "06:00:00")
    
    return BatchSchedule(
        id=raw["id"],
        name=raw.get("name", ""),
        description=raw.get("description"),
        is_active=raw.get("isActive", True),
        category=raw.get("category", "SolutionEmpty"),
        recurrence_pattern=raw.get("recurrencePattern", "daily"),
        window_start_time=time.fromisoformat(window_start),
        window_end_time=time.fromisoformat(window_end),
        timezone=raw.get("timezone", "UTC"),
        max_batch_size=raw.get("maxBatchSize", 100),
        selection_criteria=json.loads(raw["selectionCriteria"]) if isinstance(raw.get("selectionCriteria"), str) else raw.get("selectionCriteria", {}),
        total_executions=raw.get("totalExecutions", 0),
        successful_executions=raw.get("successfulExecutions", 0),
        failed_executions=raw.get("failedExecutions", 0),
        next_execution_date=next_exec,
        last_execution_date=last_exec,
    )


def _calculate_next_execution(schedule: BatchSchedule) -> Optional[datetime]:
    """Calculate the next execution date based on recurrence pattern."""
    now = datetime.now(timezone.utc)
    
    if schedule.recurrence_pattern == RecurrencePattern.ONCE:
        return None  # One-time, no next execution
    elif schedule.recurrence_pattern == RecurrencePattern.DAILY:
        next_date = now.date() + timedelta(days=1)
        return datetime.combine(next_date, schedule.window_start_time, tzinfo=timezone.utc)
    elif schedule.recurrence_pattern == RecurrencePattern.WEEKDAYS:
        next_date = now.date() + timedelta(days=1)
        while next_date.weekday() >= 5:  # Skip Saturday (5) and Sunday (6)
            next_date += timedelta(days=1)
        return datetime.combine(next_date, schedule.window_start_time, tzinfo=timezone.utc)
    elif schedule.recurrence_pattern == RecurrencePattern.WEEKLY:
        next_date = now.date() + timedelta(weeks=1)
        return datetime.combine(next_date, schedule.window_start_time, tzinfo=timezone.utc)
    else:
        # Default: next day
        next_date = now.date() + timedelta(days=1)
        return datetime.combine(next_date, schedule.window_start_time, tzinfo=timezone.utc)
