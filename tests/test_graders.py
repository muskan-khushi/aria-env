"""
ARIA — Grader Tests
Tests that grader is deterministic, fair, and scores in 0.0–1.0.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from aria.grader import Grader
from aria.models import Finding, Remediation, EvidenceCitation, GapType, Severity, FindingStatus


def make_finding(clause_ref, gap_type, severity="high", status="PENDING"):
    return Finding(
        clause_ref=clause_ref,
        gap_type=GapType(gap_type),
        severity=Severity(severity),
        description="Test finding",
        status=FindingStatus(status),
    )


GT_GAPS = [
    {"gap_id": "g1", "clause_ref": "privacy_policy.s3", "gap_type": "data_retention", "severity": "high"},
    {"gap_id": "g2", "clause_ref": "privacy_policy.s1", "gap_type": "consent_mechanism", "severity": "high"},
    {"gap_id": "g3", "clause_ref": "privacy_policy.s5", "gap_type": "breach_notification", "severity": "high"},
]


class TestGraderScoring:

    def test_empty_submission_scores_zero(self):
        g = Grader()
        result = g.score([], [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 10, 15, [])
        # Empty = no F1, but conflict score=1.0 (nothing to miss) + tiny efficiency
        assert result.score < 0.10
        assert result.f1_score.f1 == 0.0

    def test_perfect_f1_scores_high(self):
        g = Grader()
        findings = [
            make_finding("privacy_policy.s3", "data_retention"),
            make_finding("privacy_policy.s1", "consent_mechanism"),
            make_finding("privacy_policy.s5", "breach_notification"),
        ]
        result = g.score(findings, [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 5, 15, [])
        # With 3/3 correct gaps and no FPs: F1 = 1.0, so gap component = 0.40
        assert result.f1_score.f1 == pytest.approx(1.0, abs=0.01)
        assert result.score >= 0.40

    def test_false_positives_hurt_precision(self):
        g = Grader()
        findings = [
            make_finding("privacy_policy.s3", "data_retention"),   # correct
            make_finding("privacy_policy.s9", "dpo_requirement"),  # wrong
            make_finding("privacy_policy.s9", "phi_safeguard"),    # wrong
        ]
        result = g.score(findings, [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 10, 15, [])
        # Precision = 1/3 ≈ 0.33, Recall = 1/3 ≈ 0.33
        assert result.f1_score.precision < 0.5
        assert result.score < 0.35  # FPs hurt precision significantly

    def test_score_always_in_range(self):
        g = Grader()
        for _ in range(5):
            findings = [make_finding("pp.s1", "data_retention", "low")]
            result = g.score(findings, [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 5, 15, [])
            assert 0.0 <= result.score <= 1.0

    def test_deterministic_same_input_same_score(self):
        g = Grader()
        findings = [make_finding("privacy_policy.s3", "data_retention")]
        r1 = g.score(findings, [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 5, 15, [])
        r2 = g.score(findings, [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 5, 15, [])
        assert r1.score == r2.score
        assert r1.f1_score.f1 == r2.f1_score.f1

    def test_severity_accuracy_component(self):
        g = Grader()
        # Correct gap but wrong severity (medium instead of high)
        wrong_sev = make_finding("privacy_policy.s3", "data_retention", "medium")
        result_wrong = g.score([wrong_sev], [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 5, 15, [])

        # Correct gap with correct severity
        right_sev = make_finding("privacy_policy.s3", "data_retention", "high")
        result_right = g.score([right_sev], [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 5, 15, [])

        assert result_right.severity_accuracy > result_wrong.severity_accuracy

    def test_conflict_detection_scoring(self):
        g = Grader()
        gt = {"gaps": [], "conflicts": [
            {"conflict_id": "c1", "framework_a": "GDPR", "framework_b": "HIPAA"}
        ]}
        # Correct conflict
        correct = [{"framework_a": "GDPR", "framework_b": "HIPAA", "conflict_desc": "test"}]
        r_correct = g.score([], [], [], correct, gt, 5, 15, [])

        # Wrong conflict
        wrong = [{"framework_a": "GDPR", "framework_b": "CCPA", "conflict_desc": "test"}]
        r_wrong = g.score([], [], [], wrong, gt, 5, 15, [])

        assert r_correct.conflict_score > r_wrong.conflict_score

    def test_efficiency_bonus_for_early_finish(self):
        g = Grader()
        findings = [make_finding("privacy_policy.s3", "data_retention")]
        # Finish at step 5 out of 15
        r_early = g.score(findings, [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 5, 15, [])
        # Finish at step 14 out of 15
        r_late = g.score(findings, [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 14, 15, [])
        assert r_early.efficiency_bonus > r_late.efficiency_bonus

    def test_breakdown_sums_to_score(self):
        g = Grader()
        findings = [make_finding("privacy_policy.s3", "data_retention")]
        result = g.score(findings, [], [], [], {"gaps": GT_GAPS, "conflicts": []}, 5, 15, [])
        total = sum(result.breakdown.values())
        assert abs(total - result.score) < 0.001


class TestGraderF1:

    def test_f1_all_correct(self):
        g = Grader()
        findings = [make_finding(gt["clause_ref"], gt["gap_type"]) for gt in GT_GAPS]
        f1 = g.compute_f1(findings, GT_GAPS)
        assert f1.tp == 3
        assert f1.fp == 0
        assert f1.fn == 0
        assert f1.precision == pytest.approx(1.0, abs=0.01)
        assert f1.recall == pytest.approx(1.0, abs=0.01)

    def test_f1_no_matches(self):
        g = Grader()
        findings = [make_finding("totally_wrong.s99", "availability_control")]
        f1 = g.compute_f1(findings, GT_GAPS)
        assert f1.tp == 0
        assert f1.fp == 1
        assert f1.fn == 3
        assert f1.f1 < 0.1

    def test_f1_partial_recall(self):
        g = Grader()
        # Find 2 out of 3
        findings = [
            make_finding("privacy_policy.s3", "data_retention"),
            make_finding("privacy_policy.s1", "consent_mechanism"),
        ]
        f1 = g.compute_f1(findings, GT_GAPS)
        assert f1.recall == pytest.approx(2/3, abs=0.01)
        assert f1.precision == pytest.approx(1.0, abs=0.01)

    def test_retracted_findings_excluded(self):
        g = Grader()
        findings = [make_finding("privacy_policy.s3", "data_retention", status="RETRACTED")]
        f1 = g.compute_f1(findings, GT_GAPS)
        assert f1.tp == 0  # retracted = doesn't count


if __name__ == "__main__":
    pytest.main([__file__, "-v"])