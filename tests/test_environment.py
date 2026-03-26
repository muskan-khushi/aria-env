"""ARIA — Test Suite"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from aria.environment import ARIAEnv
from aria.models import ARIAAction, ActionType, GapType, Severity, Framework
from aria.grader import Grader
from aria.reward_engine import RewardEngine
from aria.evidence import EvidenceChainValidator


# ─── Environment contract tests ───────────────────────────────────────────────

class TestEnvironmentContract:

    def test_reset_returns_observation(self):
        env = ARIAEnv()
        obs = env.reset("easy")
        assert obs.session_id
        assert obs.task_id == "easy_1"
        assert obs.steps_taken == 0
        assert obs.done == False
        assert obs.phase == "reading"
        assert len(obs.documents) > 0

    def test_state_matches_obs_after_reset(self):
        env = ARIAEnv()
        obs = env.reset("easy")
        state = env.state()
        assert state.session_id == obs.session_id
        assert state.steps_taken == 0

    def test_step_request_section(self):
        env = ARIAEnv()
        obs = env.reset("easy")
        doc = obs.documents[0]
        section = doc.sections[0]
        action = ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id=doc.doc_id,
            section_id=section.section_id,
        )
        new_obs, reward, done, info = env.step(action)
        assert not done
        assert new_obs.steps_taken == 1
        assert f"{doc.doc_id}.{section.section_id}" in new_obs.visible_sections
        assert reward == 0.0

    def test_redundant_read_penalty(self):
        env = ARIAEnv()
        obs = env.reset("easy")
        doc = obs.documents[0]
        section = doc.sections[0]
        action = ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id=doc.doc_id,
            section_id=section.section_id,
        )
        env.step(action)
        _, reward, _, _ = env.step(action)
        assert reward == -0.02

    def test_malformed_action_penalty(self):
        env = ARIAEnv()
        env.reset("easy")
        action = ARIAAction(action_type=ActionType.IDENTIFY_GAP)  # missing required fields
        _, reward, _, _ = env.step(action)
        assert reward == -0.05

    def test_episode_ends_on_final_report(self):
        env = ARIAEnv()
        env.reset("easy")
        action = ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)
        _, _, done, _ = env.step(action)
        assert done

    def test_episode_ends_on_step_budget(self):
        env = ARIAEnv()
        obs = env.reset("easy")
        max_steps = obs.steps_remaining
        doc = obs.documents[0]
        # Exhaust steps
        for i in range(max_steps):
            section = doc.sections[i % len(doc.sections)]
            action = ARIAAction(
                action_type=ActionType.REQUEST_SECTION,
                document_id=doc.doc_id,
                section_id=section.section_id,
            )
            obs, _, done, _ = env.step(action)
            if done:
                break
        assert done

    def test_all_tasks_load(self):
        for task in ["easy", "medium", "hard", "expert"]:
            env = ARIAEnv()
            obs = env.reset(task)
            assert obs.task_id
            assert len(obs.documents) > 0

    def test_correct_gap_positive_reward(self):
        env = ARIAEnv()
        obs = env.reset("easy")
        action = ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s3",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="No maximum retention period specified",
        )
        _, reward, _, _ = env.step(action)
        assert reward > 0, f"Expected positive reward for correct gap, got {reward}"

    def test_false_positive_negative_reward(self):
        env = ARIAEnv()
        env.reset("easy")
        action = ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s2",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="Incorrectly flagging compliant section",
        )
        _, reward, _, _ = env.step(action)
        assert reward < 0


# ─── Grader determinism tests ─────────────────────────────────────────────────

class TestGraderDeterminism:

    def _run_episode(self, task="easy"):
        env = ARIAEnv()
        obs = env.reset(task)
        # Read section
        doc = obs.documents[0]
        env.step(ARIAAction(
            action_type=ActionType.REQUEST_SECTION,
            document_id=doc.doc_id,
            section_id=doc.sections[0].section_id,
        ))
        # Identify a gap
        obs, _, _, _ = env.step(ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s3",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="No retention period",
        ))
        return env.grade()

    def test_grader_produces_score_in_range(self):
        grade = self._run_episode()
        assert 0.0 <= grade.score <= 1.0

    def test_grader_is_deterministic(self):
        grade1 = self._run_episode()
        grade2 = self._run_episode()
        assert grade1.score == grade2.score

    def test_grader_score_increases_with_more_correct_actions(self):
        env = ARIAEnv()
        obs = env.reset("easy")
        # Just submit immediately
        env.step(ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT))
        empty_grade = env.grade()

        # Full effort
        env2 = ARIAEnv()
        obs2 = env2.reset("easy")
        for doc in obs2.documents:
            for section in doc.sections:
                env2.step(ARIAAction(
                    action_type=ActionType.REQUEST_SECTION,
                    document_id=doc.doc_id,
                    section_id=section.section_id,
                ))
        env2.step(ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s3",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="No maximum retention period specified",
        ))
        env2.step(ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT))
        full_grade = env2.grade()

        assert full_grade.score > empty_grade.score


# ─── Reward function tests ────────────────────────────────────────────────────

class TestRewardFunction:

    def test_spam_penalty_applied(self):
        env = ARIAEnv()
        obs = env.reset("easy")
        rewards = []
        for i in range(6):
            _, r, _, _ = env.step(ARIAAction(
                action_type=ActionType.IDENTIFY_GAP,
                clause_ref=f"privacy_policy.s{i+1}",
                gap_type=GapType.DATA_RETENTION,
                severity=Severity.HIGH,
                description="spam",
            ))
            rewards.append(r)
        # After 3rd false positive in window, extra penalty kicks in
        assert any(r <= -0.20 for r in rewards), f"Spam penalty not applied: {rewards}"

    def test_severity_bonus(self):
        env = ARIAEnv()
        env.reset("easy")
        # privacy_policy.s3 data_retention high = correct gap + severity
        _, reward, _, _ = env.step(ARIAAction(
            action_type=ActionType.IDENTIFY_GAP,
            clause_ref="privacy_policy.s3",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="No retention period",
        ))
        # Should get base +0.20 + severity bonus +0.05 = 0.25
        assert reward >= 0.24, f"Expected ≥0.24 for correct gap+severity, got {reward}"


# ─── Evidence validator tests ─────────────────────────────────────────────────

class TestEvidenceValidator:

    def test_valid_citation_scores_high(self):
        from aria.models import Finding, EvidenceCitation, Document, Section
        validator = EvidenceChainValidator()
        finding = Finding(
            clause_ref="privacy_policy.s3",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="No retention period",
        )
        section = Section(
            section_id="s3",
            title="Data Retention",
            content="We retain your account data for as long as your account is active and for a reasonable period thereafter.",
        )
        doc = Document(doc_id="privacy_policy", title="Privacy Policy", sections=[section])
        citation = EvidenceCitation(
            finding_id=finding.finding_id,
            passage_text="We retain your account data for as long as your account is active",
            passage_location="privacy_policy.s3",
        )
        result = validator.validate(finding, citation, [doc])
        assert result.score >= 0.40, f"Expected ≥0.40, got {result.score}"

    def test_wrong_location_scores_zero(self):
        from aria.models import Finding, EvidenceCitation, Document, Section
        validator = EvidenceChainValidator()
        finding = Finding(
            clause_ref="privacy_policy.s3",
            gap_type=GapType.DATA_RETENTION,
            severity=Severity.HIGH,
            description="No retention period",
        )
        doc = Document(doc_id="privacy_policy", title="Privacy Policy", sections=[])
        citation = EvidenceCitation(
            finding_id=finding.finding_id,
            passage_text="Some text",
            passage_location="nonexistent_doc.s99",
        )
        result = validator.validate(finding, citation, [doc])
        assert result.score == 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])