"""
ARIA — Reward Engine  (v2 — anti-gaming)
Dense reward computation for every action type with hardened anti-gaming mechanisms.

v2 changes:
- Spam window exploit FIXED: global FP budget replaces interval-spreading vulnerability.
  After 5 total false positives in an episode, every subsequent FP costs −0.20 (not just
  FPs in a 5-step window). Agents can no longer spread FPs every 6 steps to avoid the window.
- Conflict description quality: escalate_conflict reward is now scaled by description quality
  (0.6 pair + 0.4 desc quality), matching the grader. Maximum step reward remains 0.18.
- Phase penalty increased: −0.08 (was −0.03) for submitting remediation during reading phase.
  Phase ignorance should genuinely hurt, not be free money.
- Reading section reward: first read of each section gives +0.01 (tiny positive signal).
  This encourages agents to actually read before flagging, without making reading trivially
  rewarding.
"""
from __future__ import annotations
from difflib import SequenceMatcher
from aria.models import (
    ARIAAction, ARIAObservation, ARIAReward,
    ActionType, ActionResult, GapType, Finding, FindingStatus,
)
from aria.evidence import EvidenceChainValidator


class RewardEngine:
    """
    Computes immediate per-step reward for every action.
    """

    # Reward constants
    R_GAP_CORRECT = 0.20
    R_GAP_PARTIAL = 0.12
    R_GAP_SEVERITY_BONUS = 0.05
    R_EVIDENCE_HIGH = 0.12
    R_REMEDIATION_HIGH = 0.15
    R_CONFLICT_MAX = 0.18
    R_INCIDENT_CORRECT = 0.20
    R_RETRACT_WRONG_FP = 0.05
    R_READ_SECTION = 0.01   # NEW: tiny positive for reading (encourages reading before flagging)

    P_FALSE_POSITIVE = -0.10
    P_RED_HERRING = -0.10
    P_WRONG_RETRACTION = -0.08
    P_DUPLICATE = -0.02
    P_REDUNDANT_READ = -0.02
    P_MALFORMED = -0.05
    P_SPAM_EXTRA = -0.20     # INCREASED: now fires after global FP budget exceeded
    P_MISSED_DEADLINE = -0.25
    P_PHASE_VIOLATION = -0.08   # INCREASED from -0.03

    # Global FP budget: after this many total FPs, every FP costs P_SPAM_EXTRA extra
    GLOBAL_FP_BUDGET = 5

    def __init__(self):
        self._evidence_validator = EvidenceChainValidator()
        self._total_fp_count: int = 0  # Global FP counter — cannot be gamed by timing

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
        # NEW: tiny positive for first read — encourages reading before auditing
        return ARIAReward(
            reward=self.R_READ_SECTION,
            reason=f"Reading {loc} (+{self.R_READ_SECTION:.2f} read bonus)",
            action_result=ActionResult.ACCEPTED,
        )

    def _handle_identify_gap(
        self, action: ARIAAction, obs: ARIAObservation, ground_truth: dict
    ) -> ARIAReward:
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

        gt_gaps = ground_truth.get("gaps", [])
        gt_red_herrings = ground_truth.get("red_herrings", [])

        match, partial = self._match_gap(action, gt_gaps)

        if match:
            reward = self.R_GAP_CORRECT
            reason = f"Correct {action.gap_type.value} gap in {action.clause_ref}"
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

        # False positive — check red herrings first
        self._total_fp_count += 1
        spam_penalty = self._global_spam_penalty()

        for rh in gt_red_herrings:
            if self._clause_fuzzy_match(action.clause_ref, rh.get("clause_ref", "")):
                return ARIAReward(
                    reward=self.P_RED_HERRING + spam_penalty,
                    reason=f"Red herring — {rh.get('reason_not_a_gap', 'clause is compliant')}"
                           + (f" [spam budget exceeded: {spam_penalty:+.2f}]" if spam_penalty < 0 else ""),
                    action_result=ActionResult.ACCEPTED,
                )

        return ARIAReward(
            reward=self.P_FALSE_POSITIVE + spam_penalty,
            reason=f"False positive: {action.clause_ref} is not a violation"
                   + (f" [spam budget exceeded: {spam_penalty:+.2f}]" if spam_penalty < 0 else ""),
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
            reward = self.R_EVIDENCE_HIGH * ((score - 0.50) / 0.30)
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
            # Correct retraction — also reduce FP counter (self-correction credit)
            self._total_fp_count = max(0, self._total_fp_count - 1)
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

        pair_matched = any(
            {c.get("framework_a"), c.get("framework_b")} == {fa, fb}
            for c in gt_conflicts
        )

        if not pair_matched:
            return ARIAReward(
                reward=self.P_FALSE_POSITIVE,
                reason=f"No known conflict between {fa} and {fb} for this task",
                action_result=ActionResult.ACCEPTED,
            )

        # Score description quality (v2: not just pair membership)
        desc_quality = self._evidence_validator.score_conflict_description(
            fa, fb, action.conflict_desc or ""
        )
        # Pair match: 0.6 weight, description quality: 0.4 weight
        reward = self.R_CONFLICT_MAX * (0.6 + desc_quality * 0.4)

        quality_label = "excellent" if desc_quality >= 0.75 else ("good" if desc_quality >= 0.40 else "weak")
        return ARIAReward(
            reward=round(reward, 4),
            reason=f"Correct conflict {fa} vs {fb} — description quality: {quality_label} ({desc_quality:.0%})",
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

    def _global_spam_penalty(self) -> float:
        """
        Return extra penalty if global FP budget exceeded.
        Unlike the old window-based approach, this cannot be gamed by
        spreading FPs every 6 steps — it tracks total FPs for the episode.
        """
        if self._total_fp_count > self.GLOBAL_FP_BUDGET:
            return self.P_SPAM_EXTRA
        return 0.0

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
                ratio = SequenceMatcher(
                    None,
                    (action.clause_ref or "").lower(),
                    gap.get("clause_ref", "").lower(),
                ).ratio()
                if ratio >= 0.60:
                    partial = gap
        return exact, partial

    def _clause_fuzzy_match(self, a: str, b: str) -> bool:
        def norm(s: str) -> str:
            return s.lower().replace(".", "").replace("_", "").replace("-", "").replace(" ", "")
        na, nb = norm(a), norm(b)
        if na == nb:
            return True
        ratio = SequenceMatcher(None, na, nb).ratio()
        return ratio >= 0.85

    def _keyword_coverage(self, text: str, keywords: list[str]) -> float:
        if not keywords:
            return 0.5
        text_lower = text.lower()
        hits = sum(1 for kw in keywords if kw.lower() in text_lower)
        return hits / len(keywords)

    def check_phase_violation(
        self, action: ARIAAction, phase: str
    ) -> float:
        """Return phase penalty if action is wrong for current phase."""
        if phase == "reading" and action.action_type == ActionType.SUBMIT_REMEDIATION:
            return self.P_PHASE_VIOLATION
        if phase == "remediating" and action.action_type == ActionType.IDENTIFY_GAP:
            return self.P_PHASE_VIOLATION * 0.5
        return 0.0