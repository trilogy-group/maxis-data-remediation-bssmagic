"""
Schedule Checker for Batch Orchestrator.
Determines whether a BatchSchedule should trigger execution based on:
  - isActive flag
  - nextExecutionDate <= now
  - Current time within windowStartTime..windowEndTime (in schedule's timezone)
"""

from datetime import datetime, time, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from ..models.schemas import BatchSchedule


class ScheduleChecker:
    """
    Evaluates batch schedules to determine if they should execute.
    
    A schedule is ready to execute when ALL conditions are met:
    1. isActive is True
    2. nextExecutionDate is set and <= current time
    3. Current time is within the execution window [windowStartTime, windowEndTime]
    """

    def __init__(self, now: Optional[datetime] = None):
        """
        Args:
            now: Override current time for testing. If None, uses UTC now.
        """
        self._now = now

    @property
    def now(self) -> datetime:
        """Current time in UTC."""
        if self._now:
            return self._now
        return datetime.now(timezone.utc)

    def is_ready(self, schedule: BatchSchedule) -> bool:
        """
        Check if a schedule should trigger execution now.
        
        Args:
            schedule: The BatchSchedule to evaluate
            
        Returns:
            True if the schedule should execute now
        """
        # Condition 1: Must be active
        if not schedule.is_active:
            return False

        # Condition 2: Must have a next execution date that's in the past
        if schedule.next_execution_date is None:
            return False
        
        # Ensure next_execution_date is timezone-aware
        next_exec = schedule.next_execution_date
        if next_exec.tzinfo is None:
            next_exec = next_exec.replace(tzinfo=timezone.utc)
        
        if next_exec > self.now:
            return False

        # Condition 3: Current time must be within execution window
        if not self._is_within_window(
            schedule.window_start_time,
            schedule.window_end_time,
            schedule.timezone,
        ):
            return False

        return True

    def _is_within_window(
        self,
        start_time: time,
        end_time: time,
        tz_name: str,
    ) -> bool:
        """
        Check if current time is within the execution window.
        
        Handles the case where window crosses midnight:
          - start=22:00, end=06:00 means 22:00-23:59 and 00:00-06:00
        
        Args:
            start_time: Window start (e.g., 00:00)
            end_time: Window end (e.g., 06:00)
            tz_name: Timezone name (e.g., 'UTC', 'Asia/Kuala_Lumpur')
        """
        try:
            tz = ZoneInfo(tz_name)
        except (KeyError, ValueError):
            # Invalid timezone, default to UTC
            tz = ZoneInfo("UTC")

        local_now = self.now.astimezone(tz)
        current_time = local_now.time()

        if start_time <= end_time:
            # Normal window (e.g., 00:00 to 06:00)
            return start_time <= current_time <= end_time
        else:
            # Window crosses midnight (e.g., 22:00 to 06:00)
            return current_time >= start_time or current_time <= end_time

    def get_ready_schedules(self, schedules: list[BatchSchedule]) -> list[BatchSchedule]:
        """
        Filter a list of schedules to only those ready for execution.
        
        Args:
            schedules: List of all schedules
            
        Returns:
            Filtered list of schedules that should execute now
        """
        return [s for s in schedules if self.is_ready(s)]
