"""
State Engine for Batch Remediation.
Manages deterministic state transitions for individual solutions
within a batch job.
"""

from datetime import datetime, timezone
from typing import Optional

from ..models.schemas import (
    RemediationState,
    VALID_TRANSITIONS,
    TERMINAL_STATES,
    SolutionResult,
)


class InvalidTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""

    def __init__(self, current: RemediationState, target: RemediationState):
        self.current = current
        self.target = target
        super().__init__(
            f"Invalid transition: {current.value} -> {target.value}. "
            f"Valid targets: {[t.value for t in VALID_TRANSITIONS.get(current, [])]}"
        )


class StateEngine:
    """
    Manages the remediation state machine for a single solution.
    
    State Flow (happy path):
        DETECTED → VALIDATING → VALIDATED → DELETING_SM_DATA → MIGRATING 
        → WAITING_CONFIRMATION → CONFIRMED → POST_UPDATE → COMPLETED
    
    Skip path:
        VALIDATING → SKIPPED (MACD exists)
    
    Failure paths:
        DELETING_SM_DATA → DELETE_FAILED → FAILED
        MIGRATING → MIGRATION_FAILED → FAILED
        WAITING_CONFIRMATION → MIGRATION_FAILED → FAILED
        POST_UPDATE → POST_UPDATE_FAILED → FAILED
    """

    def __init__(self, solution_id: str, solution_name: Optional[str] = None):
        self.solution_id = solution_id
        self.solution_name = solution_name
        self.current_state = RemediationState.DETECTED
        self.state_history: list[tuple[str, str, str]] = []  # (from, to, reason)
        self.start_time = datetime.now(timezone.utc)
        self.error: Optional[str] = None

    @property
    def is_terminal(self) -> bool:
        """Check if the current state is a terminal state."""
        return self.current_state in TERMINAL_STATES

    @property
    def is_success(self) -> bool:
        """Check if the solution was successfully completed."""
        return self.current_state == RemediationState.COMPLETED

    @property
    def is_skipped(self) -> bool:
        """Check if the solution was skipped."""
        return self.current_state == RemediationState.SKIPPED

    @property
    def is_failed(self) -> bool:
        """Check if the solution failed."""
        return self.current_state == RemediationState.FAILED

    def can_transition(self, target: RemediationState) -> bool:
        """Check if a transition to the target state is valid."""
        valid_targets = VALID_TRANSITIONS.get(self.current_state, [])
        return target in valid_targets

    def transition(self, target: RemediationState, reason: str = "") -> RemediationState:
        """
        Attempt a state transition.
        
        Args:
            target: The target state
            reason: Human-readable reason for the transition
            
        Returns:
            The new current state
            
        Raises:
            InvalidTransitionError: If the transition is not valid
        """
        if not self.can_transition(target):
            raise InvalidTransitionError(self.current_state, target)

        from_state = self.current_state.value
        self.state_history.append((from_state, target.value, reason))
        self.current_state = target

        if target == RemediationState.FAILED:
            self.error = reason

        return self.current_state

    def get_result(self) -> SolutionResult:
        """Generate the final result for this solution."""
        duration = (datetime.now(timezone.utc) - self.start_time).total_seconds()
        return SolutionResult(
            solution_id=self.solution_id,
            solution_name=self.solution_name,
            final_state=self.current_state,
            state_history=self.state_history,
            error=self.error,
            duration_seconds=round(duration, 2),
        )

    def __repr__(self) -> str:
        return f"StateEngine(solution={self.solution_id}, state={self.current_state.value})"
