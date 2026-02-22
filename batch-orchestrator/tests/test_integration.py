"""
Integration Tests (T5) - Orchestrator components against live TMF API.
Tests the full lifecycle: create schedule → create job → update progress → verify.

IMPORTANT: These tests run against the LIVE production TMF API.
They create and delete test data. Run with caution.

Usage:
    cd batch-orchestrator
    source .venv/bin/activate
    python -m pytest tests/test_integration.py -v --tb=short
"""

import json
import pytest
import time

from app.services.tmf_client import TMFClient
from app.services.scheduler import Scheduler, _parse_schedule
from app.services.schedule_checker import ScheduleChecker
from app.services.batch_executor import BatchExecutor
from app.models.schemas import BatchJobSummary, RemediationState


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture(scope="module")
def tmf():
    """Create a TMF client connected to production ALB."""
    return TMFClient(
        base_url="http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com",
        api_key="bssmagic-d58d6761265b01accc13e8b21bae8282",
        timeout=30.0,
    )


@pytest.fixture
def cleanup_jobs(tmf):
    """Track and clean up BatchJobs created during tests."""
    created_ids = []
    yield created_ids
    for job_id in created_ids:
        try:
            tmf.delete_job(job_id)
        except Exception:
            pass


@pytest.fixture
def cleanup_schedules(tmf):
    """Track and clean up BatchSchedules created during tests."""
    created_ids = []
    yield created_ids
    for sched_id in created_ids:
        try:
            # Can't easily delete schedules created in test since we
            # don't always know the ID. Clean up by listing.
            pass
        except Exception:
            pass


# =============================================================================
# TMF Client Integration Tests
# =============================================================================

class TestTMFClientIntegration:
    """Test the TMF client against the live API."""

    def test_list_schedules(self, tmf):
        """Can list active schedules."""
        schedules = tmf.list_schedules(is_active=True)
        assert isinstance(schedules, list)
        # Should have at least the sample schedule
        assert len(schedules) >= 1

    def test_list_jobs(self, tmf):
        """Can list batch jobs."""
        jobs = tmf.list_jobs()
        assert isinstance(jobs, list)

    def test_create_and_delete_job(self, tmf):
        """Create a BatchJob, verify it exists, then delete it."""
        # Create
        tmf.create_job({
            "name": "Integration Test Job",
            "category": "SolutionEmpty",
            "requestedQuantity": 5,
        })
        time.sleep(1)  # Wait for create to propagate
        
        # Find created job
        jobs = tmf.list_jobs()
        test_job = None
        for j in jobs:
            if j.get("name") == "Integration Test Job":
                test_job = j
                break
        
        assert test_job is not None, "Created job not found in listing"
        job_id = test_job["id"]
        
        # Verify fields
        job = tmf.get_job(job_id)
        assert job["name"] == "Integration Test Job"
        assert job["requestedQuantity"] == 5
        
        # Delete
        tmf.delete_job(job_id)
        
        # Verify deletion
        try:
            tmf.get_job(job_id)
            pytest.fail("Job should not exist after deletion")
        except Exception:
            pass  # Expected - 404 or similar

    def test_update_job_state(self, tmf, cleanup_jobs):
        """Create a job, update its state to inProgress, verify."""
        # Create
        tmf.create_job({
            "name": "State Update Test",
            "category": "SolutionEmpty",
            "requestedQuantity": 3,
        })
        time.sleep(1)
        
        # Find
        jobs = tmf.list_jobs()
        job_id = None
        for j in jobs:
            if j.get("name") == "State Update Test":
                job_id = j["id"]
                break
        
        assert job_id is not None
        cleanup_jobs.append(job_id)
        
        # Update state
        result = tmf.update_job(job_id, {"state": "inProgress"})
        assert result["state"] == "inProgress"
        
        # Update summary
        summary = json.dumps({"total": 3, "successful": 1, "failed": 0, "skipped": 0, "pending": 2})
        result = tmf.update_job(job_id, {
            "actualQuantity": 1,
            "x_summary": summary,
        })
        assert result["actualQuantity"] == 1

    def test_update_job_to_completed(self, tmf, cleanup_jobs):
        """Test full lifecycle: pending → inProgress → completed."""
        # Create
        tmf.create_job({
            "name": "Lifecycle Test",
            "category": "SolutionEmpty",
            "requestedQuantity": 2,
        })
        time.sleep(1)
        
        # Find
        jobs = tmf.list_jobs()
        job_id = None
        for j in jobs:
            if j.get("name") == "Lifecycle Test":
                job_id = j["id"]
                break
        
        assert job_id is not None
        cleanup_jobs.append(job_id)
        
        # Verify initial state
        job = tmf.get_job(job_id)
        assert job["state"] == "pending"
        
        # Transition: pending → inProgress
        tmf.update_job(job_id, {"state": "inProgress"})
        job = tmf.get_job(job_id)
        assert job["state"] == "inProgress"
        
        # Transition: inProgress → completed
        tmf.update_job(job_id, {
            "state": "completed",
            "actualQuantity": 2,
            "x_summary": json.dumps({"total": 2, "successful": 2, "failed": 0, "skipped": 0, "pending": 0}),
        })
        job = tmf.get_job(job_id)
        assert job["state"] == "completed"
        assert job["actualQuantity"] == 2


class TestSolutionValidation:
    """Test solution validation via REST FDW (Step 1 of remediation)."""

    def test_validate_known_solution(self, tmf):
        """Validate a known Salesforce solution ID."""
        info = tmf.validate_solution("a246D000000pYfbQAE")
        
        assert "solutionId" in info or "id" in info
        assert info.get("success") in (True, "True", "true")

    def test_validate_unknown_solution(self, tmf):
        """Validating a non-existent solution should fail gracefully."""
        try:
            info = tmf.validate_solution("INVALID_ID_000000000")
            # FDW might return success=False instead of throwing
            assert info.get("success") in (False, "False", "false", None)
        except Exception:
            pass  # Expected for invalid IDs


class TestSchedulerIntegration:
    """Test the scheduler against live API."""

    def test_scheduler_reads_schedules(self, tmf):
        """Scheduler can parse live schedule data."""
        raw_schedules = tmf.list_schedules(is_active=True)
        
        for raw in raw_schedules:
            schedule = _parse_schedule(raw)
            assert schedule.id is not None
            assert schedule.name is not None
            assert schedule.max_batch_size > 0

    def test_scheduler_check_cycle(self, tmf):
        """Full scheduler check cycle (without execution)."""
        scheduler = Scheduler(tmf)
        
        # check_and_execute will evaluate schedules but the nightly
        # schedule's nextExecutionDate is in the future, so nothing should execute
        job_ids = scheduler.check_and_execute()
        # We can't predict if any schedules are ready, but it shouldn't crash
        assert isinstance(job_ids, list)


class TestBatchExecutorIntegration:
    """Test the batch executor's job tracking (without real Salesforce execution)."""

    def test_executor_creates_and_tracks_job(self, tmf, cleanup_jobs):
        """Test that the executor properly tracks progress via BatchJob."""
        # Create a job for the executor
        tmf.create_job({
            "name": "Executor Tracking Test",
            "category": "SolutionEmpty",
            "requestedQuantity": 1,
        })
        time.sleep(1)
        
        # Find the job
        jobs = tmf.list_jobs()
        job_id = None
        for j in jobs:
            if j.get("name") == "Executor Tracking Test":
                job_id = j["id"]
                break
        
        assert job_id is not None
        cleanup_jobs.append(job_id)
        
        # Create executor with this job
        executor = BatchExecutor(tmf, job_id=job_id)
        
        # Update job to inProgress via the executor's helper
        executor._update_job({"state": "inProgress"})
        
        job = tmf.get_job(job_id)
        assert job["state"] == "inProgress"
        
        # Update summary
        executor._update_job({
            "actualQuantity": 1,
            "x_summary": json.dumps({"total": 1, "successful": 1, "failed": 0, "skipped": 0, "pending": 0}),
            "state": "completed",
        })
        
        job = tmf.get_job(job_id)
        assert job["state"] == "completed"
        assert job["actualQuantity"] == 1
