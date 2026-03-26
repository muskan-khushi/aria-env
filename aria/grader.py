"""
ARIA — Terminal Grader
Deterministic 0.0–1.0 scoring at episode end.
Components: Gap F1 (40%), Evidence (25%), Remediation (20%), Severity (10%), Conflict (5%).
"""
from __future__ import annotations
from difflib import SequenceMatcher
from aria.models import (
    Finding, Remediation, EvidenceCitation,
    GradeResult, F1Score, GapType, Severity
)
from aria.evidence import EvidenceChainValidator


class Grader:
    """
    Scores a completed episode deterministically.
    Same inputs always produce the same output.
    """

    # Component weights
    W_F1 = 0.40
    W_EVIDENCE = 0.25
    W_REMEDIATION = 0.20
    W_SEVERITY = 0.10
    W_CONFLICT = 0.05

    def __init__(self):
        self._validator = EvidenceChainValidator()

    def score(
        self,
        submitted_findings: list[Finding],
        submitted_remediations: list[Remediation],
        submitted_citations: list[EvidenceCitation],
        escalated_conflicts: list[dict],
        ground_truth: dict,
        steps_taken: int,
        max_steps: int,
        documents: list,
    ) -> GradeResult:
        gt_gaps = ground_truth.get("gaps", [])
        gt_conflicts = ground_truth.get("conflicts", [])

        # Component 1: Gap detection F1
        f1_result = self.compute_f1(submitted_findings, gt_gaps)
        f1_component = f1_result.f1 * self.W_F1

        # Component 2: Evidence quality
        evidence_component = self._score_evidence(
            submitted_findings, submitted_citations, documents
        ) * self.W_EVIDENCE

        # Component 3: Remediation quality
        remediation_component = self._score_remediations(
            submitted_findings, submitted_remediations, gt_gaps
        ) * self.W_REMEDIATION

        # Component 4: Severity accuracy
        severity_component = self._score_severity(
            submitted_findings, gt_gaps
        ) * self.W_SEVERITY

        # Component 5: Conflict detection
        conflict_component = self._score_conflicts(
            escalated_conflicts, gt_conflicts
        ) * self.W_CONFLICT

        # Efficiency bonus (small)
        steps_remaining = max(0, max_steps - steps_taken)
        efficiency_bonus = max(0.0, (steps_remaining / max_steps) * 0.05) if max_steps > 0 else 0.0

        raw_score = (
            f1_component
            + evidence_component
            + remediation_component
            + severity_component
            + conflict_component
            + efficiency_bonus
        )
        final_score = min(1.0, max(0.0, raw_score))

        return GradeResult(
            score=round(final_score, 4),
            f1_score=f1_result,
            evidence_score=round(evidence_component / self.W_EVIDENCE, 4),
            severity_accuracy=round(severity_component / self.W_SEVERITY, 4),
            remediation_score=round(remediation_component / self.W_REMEDIATION, 4),
            conflict_score=round(conflict_component / self.W_CONFLICT, 4),
            efficiency_bonus=round(efficiency_bonus, 4),
            breakdown={
                "gap_f1": round(f1_component, 4),
                "evidence": round(evidence_component, 4),
                "remediation": round(remediation_component, 4),
                "severity": round(severity_component, 4),
                "conflict": round(conflict_component, 4),
                "efficiency": round(efficiency_bonus, 4),
            },
        )

    def compute_f1(
        self, submitted: list[Finding], gt_gaps: list[dict]
    ) -> F1Score:
        """F1 scoring for gap detection. One finding can match at most one GT gap."""
        true_positives = 0
        false_positives = 0
        matched_gt: set[str] = set()

        for finding in submitted:
            if finding.status.value == "RETRACTED":
                continue
            match = self._find_matching_gap(finding, gt_gaps, matched_gt)
            if match:
                true_positives += 1
                matched_gt.add(match["gap_id"])
            else:
                false_positives += 1

        false_negatives = len(gt_gaps) - len(matched_gt)

        precision = true_positives / (true_positives + false_positives + 1e-9)
        recall = true_positives / (true_positives + false_negatives + 1e-9)
        f1 = 2 * precision * recall / (precision + recall + 1e-9)

        return F1Score(
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1=round(f1, 4),
            tp=true_positives,
            fp=false_positives,
            fn=false_negatives,
        )

    # ─── Component scorers ────────────────────────────────────────────────────

    def _score_evidence(
        self,
        findings: list[Finding],
        citations: list[EvidenceCitation],
        documents: list,
    ) -> float:
        """Average evidence score across all non-retracted findings."""
        active = [f for f in findings if f.status.value != "RETRACTED"]
        if not active:
            return 0.0

        scores = []
        for finding in active:
            finding_citations = [c for c in citations if c.finding_id == finding.finding_id]
            if not finding_citations:
                scores.append(0.0)  # no citation = 0
            else:
                best = max(
                    self._validator.validate(finding, c, documents).score
                    for c in finding_citations
                )
                scores.append(best)

        return sum(scores) / len(scores)

    def _score_remediations(
        self,
        findings: list[Finding],
        remediations: list[Remediation],
        gt_gaps: list[dict],
    ) -> float:
        """Average remediation quality for findings that have been remediated."""
        active = [f for f in findings if f.status.value != "RETRACTED"]
        if not active:
            return 0.0

        scores = []
        for finding in active:
            finding_remediations = [r for r in remediations if r.finding_id == finding.finding_id]
            if not finding_remediations:
                scores.append(0.0)
                continue

            # Get canonical keywords for this finding
            canonical = []
            for g in gt_gaps:
                if self._clause_match(finding.clause_ref, g.get("clause_ref", "")):
                    canonical = g.get("canonical_remediation_keywords", [])
                    break

            best_coverage = max(
                self._keyword_coverage(r.text, canonical)
                for r in finding_remediations
            )
            scores.append(best_coverage)

        return sum(scores) / len(scores) if scores else 0.0

    def _score_severity(
        self, findings: list[Finding], gt_gaps: list[dict]
    ) -> float:
        """Fraction of correctly classified severities for matched findings."""
        active = [f for f in findings if f.status.value != "RETRACTED"]
        if not active:
            return 0.0

        correct = 0
        total = 0
        for finding in active:
            for gap in gt_gaps:
                if (self._clause_match(finding.clause_ref, gap.get("clause_ref", ""))
                        and finding.gap_type.value == gap.get("gap_type")):
                    total += 1
                    if finding.severity.value == gap.get("severity"):
                        correct += 1
                    break

        return correct / max(1, total)

    def _score_conflicts(
        self, escalated: list[dict], gt_conflicts: list[dict]
    ) -> float:
        """Precision/recall for conflict detection."""
        if not gt_conflicts:
            return 1.0 if not escalated else 0.5

        matched = 0
        for e in escalated:
            fa = e.get("framework_a", "")
            fb = e.get("framework_b", "")
            if any(
                {c.get("framework_a"), c.get("framework_b")} == {fa, fb}
                for c in gt_conflicts
            ):
                matched += 1

        recall = matched / len(gt_conflicts)
        precision = matched / max(1, len(escalated))
        if precision + recall == 0:
            return 0.0
        return 2 * precision * recall / (precision + recall)

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _find_matching_gap(
        self,
        finding: Finding,
        gt_gaps: list[dict],
        already_matched: set[str],
    ) -> dict | None:
        for gap in gt_gaps:
            if gap["gap_id"] in already_matched:
                continue
            if (self._clause_match(finding.clause_ref, gap.get("clause_ref", ""))
                    and finding.gap_type.value == gap.get("gap_type")):
                return gap
        return None

    def _clause_match(self, a: str, b: str) -> bool:
        def norm(s: str) -> str:
            return s.lower().replace(".", "").replace("_", "").replace("-", "").replace(" ", "")
        na, nb = norm(a), norm(b)
        if na == nb:
            return True
        return SequenceMatcher(None, na, nb).ratio() >= 0.85

    def _keyword_coverage(self, text: str, keywords: list[str]) -> float:
        if not keywords:
            return 0.5
        text_lower = text.lower()
        return sum(1 for kw in keywords if kw.lower() in text_lower) / len(keywords)