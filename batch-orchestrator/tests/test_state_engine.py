"""
Unit tests for the State Engine.
Tests all 15+ state transitions from the state diagram in doc 25.
"""

import pytest

from app.models.schemas import RemediationState, VALID_TRANSITIONS, TERMINAL_STATES
from app.services.state_engine import StateEngine, InvalidTransitionError


class TestStateEngineHappyPath:
    """Test the happy path: DETECTED → ... → COMPLETED"""

    def test_full_happy_path(self):
        """Test complete successful remediation flow."""
        engine = StateEngine("sol-001", "Test Solution")
        
        assert engine.current_state == RemediationState.DETECTED
        assert not engine.is_terminal
        
        # Step 1: Validate
        engine.transition(RemediationState.VALIDATING, "Starting validation")
        assert engine.current_state == RemediationState.VALIDATING
        
        engine.transition(RemediationState.VALIDATED, "No MACD basket")
        assert engine.current_state == RemediationState.VALIDATED
        
        # Step 2: Delete
        engine.transition(RemediationState.DELETING_SM_DATA, "Deleting SM artifacts")
        assert engine.current_state == RemediationState.DELETING_SM_DATA
        
        # Step 3: Migrate
        engine.transition(RemediationState.MIGRATING, "Starting migration")
        assert engine.current_state == RemediationState.MIGRATING
        
        # Step 4: Poll
        engine.transition(RemediationState.WAITING_CONFIRMATION, "Polling status")
        assert engine.current_state == RemediationState.WAITING_CONFIRMATION
        
        engine.transition(RemediationState.CONFIRMED, "Migration confirmed")
        assert engine.current_state == RemediationState.CONFIRMED
        
        # Step 5: Post-update
        engine.transition(RemediationState.POST_UPDATE, "Running post-update")
        assert engine.current_state == RemediationState.POST_UPDATE
        
        engine.transition(RemediationState.COMPLETED, "All done")
        assert engine.current_state == RemediationState.COMPLETED
        assert engine.is_terminal
        assert engine.is_success
        assert not engine.is_failed
        assert not engine.is_skipped
    
    def test_state_history_recorded(self):
        """Verify all transitions are recorded in state_history."""
        engine = StateEngine("sol-002")
        
        engine.transition(RemediationState.VALIDATING, "reason1")
        engine.transition(RemediationState.VALIDATED, "reason2")
        
        assert len(engine.state_history) == 2
        assert engine.state_history[0] == ("DETECTED", "VALIDATING", "reason1")
        assert engine.state_history[1] == ("VALIDATING", "VALIDATED", "reason2")


class TestStateEngineSkipPath:
    """Test the skip path: VALIDATING → SKIPPED"""

    def test_skip_for_macd(self):
        """When MACD exists, solution should be SKIPPED."""
        engine = StateEngine("sol-003")
        
        engine.transition(RemediationState.VALIDATING, "Starting")
        engine.transition(RemediationState.SKIPPED, "MACD basket exists")
        
        assert engine.current_state == RemediationState.SKIPPED
        assert engine.is_terminal
        assert engine.is_skipped
        assert not engine.is_success
        assert not engine.is_failed


class TestStateEngineFailurePaths:
    """Test each failure path."""

    def test_validation_failure(self):
        """VALIDATING → FAILED (validation error)."""
        engine = StateEngine("sol-004")
        
        engine.transition(RemediationState.VALIDATING, "Starting")
        engine.transition(RemediationState.FAILED, "API error")
        
        assert engine.is_terminal
        assert engine.is_failed
        assert engine.error == "API error"

    def test_delete_failure(self):
        """DELETING_SM_DATA → DELETE_FAILED → FAILED."""
        engine = StateEngine("sol-005")
        
        engine.transition(RemediationState.VALIDATING, "Starting")
        engine.transition(RemediationState.VALIDATED, "OK")
        engine.transition(RemediationState.DELETING_SM_DATA, "Deleting")
        engine.transition(RemediationState.DELETE_FAILED, "SF timeout")
        engine.transition(RemediationState.FAILED, "Delete operation failed")
        
        assert engine.is_failed
        assert engine.error == "Delete operation failed"

    def test_migration_failure(self):
        """MIGRATING → MIGRATION_FAILED → FAILED."""
        engine = StateEngine("sol-006")
        
        engine.transition(RemediationState.VALIDATING, "Starting")
        engine.transition(RemediationState.VALIDATED, "OK")
        engine.transition(RemediationState.DELETING_SM_DATA, "Deleting")
        engine.transition(RemediationState.MIGRATING, "Migrating")
        engine.transition(RemediationState.MIGRATION_FAILED, "Apex error")
        engine.transition(RemediationState.FAILED, "Migration failed")
        
        assert engine.is_failed

    def test_poll_failure(self):
        """WAITING_CONFIRMATION → MIGRATION_FAILED → FAILED."""
        engine = StateEngine("sol-007")
        
        engine.transition(RemediationState.VALIDATING, "Starting")
        engine.transition(RemediationState.VALIDATED, "OK")
        engine.transition(RemediationState.DELETING_SM_DATA, "Deleting")
        engine.transition(RemediationState.MIGRATING, "Migrating")
        engine.transition(RemediationState.WAITING_CONFIRMATION, "Polling")
        engine.transition(RemediationState.MIGRATION_FAILED, "Polling timeout")
        engine.transition(RemediationState.FAILED, "Migration polling timed out")
        
        assert engine.is_failed

    def test_post_update_failure(self):
        """POST_UPDATE → POST_UPDATE_FAILED → FAILED."""
        engine = StateEngine("sol-008")
        
        engine.transition(RemediationState.VALIDATING, "Starting")
        engine.transition(RemediationState.VALIDATED, "OK")
        engine.transition(RemediationState.DELETING_SM_DATA, "Deleting")
        engine.transition(RemediationState.MIGRATING, "Migrating")
        engine.transition(RemediationState.WAITING_CONFIRMATION, "Polling")
        engine.transition(RemediationState.CONFIRMED, "OK")
        engine.transition(RemediationState.POST_UPDATE, "Updating")
        engine.transition(RemediationState.POST_UPDATE_FAILED, "Update failed")
        engine.transition(RemediationState.FAILED, "Post-update failed")
        
        assert engine.is_failed


class TestStateEngineInvalidTransitions:
    """Test that invalid transitions are rejected."""

    def test_cannot_skip_steps(self):
        """Cannot go directly from DETECTED to VALIDATED (must go through VALIDATING)."""
        engine = StateEngine("sol-009")
        
        with pytest.raises(InvalidTransitionError) as exc_info:
            engine.transition(RemediationState.VALIDATED, "Skipping validation")
        
        assert exc_info.value.current == RemediationState.DETECTED
        assert exc_info.value.target == RemediationState.VALIDATED

    def test_cannot_go_backwards(self):
        """Cannot transition from VALIDATED back to DETECTED."""
        engine = StateEngine("sol-010")
        engine.transition(RemediationState.VALIDATING, "Start")
        engine.transition(RemediationState.VALIDATED, "OK")
        
        with pytest.raises(InvalidTransitionError):
            engine.transition(RemediationState.DETECTED, "Going back")

    def test_cannot_transition_from_terminal(self):
        """Terminal states have no valid transitions."""
        engine = StateEngine("sol-011")
        engine.transition(RemediationState.VALIDATING, "Start")
        engine.transition(RemediationState.SKIPPED, "MACD")
        
        with pytest.raises(InvalidTransitionError):
            engine.transition(RemediationState.VALIDATED, "Try to continue")

    def test_cannot_complete_from_detected(self):
        """Cannot go directly from DETECTED to COMPLETED."""
        engine = StateEngine("sol-012")
        
        with pytest.raises(InvalidTransitionError):
            engine.transition(RemediationState.COMPLETED, "Shortcut")

    def test_random_invalid_transition(self):
        """Cannot go from MIGRATING to VALIDATED."""
        engine = StateEngine("sol-013")
        engine.transition(RemediationState.VALIDATING, "Start")
        engine.transition(RemediationState.VALIDATED, "OK")
        engine.transition(RemediationState.DELETING_SM_DATA, "Delete")
        engine.transition(RemediationState.MIGRATING, "Migrate")
        
        with pytest.raises(InvalidTransitionError):
            engine.transition(RemediationState.VALIDATED, "Go back to validated")


class TestStateEngineHelpers:
    """Test helper methods."""

    def test_can_transition(self):
        engine = StateEngine("sol-014")
        
        assert engine.can_transition(RemediationState.VALIDATING) is True
        assert engine.can_transition(RemediationState.COMPLETED) is False
        assert engine.can_transition(RemediationState.FAILED) is False

    def test_get_result(self):
        engine = StateEngine("sol-015", "Test Sol")
        engine.transition(RemediationState.VALIDATING, "Start")
        engine.transition(RemediationState.SKIPPED, "MACD")
        
        result = engine.get_result()
        assert result.solution_id == "sol-015"
        assert result.solution_name == "Test Sol"
        assert result.final_state == RemediationState.SKIPPED
        assert len(result.state_history) == 2
        assert result.duration_seconds >= 0

    def test_repr(self):
        engine = StateEngine("sol-016")
        assert "sol-016" in repr(engine)
        assert "DETECTED" in repr(engine)


class TestAllTransitionsDocumented:
    """Verify the transition map is complete and consistent."""

    def test_all_states_have_transitions_defined(self):
        """Every RemediationState should appear in VALID_TRANSITIONS."""
        for state in RemediationState:
            assert state in VALID_TRANSITIONS, f"{state} missing from VALID_TRANSITIONS"

    def test_terminal_states_have_no_transitions(self):
        """Terminal states should have empty transition lists."""
        for state in TERMINAL_STATES:
            assert VALID_TRANSITIONS[state] == [], f"{state} should have no transitions"

    def test_non_terminal_states_have_transitions(self):
        """Non-terminal states should have at least one valid transition."""
        for state in RemediationState:
            if state not in TERMINAL_STATES:
                assert len(VALID_TRANSITIONS[state]) > 0, f"{state} should have transitions"
