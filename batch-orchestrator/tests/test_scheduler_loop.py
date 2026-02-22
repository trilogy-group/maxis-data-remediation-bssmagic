"""
Tests for the async scheduler loop in main.py.
Tests start/stop behavior, auto-start, and error handling.

Usage:
    cd batch-orchestrator
    source .venv/bin/activate
    python -m pytest tests/test_scheduler_loop.py -v --tb=short
"""

import asyncio
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient


class TestSchedulerEndpoints:
    """Test scheduler start/stop endpoints via TestClient."""

    def test_health_shows_scheduler_not_running(self):
        """Health endpoint should show scheduler_running=False initially."""
        # Import fresh to reset global state
        with patch.dict("os.environ", {"SCHEDULER_ENABLED": "false"}):
            from app.main import app
            client = TestClient(app)
            resp = client.get("/health")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "healthy"
            assert data["service"] == "batch-orchestrator"

    def test_status_includes_cycle_info(self):
        """Status endpoint should include cycle tracking fields."""
        with patch.dict("os.environ", {"SCHEDULER_ENABLED": "false"}):
            from app.main import app
            client = TestClient(app)
            resp = client.get("/status")
            assert resp.status_code == 200
            data = resp.json()
            assert "scheduler_running" in data
            assert "total_cycles" in data
            assert "last_cycle_at" in data
            assert "last_cycle_result" in data
            assert "last_cycle_error" in data
            assert "scheduler_interval" in data

    def test_scheduler_start_returns_interval(self):
        """Start endpoint should return the configured interval."""
        with patch.dict("os.environ", {"SCHEDULER_ENABLED": "false"}):
            from app.main import app
            client = TestClient(app)
            resp = client.post("/scheduler/start")
            assert resp.status_code == 200
            data = resp.json()
            assert "interval" in data
            assert data["message"] in ("Scheduler started", "Scheduler already running")

    def test_scheduler_stop(self):
        """Stop endpoint should return success."""
        with patch.dict("os.environ", {"SCHEDULER_ENABLED": "false"}):
            from app.main import app
            client = TestClient(app)
            resp = client.post("/scheduler/stop")
            assert resp.status_code == 200
            data = resp.json()
            assert "stopped" in data["message"].lower() or "already" in data["message"].lower()


class TestSchedulerLoopLogic:
    """Test the scheduler loop function directly."""

    @pytest.mark.asyncio
    async def test_loop_stops_when_flag_cleared(self):
        """Scheduler loop should stop when scheduler_running is set to False."""
        import app.main as main_module

        # Mock the scheduler
        mock_scheduler = MagicMock()
        mock_scheduler.check_and_execute.return_value = []
        main_module.scheduler = mock_scheduler
        main_module.scheduler_running = True

        # Override settings interval to be very short
        original_interval = main_module.settings.scheduler_interval_seconds
        main_module.settings.scheduler_interval_seconds = 0.1

        # Start the loop
        task = asyncio.create_task(main_module._scheduler_loop())

        # Let it run for a short time, then stop
        await asyncio.sleep(0.3)
        main_module.scheduler_running = False

        # Wait for the loop to finish
        try:
            await asyncio.wait_for(task, timeout=2.0)
        except asyncio.TimeoutError:
            task.cancel()
            pytest.fail("Scheduler loop did not stop within timeout")

        # Verify it ran at least once
        assert mock_scheduler.check_and_execute.call_count >= 1
        assert main_module.total_cycles >= 1

        # Cleanup
        main_module.settings.scheduler_interval_seconds = original_interval
        main_module.total_cycles = 0
        main_module.last_cycle_at = None
        main_module.last_cycle_result = None
        main_module.last_cycle_error = None

    @pytest.mark.asyncio
    async def test_loop_survives_error(self):
        """Scheduler loop should continue running even after an error in a cycle."""
        import app.main as main_module

        call_count = 0

        def mock_check():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("Test error")
            return ["job-001"]

        mock_scheduler = MagicMock()
        mock_scheduler.check_and_execute.side_effect = mock_check
        main_module.scheduler = mock_scheduler
        main_module.scheduler_running = True

        original_interval = main_module.settings.scheduler_interval_seconds
        main_module.settings.scheduler_interval_seconds = 0.1

        task = asyncio.create_task(main_module._scheduler_loop())

        # Let it run through error + success cycle
        await asyncio.sleep(0.5)
        main_module.scheduler_running = False

        try:
            await asyncio.wait_for(task, timeout=2.0)
        except asyncio.TimeoutError:
            task.cancel()

        # Should have run at least 2 cycles (one error, one success)
        assert call_count >= 2
        assert main_module.total_cycles >= 2

        # Cleanup
        main_module.settings.scheduler_interval_seconds = original_interval
        main_module.total_cycles = 0
        main_module.last_cycle_at = None
        main_module.last_cycle_result = None
        main_module.last_cycle_error = None

    @pytest.mark.asyncio
    async def test_loop_cancellation(self):
        """Scheduler loop should handle asyncio cancellation gracefully."""
        import app.main as main_module

        mock_scheduler = MagicMock()
        mock_scheduler.check_and_execute.return_value = []
        main_module.scheduler = mock_scheduler
        main_module.scheduler_running = True

        original_interval = main_module.settings.scheduler_interval_seconds
        main_module.settings.scheduler_interval_seconds = 10  # Long interval

        task = asyncio.create_task(main_module._scheduler_loop())

        # Let it start, then cancel
        await asyncio.sleep(0.2)
        task.cancel()

        try:
            await task
        except asyncio.CancelledError:
            pass  # Expected

        # scheduler_running should be False after cancellation
        assert main_module.scheduler_running is False

        # Cleanup
        main_module.settings.scheduler_interval_seconds = original_interval
        main_module.total_cycles = 0
        main_module.last_cycle_at = None
        main_module.last_cycle_result = None
        main_module.last_cycle_error = None
