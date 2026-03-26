"""
ARIA — Reward Engine
Dense reward computation for every action type with anti-gaming mechanisms.
"""
from __future__ import annotations
from collections import deque
from difflib import SequenceMatcher
from aria.models import (
    ARIAAction, ARIAObservation, ARIAReward,
    ActionType, ActionResult, GapType, Finding, FindingStatus,
)
from aria.evidence import EvidenceChainValidator


class RewardEngine:
    """
    Computes immediate per-step reward for every action.
    All reward logic lives here — the environment calls compute() and gets back
    an ARIAReward with scalar + human-readable reason.
    """

    # Reward constants (matching the Bible spec exactly)
    R_GAP_CORRECT = 0.20
    R_GAP_PARTIAL = 0.12          # correct gap_type, approximate clause_ref
    R_GAP_SEVERITY_BONUS = 0.05
    R_EVIDENCE_HIGH = 0.12        # evidence score ≥ 0.80
    R_REMEDIATION_HIGH = 0.15     # keyword coverage ≥ 70%
    R_CONFLICT = 0.18
    R_INCIDENT_CORRECT = 0.20
    R_RETRACT_WRONG_FP = 0.05     # retracting a genuine false positive

    P_FALSE_POSITIVE = -0.10
    P_RED_HERRING = -0.10
    P_WRONG_RETRACTION = -0.08    # retracting a real finding
    P_DUPLICATE = -0.02
    P_REDUNDANT_READ = -0.02
    P_MALFORMED = -0.05
    P_SPAM_EXTRA = -0.10          # 3+ FPs in 5-step window
    P_MISSED_DEADLINE = -0.25
    P_PHASE_VIOLATION = -0.03

    SPAM_WINDOW = 5
    SPAM_THRESHOLD = 3

    def __init__(self):
        self._evidence_validator = EvidenceChainValidator()
        self._recent_fp_steps: deque[int] = deque(maxlen=self.SPAM_WINDOW * 2)

    def compute(
        self,
        action: ARIAAction,
        obs: ARIAObservation,
        ground_truth: dict,
    ) -> ARIAReward:
        """Main entry: dispatch to per-action-type handler."""
        atype = action.action_type

        if atype == ActionType.REQUEST_SECTION:
            return self._handle_request_section(action, obs)
        elif atype == ActionType.IDENTIFY_GAP:
            return self._handle_identify_gap(action, obs, ground_truth)
        elif atype == ActionType.CITE_EVIDENCE:
            return self._handle_cite_evidence(action, obs, ground_truth)
        elif atype == ActionType.SUBMIT_REMEDIATION:
            return self._handle_submit_remediation(action, obs, ground_truth)
        elif atype == ActionType.FLAG_FALSE_POSITIVE:
            return self._handle_flag_fp(action, obs, ground_truth)
        elif atype == ActionType.ESCALATE_CONFLICT:
            return self._handle_escalate_conflict(action, obs, ground_truth)
        elif atype == ActionType.RESPOND_TO_INCIDENT:
            return self._handle_respond_incident(action, obs, ground_truth)
        elif atype == ActionType.SUBMIT_FINAL_REPORT:
            return ARIAReward(
                reward=0.0,
                reason="Final report submitted — episode ending",
                action_result=ActionResult.ACCEPTED,
            )
        elif atype == ActionType.REQUEST_CLARIFICATION:
            return ARIAReward(
                reward=0.0,
                reason="Clarification noted",
                action_result=ActionResult.ACCEPTED,
            )
        else:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason=f"Unknown action type: {atype}",
                action_result=ActionResult.REJECTED,
            )

    # ─── Per-action handlers ──────────────────────────────────────────────────

    def _handle_request_section(
        self, action: ARIAAction, obs: ARIAObservation
    ) -> ARIAReward:
        if not action.document_id or not action.section_id:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason="request_section requires document_id and section_id",
                action_result=ActionResult.REJECTED,
            )
        loc = f"{action.document_id}.{action.section_id}"
        if loc in obs.visible_sections:
            return ARIAReward(
                reward=self.P_REDUNDANT_READ,
                reason=f"Section {loc} already viewed — redundant read",
                action_result=ActionResult.ACCEPTED,
            )
        return ARIAReward(
            reward=0.0,
            reason=f"Reading {loc}",
            action_result=ActionResult.ACCEPTED,
        )

    def _handle_identify_gap(
        self, action: ARIAAction, obs: ARIAObservation, ground_truth: dict
    ) -> ARIAReward:
        # Validate required fields
        if not action.clause_ref or not action.gap_type or not action.severity:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason="identify_gap requires clause_ref, gap_type, and severity",
                action_result=ActionResult.REJECTED,
            )

        # Duplicate check
        for f in obs.active_findings:
            if (f.clause_ref.lower() == action.clause_ref.lower()
                    and f.gap_type == action.gap_type):
                return ARIAReward(
                    reward=self.P_DUPLICATE,
                    reason=f"Duplicate finding: {action.clause_ref} / {action.gap_type.value}",
                    action_result=ActionResult.DUPLICATE,
                )

        # Match against ground truth
        gt_gaps = ground_truth.get("gaps", [])
        gt_red_herrings = ground_truth.get("red_herrings", [])

        match, partial = self._match_gap(action, gt_gaps)

        if match:
            reward = self.R_GAP_CORRECT
            reason = f"Correct {action.gap_type.value} gap in {action.clause_ref}"
            # Severity bonus
            if action.severity and action.severity.value == match.get("severity"):
                reward += self.R_GAP_SEVERITY_BONUS
                reason += " (+severity bonus)"
            return ARIAReward(
                reward=reward,
                reason=reason,
                action_result=ActionResult.ACCEPTED,
            )
        elif partial:
            reward = self.R_GAP_PARTIAL
            reason = f"Partial match — correct gap type but approximate clause reference ({action.clause_ref})"
            return ARIAReward(
                reward=reward,
                reason=reason,
                action_result=ActionResult.ACCEPTED,
            )

        # Check for red herring
        for rh in gt_red_herrings:
            if self._clause_fuzzy_match(action.clause_ref, rh.get("clause_ref", "")):
                self._record_fp(obs.steps_taken)
                spam_penalty = self._spam_penalty(obs.steps_taken)
                return ARIAReward(
                    reward=self.P_RED_HERRING + spam_penalty,
                    reason=f"Red herring — {rh.get('reason_not_a_gap', 'clause is compliant')}",
                    action_result=ActionResult.ACCEPTED,
                )

        # Generic false positive
        self._record_fp(obs.steps_taken)
        spam_penalty = self._spam_penalty(obs.steps_taken)
        return ARIAReward(
            reward=self.P_FALSE_POSITIVE + spam_penalty,
            reason=f"False positive: {action.clause_ref} is not a violation",
            action_result=ActionResult.ACCEPTED,
        )

    def _handle_cite_evidence(
        self, action: ARIAAction, obs: ARIAObservation, ground_truth: dict
    ) -> ARIAReward:
        if not action.finding_id or not action.passage_text or not action.passage_location:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason="cite_evidence requires finding_id, passage_text, and passage_location",
                action_result=ActionResult.REJECTED,
            )

        # Check matching finding exists
        finding = next(
            (f for f in obs.active_findings if f.finding_id == action.finding_id), None
        )
        if not finding:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason=f"No active finding with id {action.finding_id}",
                action_result=ActionResult.REJECTED,
            )

        from aria.models import EvidenceCitation
        citation = EvidenceCitation(
            finding_id=action.finding_id,
            passage_text=action.passage_text,
            passage_location=action.passage_location,
        )
        evidence_result = self._evidence_validator.validate(
            finding, citation, obs.documents
        )

        score = evidence_result.score
        if score >= 0.80:
            reward = self.R_EVIDENCE_HIGH
        elif score >= 0.50:
            reward = self.R_EVIDENCE_HIGH * ((score - 0.50) / 0.30)  # scale 0.04–0.12
            reward = max(0.04, reward)
        else:
            reward = 0.01

        return ARIAReward(
            reward=reward,
            reason=f"Evidence citation score {score:.2f}: {evidence_result.reason}",
            action_result=ActionResult.ACCEPTED,
        )

    def _handle_submit_remediation(
        self, action: ARIAAction, obs: ARIAObservation, ground_truth: dict
    ) -> ARIAReward:
        if not action.finding_id or not action.remediation_text:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason="submit_remediation requires finding_id and remediation_text",
                action_result=ActionResult.REJECTED,
            )

        finding = next(
            (f for f in obs.active_findings if f.finding_id == action.finding_id), None
        )
        if not finding:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason=f"No active finding with id {action.finding_id}",
                action_result=ActionResult.REJECTED,
            )

        # Find canonical keywords for this gap
        gt_gaps = ground_truth.get("gaps", [])
        canonical_keywords = []
        for g in gt_gaps:
            if self._clause_fuzzy_match(finding.clause_ref, g.get("clause_ref", "")):
                canonical_keywords = g.get("canonical_remediation_keywords", [])
                break

        coverage = self._keyword_coverage(action.remediation_text, canonical_keywords)

        if coverage >= 0.70:
            reward = self.R_REMEDIATION_HIGH
        elif coverage >= 0.40:
            reward = self.R_REMEDIATION_HIGH * ((coverage - 0.40) / 0.30)
            reward = max(0.04, reward)
        else:
            reward = 0.01

        return ARIAReward(
            reward=reward,
            reason=f"Remediation keyword coverage {coverage:.0%} (reward: {reward:.2f})",
            action_result=ActionResult.ACCEPTED,
        )

    def _handle_flag_fp(
        self, action: ARIAAction, obs: ARIAObservation, ground_truth: dict
    ) -> ARIAReward:
        if not action.retract_finding_id:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason="flag_false_positive requires retract_finding_id",
                action_result=ActionResult.REJECTED,
            )

        finding = next(
            (f for f in obs.active_findings if f.finding_id == action.retract_finding_id), None
        )
        if not finding:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason=f"Finding {action.retract_finding_id} not found",
                action_result=ActionResult.REJECTED,
            )

        # Is this a real finding or a false positive?
        gt_gaps = ground_truth.get("gaps", [])
        is_real = any(
            self._clause_fuzzy_match(finding.clause_ref, g.get("clause_ref", ""))
            and finding.gap_type.value == g.get("gap_type")
            for g in gt_gaps
        )

        if is_real:
            return ARIAReward(
                reward=self.P_WRONG_RETRACTION,
                reason=f"Wrong retraction — finding {action.retract_finding_id} is a real violation",
                action_result=ActionResult.ACCEPTED,
            )
        else:
            return ARIAReward(
                reward=self.R_RETRACT_WRONG_FP,
                reason=f"Self-correction — {action.retract_finding_id} was a false positive",
                action_result=ActionResult.ACCEPTED,
            )

    def _handle_escalate_conflict(
        self, action: ARIAAction, obs: ARIAObservation, ground_truth: dict
    ) -> ARIAReward:
        if not action.framework_a or not action.framework_b or not action.conflict_desc:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason="escalate_conflict requires framework_a, framework_b, conflict_desc",
                action_result=ActionResult.REJECTED,
            )

        gt_conflicts = ground_truth.get("conflicts", [])
        fa = action.framework_a.value
        fb = action.framework_b.value

        for conflict in gt_conflicts:
            if {conflict.get("framework_a"), conflict.get("framework_b")} == {fa, fb}:
                return ARIAReward(
                    reward=self.R_CONFLICT,
                    reason=f"Correct conflict identified: {fa} vs {fb}",
                    action_result=ActionResult.ACCEPTED,
                )

        return ARIAReward(
            reward=self.P_FALSE_POSITIVE,
            reason=f"No known conflict between {fa} and {fb} for this task",
            action_result=ActionResult.ACCEPTED,
        )

    def _handle_respond_incident(
        self, action: ARIAAction, obs: ARIAObservation, ground_truth: dict
    ) -> ARIAReward:
        if not obs.active_incident:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason="No active incident — respond_to_incident not valid",
                action_result=ActionResult.REJECTED,
            )
        if not action.response_type:
            return ARIAReward(
                reward=self.P_MALFORMED,
                reason="respond_to_incident requires response_type",
                action_result=ActionResult.REJECTED,
            )

        incident = obs.active_incident
        required = incident.required_responses
        completed = incident.completed_responses

        if action.response_type not in required:
            return ARIAReward(
                reward=self.P_FALSE_POSITIVE,
                reason=f"Incorrect incident response: {action.response_type.value} not required",
                action_result=ActionResult.ACCEPTED,
            )

        if action.response_type in completed:
            return ARIAReward(
                reward=self.P_DUPLICATE,
                reason=f"Response already completed: {action.response_type.value}",
                action_result=ActionResult.DUPLICATE,
            )

        # Check deadline
        deadline_remaining = incident.deadline_steps - (obs.steps_taken - incident.discovered_at_step)
        if deadline_remaining < 0:
            return ARIAReward(
                reward=self.P_MISSED_DEADLINE,
                reason=f"Incident deadline exceeded by {abs(deadline_remaining)} steps",
                action_result=ActionResult.ACCEPTED,
            )

        return ARIAReward(
            reward=self.R_INCIDENT_CORRECT,
            reason=f"Correct incident response: {action.response_type.value} ({deadline_remaining} steps remaining)",
            action_result=ActionResult.ACCEPTED,
        )

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _match_gap(
        self, action: ARIAAction, gt_gaps: list[dict]
    ) -> tuple[dict | None, dict | None]:
        """Return (exact_match, partial_match) from ground truth gaps."""
        exact = None
        partial = None
        for gap in gt_gaps:
            clause_match = self._clause_fuzzy_match(
                action.clause_ref or "", gap.get("clause_ref", "")
            )
            type_match = (action.gap_type and
                          action.gap_type.value == gap.get("gap_type"))
            if clause_match and type_match:
                exact = gap
                break
            elif type_match and not clause_match:
                # Right type, wrong but close clause — check approximate
                ratio = SequenceMatcher(
                    None,
                    (action.clause_ref or "").lower(),
                    gap.get("clause_ref", "").lower(),
                ).ratio()
                if ratio >= 0.60:
                    partial = gap
        return exact, partial

    def _clause_fuzzy_match(self, a: str, b: str) -> bool:
        """True if clause references match after normalisation."""
        def norm(s: str) -> str:
            return s.lower().replace(".", "").replace("_", "").replace("-", "").replace(" ", "")
        na, nb = norm(a), norm(b)
        if na == nb:
            return True
        ratio = SequenceMatcher(None, na, nb).ratio()
        return ratio >= 0.85

    def _keyword_coverage(self, text: str, keywords: list[str]) -> float:
        """Fraction of canonical keywords present in remediation text."""
        if not keywords:
            return 0.5
        text_lower = text.lower()
        hits = sum(1 for kw in keywords if kw.lower() in text_lower)
        return hits / len(keywords)

    def _record_fp(self, step: int) -> None:
        self._recent_fp_steps.append(step)

    def _spam_penalty(self, current_step: int) -> float:
        """Extra penalty if ≥3 FPs in the last 5-step window."""
        recent = [s for s in self._recent_fp_steps
                  if current_step - s <= self.SPAM_WINDOW]
        if len(recent) >= self.SPAM_THRESHOLD:
            return self.P_SPAM_EXTRA
        return 0.0

    def check_phase_violation(
        self, action: ARIAAction, phase: str
    ) -> float:
        """Return phase penalty if action is wrong for current phase."""
        if phase == "reading" and action.action_type == ActionType.SUBMIT_REMEDIATION:
            return self.P_PHASE_VIOLATION
        if phase == "remediating" and action.action_type == ActionType.IDENTIFY_GAP:
            return self.P_PHASE_VIOLATION * 0.5  # softer warning
        return 0.0