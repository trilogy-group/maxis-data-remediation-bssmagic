"""
Unit tests for solution discovery and ServiceProblem update.
Tests the new TMFClient.discover_solutions() and update_service_problem() methods,
as well as the BatchExecutor's ServiceProblem update integration.

Usage:
    cd batch-orchestrator
    source .venv/bin/activate
    python -m pytest tests/test_discovery.py -v --tb=short
"""

import json
import pytest
from unittest.mock import MagicMock, patch, call

from app.services.tmf_client import TMFClient
from app.services.batch_executor import BatchExecutor
from app.models.schemas import RemediationState, SolutionResult


# =============================================================================
# TMFClient.discover_solutions() tests
# =============================================================================

class TestDiscoverSolutions:
    """Test solution discovery from ServiceProblem API."""

    def test_discovers_detected_solutions(self):
        """Should return solutionIds from ServiceProblems with remediationState=DETECTED."""
        mock_response = [
            {
                "id": "sp-001",
                "category": "SolutionEmpty",
                "status": "pending",
                "characteristic": [
                    {"name": "solutionId", "value": "sol-aaa"},
                    {"name": "remediationState", "value": "DETECTED"},
                ],
            },
            {
                "id": "sp-002",
                "category": "SolutionEmpty",
                "status": "pending",
                "characteristic": [
                    {"name": "solutionId", "value": "sol-bbb"},
                    {"name": "remediationState", "value": "DETECTED"},
                ],
            },
        ]

        client = TMFClient(base_url="http://mock", api_key="test")
        with patch.object(client, "_client") as mock_ctx:
            mock_http = MagicMock()
            mock_ctx.return_value.__enter__ = MagicMock(return_value=mock_http)
            mock_ctx.return_value.__exit__ = MagicMock(return_value=False)
            mock_http.get.return_value.json.return_value = mock_response
            mock_http.get.return_value.raise_for_status = MagicMock()

            result = client.discover_solutions(category="SolutionEmpty", max_count=10)

        assert len(result) == 2
        assert result[0] == {"solutionId": "sol-aaa", "serviceProblemId": "sp-001"}
        assert result[1] == {"solutionId": "sol-bbb", "serviceProblemId": "sp-002"}

    def test_skips_non_detected_solutions(self):
        """Should skip solutions with remediationState != DETECTED."""
        mock_response = [
            {
                "id": "sp-001",
                "status": "pending",
                "characteristic": [
                    {"name": "solutionId", "value": "sol-aaa"},
                    {"name": "remediationState", "value": "DETECTED"},
                ],
            },
            {
                "id": "sp-002",
                "status": "pending",
                "characteristic": [
                    {"name": "solutionId", "value": "sol-bbb"},
                    {"name": "remediationState", "value": "COMPLETED"},  # Already done
                ],
            },
            {
                "id": "sp-003",
                "status": "pending",
                "characteristic": [
                    {"name": "solutionId", "value": "sol-ccc"},
                    {"name": "remediationState", "value": "MIGRATING"},  # In progress
                ],
            },
        ]

        client = TMFClient(base_url="http://mock", api_key="test")
        with patch.object(client, "_client") as mock_ctx:
            mock_http = MagicMock()
            mock_ctx.return_value.__enter__ = MagicMock(return_value=mock_http)
            mock_ctx.return_value.__exit__ = MagicMock(return_value=False)
            mock_http.get.return_value.json.return_value = mock_response
            mock_http.get.return_value.raise_for_status = MagicMock()

            result = client.discover_solutions()

        assert len(result) == 1
        assert result[0]["solutionId"] == "sol-aaa"

    def test_handles_missing_characteristics(self):
        """Should handle ServiceProblems with missing or empty characteristics."""
        mock_response = [
            {
                "id": "sp-001",
                "status": "pending",
                "characteristic": [],  # Empty
            },
            {
                "id": "sp-002",
                "status": "pending",
                # No characteristic field
            },
            {
                "id": "sp-003",
                "status": "pending",
                "characteristic": [
                    {"name": "solutionId", "value": "sol-aaa"},
                    {"name": "remediationState", "value": "DETECTED"},
                ],
            },
        ]

        client = TMFClient(base_url="http://mock", api_key="test")
        with patch.object(client, "_client") as mock_ctx:
            mock_http = MagicMock()
            mock_ctx.return_value.__enter__ = MagicMock(return_value=mock_http)
            mock_ctx.return_value.__exit__ = MagicMock(return_value=False)
            mock_http.get.return_value.json.return_value = mock_response
            mock_http.get.return_value.raise_for_status = MagicMock()

            result = client.discover_solutions()

        assert len(result) == 1
        assert result[0]["solutionId"] == "sol-aaa"

    def test_handles_characteristic_as_json_string(self):
        """Should handle characteristic stored as JSON string."""
        mock_response = [
            {
                "id": "sp-001",
                "status": "pending",
                "characteristic": json.dumps([
                    {"name": "solutionId", "value": "sol-aaa"},
                    {"name": "remediationState", "value": "DETECTED"},
                ]),
            },
        ]

        client = TMFClient(base_url="http://mock", api_key="test")
        with patch.object(client, "_client") as mock_ctx:
            mock_http = MagicMock()
            mock_ctx.return_value.__enter__ = MagicMock(return_value=mock_http)
            mock_ctx.return_value.__exit__ = MagicMock(return_value=False)
            mock_http.get.return_value.json.return_value = mock_response
            mock_http.get.return_value.raise_for_status = MagicMock()

            result = client.discover_solutions()

        assert len(result) == 1
        assert result[0]["solutionId"] == "sol-aaa"

    def test_empty_response(self):
        """Should return empty list when no ServiceProblems match."""
        client = TMFClient(base_url="http://mock", api_key="test")
        with patch.object(client, "_client") as mock_ctx:
            mock_http = MagicMock()
            mock_ctx.return_value.__enter__ = MagicMock(return_value=mock_http)
            mock_ctx.return_value.__exit__ = MagicMock(return_value=False)
            mock_http.get.return_value.json.return_value = []
            mock_http.get.return_value.raise_for_status = MagicMock()

            result = client.discover_solutions()

        assert result == []

    def test_non_list_response_returns_empty(self):
        """Should handle non-list response gracefully."""
        client = TMFClient(base_url="http://mock", api_key="test")
        with patch.object(client, "_client") as mock_ctx:
            mock_http = MagicMock()
            mock_ctx.return_value.__enter__ = MagicMock(return_value=mock_http)
            mock_ctx.return_value.__exit__ = MagicMock(return_value=False)
            mock_http.get.return_value.json.return_value = {"error": "something"}
            mock_http.get.return_value.raise_for_status = MagicMock()

            result = client.discover_solutions()

        assert result == []

    def test_skips_entries_without_solution_id(self):
        """Should skip entries that have remediationState=DETECTED but no solutionId."""
        mock_response = [
            {
                "id": "sp-001",
                "status": "pending",
                "characteristic": [
                    {"name": "remediationState", "value": "DETECTED"},
                    # Missing solutionId
                ],
            },
        ]

        client = TMFClient(base_url="http://mock", api_key="test")
        with patch.object(client, "_client") as mock_ctx:
            mock_http = MagicMock()
            mock_ctx.return_value.__enter__ = MagicMock(return_value=mock_http)
            mock_ctx.return_value.__exit__ = MagicMock(return_value=False)
            mock_http.get.return_value.json.return_value = mock_response
            mock_http.get.return_value.raise_for_status = MagicMock()

            result = client.discover_solutions()

        assert result == []


# =============================================================================
# BatchExecutor ServiceProblem update tests
# =============================================================================

class TestExecutorServiceProblemUpdate:
    """Test that BatchExecutor updates ServiceProblem after remediation."""

    def test_sp_mapping_passed_to_executor(self):
        """Executor should accept and store SP mapping."""
        tmf = MagicMock()
        sp_map = {"sol-001": "sp-001", "sol-002": "sp-002"}
        executor = BatchExecutor(tmf, job_id="job-1", service_problem_mapping=sp_map)

        assert executor.sp_mapping == sp_map

    def test_sp_mapping_defaults_to_empty(self):
        """Executor without SP mapping should default to empty dict."""
        tmf = MagicMock()
        executor = BatchExecutor(tmf, job_id="job-1")

        assert executor.sp_mapping == {}

    def test_update_sp_called_on_success(self):
        """After successful remediation, SP should be updated to resolved."""
        tmf = MagicMock()
        sp_map = {"sol-001": "sp-001"}
        executor = BatchExecutor(tmf, job_id=None, service_problem_mapping=sp_map)

        # Mock all TMF calls to return success
        tmf.validate_solution.return_value = {"success": True, "solutionId": "sol-001", "macdDetails": ""}
        tmf.delete_solution.return_value = {"success": True}
        tmf.migrate_solution.return_value = {"success": True}
        tmf.poll_migration_status.return_value = {"status": "completed"}
        tmf.post_update_solution.return_value = {"success": True}

        results = executor.execute_batch(["sol-001"])

        assert len(results) == 1
        assert results[0].final_state == RemediationState.COMPLETED

        # Verify SP update was called (RemediationEngine uses "Remediation completed")
        tmf.update_service_problem.assert_called_once_with(
            "sp-001", "resolved", "COMPLETED", "Remediation completed"
        )

    def test_update_sp_called_on_skip(self):
        """When solution is skipped (MACD), SP should be updated to rejected/SKIPPED."""
        tmf = MagicMock()
        sp_map = {"sol-001": "sp-001"}
        executor = BatchExecutor(tmf, job_id=None, service_problem_mapping=sp_map)

        # Mock validation to show MACD exists
        tmf.validate_solution.return_value = {
            "success": True,
            "solutionId": "sol-001",
            "macdDetails": json.dumps({"macdBasketExists": True}),
        }

        results = executor.execute_batch(["sol-001"])

        assert len(results) == 1
        assert results[0].final_state == RemediationState.SKIPPED

        tmf.update_service_problem.assert_called_once_with(
            "sp-001", "rejected", "SKIPPED", "MACD exists but no basket details available - skipping for safety"
        )

    def test_update_sp_called_on_failure(self):
        """When remediation fails, SP should be updated to rejected/FAILED."""
        tmf = MagicMock()
        sp_map = {"sol-001": "sp-001"}
        executor = BatchExecutor(tmf, job_id=None, service_problem_mapping=sp_map)

        # Mock validation to fail
        tmf.validate_solution.return_value = {"success": False, "message": "Not found"}

        results = executor.execute_batch(["sol-001"])

        assert len(results) == 1
        assert results[0].final_state == RemediationState.FAILED

        tmf.update_service_problem.assert_called_once_with(
            "sp-001", "rejected", "FAILED", "Validation failed"
        )

    def test_no_sp_update_without_mapping(self):
        """When no SP mapping exists, SP update should be skipped."""
        tmf = MagicMock()
        executor = BatchExecutor(tmf, job_id=None)  # No SP mapping

        tmf.validate_solution.return_value = {"success": True, "solutionId": "sol-001", "macdDetails": ""}
        tmf.delete_solution.return_value = {"success": True}
        tmf.migrate_solution.return_value = {"success": True}
        tmf.poll_migration_status.return_value = {"status": "completed"}
        tmf.post_update_solution.return_value = {"success": True}

        results = executor.execute_batch(["sol-001"])

        assert len(results) == 1
        assert results[0].final_state == RemediationState.COMPLETED

        # SP update should NOT have been called
        tmf.update_service_problem.assert_not_called()

    def test_sp_update_failure_does_not_crash(self):
        """SP update failure should be logged but not crash the executor."""
        tmf = MagicMock()
        sp_map = {"sol-001": "sp-001"}
        executor = BatchExecutor(tmf, job_id=None, service_problem_mapping=sp_map)

        tmf.validate_solution.return_value = {"success": True, "solutionId": "sol-001", "macdDetails": ""}
        tmf.delete_solution.return_value = {"success": True}
        tmf.migrate_solution.return_value = {"success": True}
        tmf.poll_migration_status.return_value = {"status": "completed"}
        tmf.post_update_solution.return_value = {"success": True}
        tmf.update_service_problem.side_effect = Exception("SP API error")

        # Should not raise
        results = executor.execute_batch(["sol-001"])

        assert len(results) == 1
        assert results[0].final_state == RemediationState.COMPLETED

    def test_batch_updates_multiple_sps(self):
        """Batch of 2 solutions should update both ServiceProblems."""
        tmf = MagicMock()
        sp_map = {"sol-001": "sp-001", "sol-002": "sp-002"}
        executor = BatchExecutor(tmf, job_id=None, service_problem_mapping=sp_map)

        # Both succeed
        tmf.validate_solution.return_value = {"success": True, "macdDetails": ""}
        tmf.delete_solution.return_value = {"success": True}
        tmf.migrate_solution.return_value = {"success": True}
        tmf.poll_migration_status.return_value = {"status": "completed"}
        tmf.post_update_solution.return_value = {"success": True}

        results = executor.execute_batch(["sol-001", "sol-002"])

        assert len(results) == 2
        assert all(r.final_state == RemediationState.COMPLETED for r in results)

        # Both SPs should have been updated
        assert tmf.update_service_problem.call_count == 2
        tmf.update_service_problem.assert_any_call(
            "sp-001", "resolved", "COMPLETED", "Remediation completed"
        )
        tmf.update_service_problem.assert_any_call(
            "sp-002", "resolved", "COMPLETED", "Remediation completed"
        )


# =============================================================================
# Scheduler solution discovery wiring tests
# =============================================================================

class TestSchedulerDiscoveryWiring:
    """Test that the scheduler correctly wires discovery into _execute_schedule()."""

    def test_scheduler_calls_discover_solutions(self):
        """Scheduler should call discover_solutions when executing a schedule."""
        from app.services.scheduler import Scheduler, _parse_schedule
        from app.models.schemas import BatchSchedule, RecurrencePattern
        from datetime import datetime, time, timezone

        tmf = MagicMock()
        tmf.list_schedules.return_value = []
        tmf.create_job.return_value = {}
        tmf.list_jobs.return_value = [
            {"id": "job-001", "x_parentScheduleId": "sched-001", "state": "pending"}
        ]
        tmf.discover_solutions.return_value = []
        tmf.update_schedule.return_value = {}
        tmf.update_job.return_value = {}

        sched = Scheduler(tmf)
        schedule = BatchSchedule(
            id="sched-001",
            name="Test Schedule",
            category="SolutionEmpty",
            is_active=True,
            recurrence_pattern=RecurrencePattern.DAILY,
            max_batch_size=10,
            window_start_time=time(0, 0),
            window_end_time=time(23, 59),
            timezone="UTC",
        )

        job_id = sched._execute_schedule(schedule)

        assert job_id == "job-001"
        tmf.discover_solutions.assert_called_once_with(
            category="SolutionEmpty",
            max_count=10,
        )

    def test_scheduler_runs_executor_when_solutions_found(self):
        """When solutions are discovered, scheduler should run the executor."""
        from app.services.scheduler import Scheduler
        from app.models.schemas import BatchSchedule, RecurrencePattern
        from datetime import time

        tmf = MagicMock()
        tmf.create_job.return_value = {}
        tmf.list_jobs.return_value = [
            {"id": "job-001", "x_parentScheduleId": "sched-001", "state": "pending"}
        ]
        tmf.discover_solutions.return_value = [
            {"solutionId": "sol-aaa", "serviceProblemId": "sp-001"},
        ]
        tmf.update_schedule.return_value = {}
        tmf.update_job.return_value = {}
        # Mock the 5-step flow to succeed
        tmf.validate_solution.return_value = {"success": True, "macdDetails": ""}
        tmf.delete_solution.return_value = {"success": True}
        tmf.migrate_solution.return_value = {"success": True}
        tmf.poll_migration_status.return_value = {"status": "completed"}
        tmf.post_update_solution.return_value = {"success": True}

        sched = Scheduler(tmf)
        schedule = BatchSchedule(
            id="sched-001",
            name="Test Schedule",
            category="SolutionEmpty",
            is_active=True,
            recurrence_pattern=RecurrencePattern.DAILY,
            max_batch_size=10,
            window_start_time=time(0, 0),
            window_end_time=time(23, 59),
            timezone="UTC",
        )

        job_id = sched._execute_schedule(schedule)

        assert job_id == "job-001"
        # The executor should have called validate, delete, migrate, poll, post_update
        tmf.validate_solution.assert_called_once_with("sol-aaa")
        tmf.delete_solution.assert_called_once_with("sol-aaa")
        tmf.migrate_solution.assert_called_once_with("sol-aaa")
        tmf.post_update_solution.assert_called_once_with("sol-aaa", job_id=None, sfdc_updates=None)
        # SP should have been updated
        tmf.update_service_problem.assert_called_once()

    def test_scheduler_handles_empty_discovery(self):
        """When no solutions are found, scheduler should mark job as completed with 0 items."""
        from app.services.scheduler import Scheduler
        from app.models.schemas import BatchSchedule, RecurrencePattern
        from datetime import time

        tmf = MagicMock()
        tmf.create_job.return_value = {}
        tmf.list_jobs.return_value = [
            {"id": "job-001", "x_parentScheduleId": "sched-001", "state": "pending"}
        ]
        tmf.discover_solutions.return_value = []  # No solutions
        tmf.update_schedule.return_value = {}
        tmf.update_job.return_value = {}

        sched = Scheduler(tmf)
        schedule = BatchSchedule(
            id="sched-001",
            name="Test Schedule",
            category="SolutionEmpty",
            is_active=True,
            recurrence_pattern=RecurrencePattern.DAILY,
            max_batch_size=10,
            window_start_time=time(0, 0),
            window_end_time=time(23, 59),
            timezone="UTC",
        )

        job_id = sched._execute_schedule(schedule)

        assert job_id == "job-001"
        # Should mark job as completed with 0 items
        tmf.update_job.assert_any_call("job-001", {
            "state": "completed",
            "actualQuantity": 0,
            "x_summary": json.dumps({"total": 0, "successful": 0, "failed": 0, "skipped": 0, "pending": 0}),
        })
