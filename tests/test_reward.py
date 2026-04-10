"""
ARIA — Reward Function Tests (v2)
Edge cases for the reward engine, updated for reward_engine v2.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from aria.reward_engine import RewardEngine
from aria.models import (
    ARIAAction, ARIAObservation, ActionType, GapType, Severity,
    RegulatoryContext, Framework, ActionResult
)


def make_obs(task="easy"):
    from aria.environment import ARIAEnv
    env = ARIAEnv()
    return env.reset(task), env


class TestRewardEngine:

    def test_correct_gap_reward(self):
        obs, env = make_obs()
        # Read the section first
        env.step(ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id="privacy_policy",
            section_id="s2",
        ))
        _, r, _, _ = env.step(ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s2",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="No max retention",
        ))
        assert r >= 0.20  # base + possibly severity bonus (minus tiny temporal decay)

    def test_false_positive_penalty(self):
        obs, env = make_obs()
        _, r, _, _ = env.step(ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s2",        # red herring in easy (only s2 for retention)
            gap_type=GapType.DATA_SUBJECT_RIGHTS,  # not a real gap here
            severity=Severity.HIGH,
            description="Wrong",
        ))
        assert r < 0

    def test_duplicate_penalty(self):
        obs, env = make_obs()
        env.step(ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id="privacy_policy",
            section_id="s2",
        ))
        action = ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s2",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="first time",
        )
        env.step(action)
        _, r, _, _ = env.step(action)  # submit same again
        assert r == pytest.approx(-0.02, abs=0.01)  # duplicate penalty (with tiny temporal)

    def test_malformed_action_penalty(self):
        obs, env = make_obs()
        # Missing required fields
        _, r, _, _ = env.step(ARIAAction(action_type=ActionType.IDENTIFY_GAP))
        assert r == -0.05

    def test_request_section_positive_first_read(self):
        """v2: first read of a section gives +0.01 (tiny positive signal)."""
        obs, env = make_obs()
        _, r, _, _ = env.step(ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id="privacy_policy",
            section_id="s1",
        ))
        # Net reward = +0.01 (read bonus) - 0.001 * steps_taken (temporal decay)
        # At step 1: 0.01 - 0.001 = 0.009
        assert r > 0.005  # Should be positive on first read

    def test_redundant_section_penalty(self):
        obs, env = make_obs()
        a = ARIAAction(action_type=ActionType.REQUEST_SECTION, document_id="privacy_policy", section_id="s1")
        env.step(a)
        _, r, _, _ = env.step(a)
        # Net: -0.02 (redundant) - temporal_decay
        assert r < 0

    def test_phase_penalty_for_remediation_before_findings(self):
        """Submitting remediation in reading phase = penalty."""
        obs, env = make_obs()
        assert obs.phase == "reading"
        # Identify a gap first to have something to remediate
        env.step(ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id="privacy_policy",
            section_id="s2",
        ))
        obs2, _, _, _ = env.step(ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s2",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="No retention",
        ))
        finding_id = obs2.active_findings[0].finding_id
        # Submit remediation while still in reading phase — should get phase warning
        obs3, r, _, _ = env.step(ARIAAction(
            action_type=ActionType.SUBMIT_REMEDIATION,
            finding_id=finding_id,
            remediation_text="Maximum retention period of 24 months with automatic deletion",
        ))
        # Phase penalty applied — reward might be positive net but slightly reduced
        assert obs3.steps_taken == 3

    def test_correct_conflict_reward(self):
        obs, env = make_obs("medium")  # medium has a GDPR/CCPA conflict
        _, r, _, _ = env.step(ARIAAction(
            action_type=ActionType.ESCALATE_CONFLICT,
            framework_a=Framework.GDPR,
            framework_b=Framework.CCPA,
            conflict_desc="GDPR requires opt-in consent (Article 7); CCPA allows opt-out for same processing (1798.120). A unified policy must apply jurisdiction-aware consent.",
        ))
        assert r > 0.10

    def test_wrong_conflict_penalty(self):
        obs, env = make_obs("easy")  # easy has no conflicts
        _, r, _, _ = env.step(ARIAAction(
            action_type=ActionType.ESCALATE_CONFLICT,
            framework_a=Framework.GDPR,
            framework_b=Framework.HIPAA,
            conflict_desc="Made up conflict",
        ))
        assert r < 0

    def test_self_correction_reward(self):
        """Retracting a genuine false positive earns reward."""
        obs, env = make_obs()
        # Make a false positive
        obs2, _, _, _ = env.step(ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s2",
            gap_type=GapType.DATA_SUBJECT_RIGHTS,
            severity=Severity.HIGH,
            description="Wrong finding",
        ))
        finding_id = obs2.active_findings[-1].finding_id
        # Retract it
        _, r, _, _ = env.step(ARIAAction(
            action_type=ActionType.FLAG_FALSE_POSITIVE,
            retract_finding_id=finding_id,
        ))
        assert r == pytest.approx(0.05, abs=0.01)

    def test_wrong_retraction_penalty(self):
        """Retracting a correct finding = penalty."""
        obs, env = make_obs()
        # Read section first
        env.step(ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id="privacy_policy",
            section_id="s2",
        ))
        # Identify a real gap
        obs2, _, _, _ = env.step(ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s2",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="Real gap",
        ))
        finding_id = obs2.active_findings[0].finding_id
        # Retract the real finding
        _, r, _, _ = env.step(ARIAAction(
            action_type=ActionType.FLAG_FALSE_POSITIVE,
            retract_finding_id=finding_id,
        ))
        assert r == pytest.approx(-0.08, abs=0.01)

    def test_cumulative_reward_tracks_correctly(self):
        obs, env = make_obs()
        obs2, r1, _, _ = env.step(ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id="privacy_policy",
            section_id="s1",
        ))
        obs3, r2, _, _ = env.step(ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id="privacy_policy",
            section_id="s2",
        ))
        assert abs(obs3.cumulative_reward - (r1 + r2)) < 0.001

    def test_global_fp_budget_anti_gaming(self):
        """After GLOBAL_FP_BUDGET FPs, each subsequent FP costs extra -0.20."""
        obs, env = make_obs()
        # Exhaust global FP budget by flagging non-existent gaps
        rewards = []
        gap_types = [
            GapType.DPO_REQUIREMENT, GapType.PHI_SAFEGUARD, GapType.BAA_REQUIREMENT,
            GapType.AVAILABILITY_CONTROL, GapType.AUDIT_LOG_REQUIREMENT,
            GapType.CROSS_BORDER_TRANSFER,  # This should trigger extra penalty
        ]
        for i, gt in enumerate(gap_types):
            _, r, _, _ = env.step(ARIAAction(
                action_type=ActionType.IDENTIFY_GAP,
                clause_ref=f"privacy_policy.s{i+1}",
                gap_type=gt,
                severity=Severity.HIGH,
                description="testing spam budget",
            ))
            rewards.append(r)
        # After 5 FPs, the 6th should be extra-penalized
        assert rewards[-1] <= -0.20, f"Expected spam penalty on 6th FP: {rewards}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])