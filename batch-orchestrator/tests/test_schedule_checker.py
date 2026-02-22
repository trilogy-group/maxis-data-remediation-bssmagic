"""
Unit tests for the Schedule Checker.
Tests schedule readiness based on isActive, nextExecutionDate, and execution window.
"""

import pytest
from datetime import datetime, time, timezone, timedelta
from zoneinfo import ZoneInfo

from app.models.schemas import BatchSchedule, RecurrencePattern
from app.services.schedule_checker import ScheduleChecker


def _make_schedule(
    is_active: bool = True,
    next_execution_date: datetime = None,
    window_start: time = time(0, 0),
    window_end: time = time(6, 0),
    tz: str = "UTC",
    **kwargs,
) -> BatchSchedule:
    """Helper to create test schedules."""
    return BatchSchedule(
        id="test-sched-001",
        name="Test Schedule",
        category="SolutionEmpty",
        is_active=is_active,
        next_execution_date=next_execution_date,
        window_start_time=window_start,
        window_end_time=window_end,
        timezone=tz,
        **kwargs,
    )


class TestScheduleCheckerBasics:
    """Test basic ready/not-ready conditions."""

    def test_inactive_schedule_not_ready(self):
        """Inactive schedules should never be ready."""
        now = datetime(2026, 2, 9, 2, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            is_active=False,
            next_execution_date=datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc),
        )
        
        assert checker.is_ready(schedule) is False

    def test_no_next_execution_not_ready(self):
        """Schedule with no nextExecutionDate should not be ready."""
        now = datetime(2026, 2, 9, 2, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            is_active=True,
            next_execution_date=None,
        )
        
        assert checker.is_ready(schedule) is False

    def test_future_execution_not_ready(self):
        """Schedule with future nextExecutionDate should not be ready."""
        now = datetime(2026, 2, 9, 2, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            is_active=True,
            next_execution_date=datetime(2026, 2, 10, 0, 0, tzinfo=timezone.utc),
        )
        
        assert checker.is_ready(schedule) is False

    def test_past_execution_within_window_is_ready(self):
        """Schedule with past nextExecutionDate within window should be ready."""
        now = datetime(2026, 2, 9, 2, 0, tzinfo=timezone.utc)  # 2:00 AM UTC
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            is_active=True,
            next_execution_date=datetime(2026, 2, 9, 0, 0, tzinfo=timezone.utc),
            window_start=time(0, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is True

    def test_past_execution_outside_window_not_ready(self):
        """Schedule with past nextExecutionDate but outside window should not be ready."""
        now = datetime(2026, 2, 9, 14, 0, tzinfo=timezone.utc)  # 2:00 PM UTC
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            is_active=True,
            next_execution_date=datetime(2026, 2, 9, 0, 0, tzinfo=timezone.utc),
            window_start=time(0, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is False


class TestExecutionWindow:
    """Test execution window boundary conditions."""

    def test_exactly_at_window_start(self):
        """Schedule should be ready when exactly at window start time."""
        now = datetime(2026, 2, 9, 0, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc),
            window_start=time(0, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is True

    def test_exactly_at_window_end(self):
        """Schedule should be ready when exactly at window end time."""
        now = datetime(2026, 2, 9, 6, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc),
            window_start=time(0, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is True

    def test_one_second_after_window_end(self):
        """Schedule should NOT be ready one second after window end."""
        now = datetime(2026, 2, 9, 6, 0, 1, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc),
            window_start=time(0, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is False

    def test_midnight_crossing_window(self):
        """Test window that crosses midnight (e.g., 22:00 to 06:00)."""
        # 23:30 should be within 22:00-06:00
        now = datetime(2026, 2, 9, 23, 30, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 9, 0, 0, tzinfo=timezone.utc),
            window_start=time(22, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is True

    def test_midnight_crossing_window_early_morning(self):
        """03:00 should be within 22:00-06:00."""
        now = datetime(2026, 2, 9, 3, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc),
            window_start=time(22, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is True

    def test_midnight_crossing_window_outside(self):
        """12:00 should NOT be within 22:00-06:00."""
        now = datetime(2026, 2, 9, 12, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc),
            window_start=time(22, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is False


class TestTimezoneHandling:
    """Test timezone conversion."""

    def test_kuala_lumpur_timezone(self):
        """Malaysia time is UTC+8. 2:00 AM MYT = 18:00 UTC previous day."""
        # It's 18:00 UTC = 2:00 AM MYT next day
        now = datetime(2026, 2, 9, 18, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        
        # Window 0:00-6:00 MYT, current MYT time is 2:00 AM
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 9, 0, 0, tzinfo=timezone.utc),
            window_start=time(0, 0),
            window_end=time(6, 0),
            tz="Asia/Kuala_Lumpur",
        )
        
        assert checker.is_ready(schedule) is True

    def test_kuala_lumpur_outside_window(self):
        """When it's noon in KL but window is 0-6 AM, should not be ready."""
        # 04:00 UTC = 12:00 MYT
        now = datetime(2026, 2, 9, 4, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc),
            window_start=time(0, 0),
            window_end=time(6, 0),
            tz="Asia/Kuala_Lumpur",
        )
        
        assert checker.is_ready(schedule) is False

    def test_invalid_timezone_defaults_to_utc(self):
        """Invalid timezone should fall back to UTC."""
        now = datetime(2026, 2, 9, 2, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        
        schedule = _make_schedule(
            next_execution_date=datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc),
            window_start=time(0, 0),
            window_end=time(6, 0),
            tz="Invalid/Timezone",
        )
        
        assert checker.is_ready(schedule) is True


class TestGetReadySchedules:
    """Test filtering multiple schedules."""

    def test_filters_correctly(self):
        """Only ready schedules should be returned."""
        now = datetime(2026, 2, 9, 2, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        
        schedules = [
            _make_schedule(
                is_active=True,
                next_execution_date=datetime(2026, 2, 9, 0, 0, tzinfo=timezone.utc),
            ),
            _make_schedule(
                is_active=False,  # Inactive
                next_execution_date=datetime(2026, 2, 9, 0, 0, tzinfo=timezone.utc),
            ),
            _make_schedule(
                is_active=True,
                next_execution_date=datetime(2026, 2, 10, 0, 0, tzinfo=timezone.utc),  # Future
            ),
        ]
        
        ready = checker.get_ready_schedules(schedules)
        assert len(ready) == 1
        assert ready[0].is_active is True

    def test_empty_list(self):
        """Empty input returns empty output."""
        checker = ScheduleChecker()
        assert checker.get_ready_schedules([]) == []


class TestNaiveDatetimeHandling:
    """Test handling of naive (timezone-unaware) datetimes."""

    def test_naive_next_execution_date(self):
        """Naive datetime should be treated as UTC."""
        now = datetime(2026, 2, 9, 2, 0, tzinfo=timezone.utc)
        checker = ScheduleChecker(now=now)
        
        schedule = _make_schedule(
            is_active=True,
            next_execution_date=datetime(2026, 2, 9, 0, 0),  # Naive!
            window_start=time(0, 0),
            window_end=time(6, 0),
        )
        
        assert checker.is_ready(schedule) is True
