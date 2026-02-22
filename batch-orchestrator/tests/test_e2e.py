"""
End-to-End Test (T6) - Full autonomous batch cycle.

Tests the complete flow:
1. Create a BatchSchedule via API with nextExecutionDate in the past
2. Run the scheduler → it should create a BatchJob automatically
3. Verify BatchJob was created with correct parent schedule reference
4. Verify schedule statistics were updated (totalExecutions++)
5. Clean up test data

IMPORTANT: This test creates and deletes real API data.

Usage:
    cd batch-orchestrator
    source .venv/bin/activate
    python -m pytest tests/test_e2e.py -v --tb=short
"""

import json
import time
import pytest
from datetime import datetime, timezone, timedelta

from app.services.tmf_client import TMFClient
from app.services.scheduler import Scheduler, _parse_schedule


@pytest.fixture(scope="module")
def tmf():
    """Create a TMF client connected to production ALB."""
    return TMFClient(
        base_url="http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com",
        api_key="bssmagic-d58d6761265b01accc13e8b21bae8282",
        timeout=30.0,
    )


class TestE2EAutonomousCycle:
    """Full end-to-end test of the autonomous batch cycle."""

    def test_schedule_triggers_job_creation(self, tmf):
        """
        E2E Test: Create schedule → scheduler creates job → verify stats.
        
        Steps:
        1. Create a BatchSchedule with nextExecutionDate in the past
        2. Run one scheduler cycle
        3. Verify a BatchJob was created
        4. Verify the schedule's totalExecutions was incremented
        5. Clean up
        """
        test_schedule_name = f"E2E Test Schedule - {int(time.time())}"
        created_schedule_id = None
        created_job_ids = []

        try:
            # ===== STEP 1: Create schedule with past execution date =====
            schedule_data = {
                "name": test_schedule_name,
                "description": "E2E test - auto-created, safe to delete",
                "category": "SolutionEmpty",
                "recurrencePattern": "daily",
                "windowStartTime": "00:00:00",
                "windowEndTime": "23:59:59",  # All-day window for testing
                "maxBatchSize": 5,
                "isActive": True,
                "selectionCriteria": "{\"remediationState\": \"DETECTED\", \"test\": true}",
                "nextExecutionDate": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
            }
            
            tmf.create_job  # Verify client works
            
            # Create the schedule
            from httpx import Client
            with Client(
                base_url=tmf.base_url,
                headers=tmf._headers,
                timeout=30.0,
            ) as client:
                resp = client.post(
                    "/tmf-api/batchProcessing/v1/batchSchedule",
                    json=schedule_data,
                )
                assert resp.status_code == 201, f"Failed to create schedule: {resp.status_code} {resp.text}"
            
            time.sleep(1)
            
            # Find the created schedule
            schedules = tmf.list_schedules()
            for s in schedules:
                if s.get("name") == test_schedule_name:
                    created_schedule_id = s["id"]
                    break
            
            assert created_schedule_id is not None, f"Could not find created schedule '{test_schedule_name}'"
            print(f"\n  Created schedule: {created_schedule_id}")

            # ===== STEP 2: Run one scheduler cycle =====
            scheduler = Scheduler(tmf)
            job_ids = scheduler.check_and_execute()
            
            print(f"  Scheduler created jobs: {job_ids}")
            
            # ===== STEP 3: Verify job was created =====
            # At least one job should have been created for our schedule
            assert len(job_ids) >= 1, "Scheduler should have created at least one job"
            created_job_ids.extend(job_ids)
            
            # Verify the job references our schedule
            for job_id in job_ids:
                job = tmf.get_job(job_id)
                print(f"  Job {job_id}: parentSchedule={job.get('x_parentScheduleId')}, state={job.get('state')}")
                
                if job.get("x_parentScheduleId") == created_schedule_id:
                    # Found the job created for our schedule
                    assert job.get("category") == "SolutionEmpty"
                    assert int(job.get("requestedQuantity", 0)) == 5
                    break
            else:
                # Check if any job matches
                all_jobs = tmf.list_jobs()
                matching = [j for j in all_jobs if j.get("x_parentScheduleId") == created_schedule_id]
                assert len(matching) > 0, "No job found with our schedule as parent"
                created_job_ids.extend([j["id"] for j in matching])

            # ===== STEP 4: Verify schedule stats updated =====
            schedule = tmf.get_schedule(created_schedule_id)
            print(f"  Schedule stats: totalExecutions={schedule.get('totalExecutions')}, "
                  f"lastExecutionId={schedule.get('lastExecutionId')}")
            
            assert int(schedule.get("totalExecutions", 0)) >= 1, \
                f"Schedule totalExecutions should be >= 1, got {schedule.get('totalExecutions')}"
            assert schedule.get("lastExecutionId") is not None, \
                "Schedule should have lastExecutionId set"

        finally:
            # ===== STEP 5: Clean up =====
            # Delete created jobs
            for job_id in created_job_ids:
                try:
                    tmf.delete_job(job_id)
                    print(f"  Cleaned up job: {job_id}")
                except Exception as e:
                    print(f"  Failed to clean up job {job_id}: {e}")
            
            # Delete created schedule
            if created_schedule_id:
                try:
                    from httpx import Client
                    with Client(
                        base_url=tmf.base_url,
                        headers=tmf._headers,
                        timeout=30.0,
                    ) as client:
                        resp = client.delete(
                            f"/tmf-api/batchProcessing/v1/batchSchedule/{created_schedule_id}"
                        )
                        print(f"  Cleaned up schedule: {created_schedule_id} (status={resp.status_code})")
                except Exception as e:
                    print(f"  Failed to clean up schedule {created_schedule_id}: {e}")

    def test_inactive_schedule_not_triggered(self, tmf):
        """
        E2E Test: Inactive schedule should NOT trigger job creation.
        """
        test_name = f"E2E Inactive Test - {int(time.time())}"
        created_id = None

        try:
            # Create an INACTIVE schedule with past execution date
            from httpx import Client
            with Client(
                base_url=tmf.base_url,
                headers=tmf._headers,
                timeout=30.0,
            ) as client:
                resp = client.post(
                    "/tmf-api/batchProcessing/v1/batchSchedule",
                    json={
                        "name": test_name,
                        "category": "SolutionEmpty",
                        "isActive": False,
                        "recurrencePattern": "daily",
                        "windowStartTime": "00:00:00",
                        "windowEndTime": "23:59:59",
                        "maxBatchSize": 5,
                        "nextExecutionDate": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
                    },
                )
                assert resp.status_code == 201
            
            time.sleep(1)
            
            # Find it
            schedules = tmf.list_schedules()
            for s in schedules:
                if s.get("name") == test_name:
                    created_id = s["id"]
                    break

            # Count existing jobs
            jobs_before = len(tmf.list_jobs())
            
            # Run scheduler
            scheduler = Scheduler(tmf)
            job_ids = scheduler.check_and_execute()
            
            # No new job should be created for our inactive schedule
            jobs_after = tmf.list_jobs()
            our_jobs = [j for j in jobs_after if j.get("x_parentScheduleId") == created_id]
            
            assert len(our_jobs) == 0, f"Inactive schedule should not trigger jobs, but found {len(our_jobs)}"

        finally:
            if created_id:
                try:
                    from httpx import Client
                    with Client(
                        base_url=tmf.base_url,
                        headers=tmf._headers,
                        timeout=30.0,
                    ) as client:
                        client.delete(f"/tmf-api/batchProcessing/v1/batchSchedule/{created_id}")
                except Exception:
                    pass
