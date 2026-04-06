"""
ARIA — Baseline Agent Classes
==============================
baseline/agent.py

Two agents:
  SinglePassAgent  — LLM with structured JSON, full conversation history
  MultiPassAgent   — Curriculum heuristic: read → identify+cite → remediate → escalate → finalise

Design notes (Bible §7.1–7.3):
  - temperature=0.0, seed=42 for full reproducibility
  - MultiPass consistently scores 5–10 points higher than SinglePass
  - Grader components (Bible §6.1): Gap F1 (40%), Evidence (25%), Remediation (20%),
    Severity (10%), Conflict (5%) — every method here targets one of these
"""
from __future__ import annotations

import json
import os
from typing import Optional

from aria.models import (
    ARIAObservation, ARIAAction, ActionType,
    GapType, Severity, Framework,
)

# ── Config ─────────────────────────────────────────────────────────────────────
MODEL_NAME = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-72B-Instruct")
_MAX_TOKENS = 512
_TEMPERATURE = 0.0   # deterministic (Bible §7.1)


# ══════════════════════════════════════════════════════════════════════════════
# SinglePassAgent
# ══════════════════════════════════════════════════════════════════════════════

class SinglePassAgent:
    """
    LLM baseline agent with rolling 6-message conversation window.

    How it works:
      - Sends full observation (documents, findings, step count, …) to the LLM
      - Uses structured JSON response mode
      - Returns exactly ONE ARIAAction per call

    Strengths:  Reads actual document content and reasons about it.
    Weaknesses: Can flag red herrings; may miss cross-framework conflicts.
    Expected scores (Bible §7.4): easy=0.87, medium=0.63, hard=0.44, expert=0.28
    """

    def __init__(self, client) -> None:
        self.client  = client
        self.history = []   # rolling LLM conversation context

    def act(self, obs: ARIAObservation) -> ARIAAction:
        from baseline.prompts import SYSTEM_PROMPT, build_user_prompt

        user_msg = build_user_prompt(obs)
        self.history.append({"role": "user", "content": user_msg})

        try:
            response = self.client.chat.completions.create(
                model=MODEL_NAME,
                temperature=_TEMPERATURE,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    *self.history[-6:],   # last 3 full turns of context
                ],
                max_tokens=_MAX_TOKENS,
            )
            raw  = response.choices[0].message.content
            self.history.append({"role": "assistant", "content": raw})
            data = json.loads(raw)
            return ARIAAction(**data)

        except Exception as exc:
            print(f"    [SinglePass] LLM error: {exc} — using fallback", flush=True)
            return _fallback_action(obs)


# ══════════════════════════════════════════════════════════════════════════════
# MultiPassAgent  (primary baseline — Bible §7.3)
# ══════════════════════════════════════════════════════════════════════════════

class MultiPassAgent:
    """
    Curriculum heuristic agent.  Mirrors what a thorough human auditor does.

    Phase boundaries (% of total episode steps):
      0 – 35%   READ:        request_section for every unread section first
      35 – 70%  AUDIT:       identify_gap → immediately cite_evidence per finding
      70 – 90%  REMEDIATE:   submit_remediation for every confirmed finding
      90 – 100% FINALISE:    escalate_conflict (if any) → submit_final_report

    Expert override: Active incident → respond_to_incident immediately regardless of phase.

    Scoring targets (Bible §7.4):
      easy=0.94, medium=0.71, hard=0.52, expert=0.33
    """

    def __init__(self, client=None) -> None:
        """client: optional openai.OpenAI() — used for LLM gap identification in Phase 2."""
        self.client = client
        # Track which conflicts we've already escalated (anti-dup guard)
        self._escalated_conflicts: set[str] = set()

    def act(self, obs: ARIAObservation) -> ARIAAction:
        step  = obs.steps_taken
        total = step + obs.steps_remaining

        # ── Expert override: incidents take absolute priority (Bible §5.2) ──
        if obs.active_incident:
            action = self._handle_incident(obs)
            if action:
                return action

        # ── Finalise when almost out of steps ─────────────────────────────
        if obs.steps_remaining < 4:
            return self._finalization_phase(obs)

        # ── Phase routing ──────────────────────────────────────────────────
        if step < total * 0.35:
            return self._reading_phase(obs)
        elif step < total * 0.70:
            return self._auditing_phase(obs)
        elif step < total * 0.90:
            return self._remediation_phase(obs)
        else:
            return self._finalization_phase(obs)

    # ── Phase 1: Read everything (deterministic, no LLM) ─────────────────────

    def _reading_phase(self, obs: ARIAObservation) -> ARIAAction:
        """
        Requests every unread section in document order.
        Avoids -0.02 'already viewed' penalty by checking visible_sections first.
        """
        for doc in obs.documents:
            for section in doc.sections:
                loc = f"{doc.doc_id}.{section.section_id}"
                if loc not in obs.visible_sections:
                    return ARIAAction(
                        action_type=ActionType.REQUEST_SECTION,
                        document_id=doc.doc_id,
                        section_id=section.section_id,
                    )
        # All sections read — skip ahead to auditing
        return self._auditing_phase(obs)

    # ── Phase 2: Identify gaps + cite evidence immediately ────────────────────

    def _auditing_phase(self, obs: ARIAObservation) -> ARIAAction:
        """
        Priority order (maximises grader component scores):
          1. Cite any uncited finding immediately (+0.12 per evidence citation)
          2. Use LLM to identify the next gap (+0.20 per true positive)
          3. Fallback: request next unread section (neutral, never penalised)
        """
        # 1. Always cite before hunting for new gaps (evidence quality = 25% of grade)
        uncited_action = self._cite_next_uncited(obs)
        if uncited_action:
            return uncited_action

        # 2. LLM-driven gap identification
        if self.client:
            return self._llm_identify_gap(obs)

        return _fallback_action(obs)

    def _cite_next_uncited(self, obs: ARIAObservation) -> Optional[ARIAAction]:
        """
        Returns a cite_evidence action for the first finding without a citation.
        Fuzzy-matches the clause_ref to the nearest visible section.
        """
        cited_ids = {c.finding_id for c in obs.evidence_citations}
        uncited   = [f for f in obs.active_findings if f.finding_id not in cited_ids]

        for finding in uncited:
            passage = _find_passage(finding.clause_ref, obs)
            if passage:
                return ARIAAction(
                    action_type=ActionType.CITE_EVIDENCE,
                    finding_id=finding.finding_id,
                    passage_text=passage["text"],
                    passage_location=passage["loc"],
                )
        return None

    def _llm_identify_gap(self, obs: ARIAObservation) -> ARIAAction:
        """
        Asks the LLM to identify the next compliance gap not yet flagged.
        Constructs a focused prompt with only the visible section content
        to keep token usage under control (< 20 min runtime guarantee).
        """
        from baseline.prompts import SYSTEM_PROMPT, build_gap_identification_prompt

        try:
            prompt = build_gap_identification_prompt(obs)
            response = self.client.chat.completions.create(
                model=MODEL_NAME,
                temperature=_TEMPERATURE,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                max_tokens=_MAX_TOKENS,
            )
            raw  = response.choices[0].message.content
            data = json.loads(raw)
            return ARIAAction(**data)

        except Exception as exc:
            print(f"    [MultiPass] LLM error: {exc}", flush=True)
            return _fallback_action(obs)

    # ── Phase 3: Submit remediations ─────────────────────────────────────────

    def _remediation_phase(self, obs: ARIAObservation) -> ARIAAction:
        """
        Submits specific, keyword-rich remediations for all unremediated findings.
        Remediation score = 20% of final grade. Keyword density matters — Bible §6.4.
        Generic text ("improve your policies") scores 0.00.
        """
        unremediated = [
            f for f in obs.active_findings
            if getattr(f.status, "value", str(f.status)) not in ("REMEDIATED", "RETRACTED")
        ]

        if unremediated:
            f = unremediated[0]
            return ARIAAction(
                action_type=ActionType.SUBMIT_REMEDIATION,
                finding_id=f.finding_id,
                remediation_text=_get_remediation_text(f.gap_type),
                target_framework=f.framework,
            )

        # Nothing to remediate — move to finalisation
        return self._finalization_phase(obs)

    # ── Phase 4: Escalate conflicts + submit final report ─────────────────────

    def _finalization_phase(self, obs: ARIAObservation) -> ARIAAction:
        """
        Escalates any cross-framework conflicts before closing (conflict = 5% of grade).
        GDPR 72-hr vs HIPAA 60-day breach notification is the canonical conflict.
        """
        # Check for escalatable conflicts not yet escalated
        conflicts = getattr(obs.regulatory_context, "conflicts", []) or []
        for conflict in conflicts:
            cid = getattr(conflict, "conflict_id", str(conflict))
            if cid not in self._escalated_conflicts:
                fw_a = getattr(conflict, "framework_a", None)
                fw_b = getattr(conflict, "framework_b", None)
                desc = getattr(conflict, "description", "Cross-framework regulatory conflict")
                self._escalated_conflicts.add(cid)
                return ARIAAction(
                    action_type=ActionType.ESCALATE_CONFLICT,
                    framework_a=fw_a,
                    framework_b=fw_b,
                    conflict_desc=desc,
                )

        return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)

    # ── Expert mode: incident response (Bible §5.2) ───────────────────────────

    def _handle_incident(self, obs: ARIAObservation) -> Optional[ARIAAction]:
        """
        Responds to the active incident in the required action order.
        Missing a response within the deadline costs -0.25 (the largest single penalty).
        """
        inc = obs.active_incident
        if inc is None:
            return None

        # required_responses is an ordered list — must execute in sequence
        completed = set(getattr(inc, "completed_responses", []) or [])
        required  = list(getattr(inc, "required_responses", []) or [])

        for resp in required:
            resp_key = getattr(resp, "value", str(resp))
            if resp_key not in {getattr(c, "value", str(c)) for c in completed}:
                return ARIAAction(
                    action_type=ActionType.RESPOND_TO_INCIDENT,
                    incident_id=inc.incident_id,
                    response_type=resp,
                    response_detail=_get_incident_response_detail(resp_key, inc),
                )
        return None


# ══════════════════════════════════════════════════════════════════════════════
# Shared helpers
# ══════════════════════════════════════════════════════════════════════════════

def _fallback_action(obs: ARIAObservation) -> ARIAAction:
    """
    Safe fallback: read next unread section, or submit final report.
    Never penalised — request_section on an unread section is always neutral (0.00).
    """
    for doc in obs.documents:
        for section in doc.sections:
            if f"{doc.doc_id}.{section.section_id}" not in obs.visible_sections:
                return ARIAAction(
                    action_type=ActionType.REQUEST_SECTION,
                    document_id=doc.doc_id,
                    section_id=section.section_id,
                )
    return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)


def _find_passage(clause_ref: str, obs: ARIAObservation) -> Optional[dict]:
    """
    Finds the visible section content for a clause_ref like 'privacy_policy.s3.p2'.
    Returns {"text": str, "loc": str} or None if not yet visible.

    Fuzzy matching: tries full ref first, then doc_id+first_section_part.
    This prevents zero-score evidence citations from bad location strings.
    """
    if not clause_ref:
        return None

    parts  = clause_ref.lower().replace("-", "_").split(".")
    doc_id = parts[0] if parts else ""

    for doc in obs.documents:
        if doc.doc_id.lower() != doc_id:
            continue
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc not in obs.visible_sections:
                continue

            sec_id = section.section_id.lower()
            # Match if any ref part aligns with section_id
            if len(parts) > 1 and (parts[1] in sec_id or sec_id in parts[1]):
                # Trim to 500 chars — enough for evidence scoring, avoids token bloat
                text = section.content[:500].strip()
                if text:
                    return {"text": text, "loc": loc}

    # Broader fallback: return first visible section of the correct doc
    for doc in obs.documents:
        if doc.doc_id.lower() != doc_id:
            continue
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections and section.content.strip():
                return {"text": section.content[:500].strip(), "loc": loc}

    return None


def _get_incident_response_detail(response_type: str, incident) -> str:
    """Returns a regulation-specific incident response detail string."""
    inc_type = getattr(incident, "incident_type", "data_breach")
    details  = {
        "contain_breach": (
            f"Immediately isolate affected systems to contain the {inc_type}. "
            "Revoke compromised credentials, terminate suspect sessions, "
            "and preserve forensic evidence without alteration."
        ),
        "document_incident": (
            f"Document the {inc_type}: timestamp, affected data categories, "
            "number of records exposed, root cause, and containment actions taken. "
            "Required for GDPR Art. 33 notification package and HIPAA breach log."
        ),
        "notify_supervisory_authority": (
            "Notify the competent Data Protection Authority within 72 hours of awareness "
            "(GDPR Art. 33). Include: nature of breach, categories and approximate number "
            "of data subjects, DPO contact details, likely consequences, and measures taken."
        ),
        "notify_data_subjects": (
            "Notify affected data subjects without undue delay when the breach is likely to "
            "result in high risk (GDPR Art. 34). Communication must be clear, plain language, "
            "describe the breach nature and recommend protective measures."
        ),
        "engage_dpo": (
            "Involve the Data Protection Officer immediately per GDPR Art. 38(1). "
            "DPO must advise on notification obligations, coordinate with supervisory authority, "
            "and document all decisions made during incident response."
        ),
        "notify_hhs": (
            "Submit HIPAA Breach Notification to HHS Office for Civil Rights within 60 days "
            "of discovery (45 CFR 164.408). For breaches affecting 500+ individuals in a state, "
            "also notify prominent media outlets per 45 CFR 164.406."
        ),
    }
    return details.get(
        response_type,
        f"Execute required incident response step '{response_type}' "
        f"in compliance with applicable regulatory timeline for {inc_type}.",
    )


# ══════════════════════════════════════════════════════════════════════════════
# Keyword-rich remediation templates (Bible §6.4)
# ══════════════════════════════════════════════════════════════════════════════
# Every string is engineered to hit the canonical_remediation_keywords the grader
# checks (Bible §6.4). Generic text scores 0.00 — these templates score 0.70+.

_REMEDIATIONS: dict[str, str] = {
    "data_retention": (
        "Specify a maximum retention period for each data category "
        "(e.g., 24 months for profile data, 12 months for analytics logs, "
        "7 years for financial records). Implement automated deletion upon expiry "
        "and purge backups on the same schedule. "
        "Document the retention schedule and review annually. "
        "Do not retain personal data longer than necessary per GDPR Article 5(1)(e)."
    ),
    "consent_mechanism": (
        "Replace bundled or implied consent with explicit, freely given, specific, "
        "informed, and unambiguous opt-in consent obtained prior to processing. "
        "Each distinct processing purpose requires separate consent. "
        "Consent must be withdrawable at any time without detriment, "
        "via a mechanism as easy as the one used to give it (GDPR Article 7). "
        "Retain time-stamped consent records as evidence."
    ),
    "breach_notification": (
        "Commit to notifying the supervisory authority (Data Protection Authority) "
        "within 72 hours of becoming aware of a personal data breach, "
        "without undue delay, as required by GDPR Article 33. "
        "Notification must include: nature of breach, categories and number of "
        "data subjects, DPO contact, likely consequences, and remediation measures. "
        "Assign clear internal ownership and maintain a breach register."
    ),
    "data_subject_rights": (
        "Provide clear, accessible mechanisms to exercise all GDPR rights "
        "(Articles 15–21): right of access, erasure, rectification, restriction, "
        "portability, and objection. Respond within 30 calendar days. "
        "Apply Article 17(3) exemptions narrowly, case-by-case, with written documentation. "
        "Do not require account login to submit a rights request."
    ),
    "cross_border_transfer": (
        "Implement Standard Contractual Clauses (SCCs) as approved by the European Commission "
        "(Decision 2021/914) for all EU-to-third-country data transfers. "
        "Conduct a Transfer Impact Assessment (TIA) for each transfer. "
        "Maintain signed SCC copies and make them available to supervisory authorities on request. "
        "Evaluate adequacy decisions annually for changes in recipient country law."
    ),
    "data_minimization": (
        "Audit all collected data fields against each stated processing purpose. "
        "Remove collection of any field not strictly necessary for that purpose. "
        "Apply the minimum necessary standard per GDPR Article 5(1)(c) and HIPAA 45 CFR 164.502(b). "
        "Document justification for each retained field and review every 12 months. "
        "Use pseudonymisation or aggregation wherever the full identifier is not required."
    ),
    "purpose_limitation": (
        "Remove open-ended purpose clauses (e.g., 'and other business purposes'). "
        "Enumerate all processing purposes explicitly and exhaustively prior to data collection. "
        "Any secondary use must be assessed for compatibility with the original purpose "
        "or requires fresh, specific consent per GDPR Article 5(1)(b) and Article 6(4). "
        "Maintain a Record of Processing Activities (RoPA) documenting each purpose."
    ),
    "dpo_requirement": (
        "Appoint a qualified Data Protection Officer (DPO) with the expert knowledge of "
        "data protection law required by GDPR Article 37. "
        "Register the DPO with the relevant supervisory authority and publish contact details. "
        "Ensure DPO independence: they must report to the highest management level "
        "and must not receive instructions on how to perform their tasks (GDPR Article 38). "
        "Involve the DPO in all DPIAs, breach responses, and high-risk processing decisions."
    ),
    "phi_safeguard": (
        "Implement all required HIPAA technical safeguards per 45 CFR 164.312: "
        "AES-256 encryption for PHI at rest and TLS 1.2+ for PHI in transit; "
        "role-based access control with unique user identification and automatic logoff; "
        "audit logs of all PHI access retained for 6 years; "
        "workforce training completed within 30 days of hire and annually thereafter. "
        "Apply the minimum necessary standard to all PHI uses and disclosures."
    ),
    "baa_requirement": (
        "Execute a Business Associate Agreement (BAA) compliant with 45 CFR 164.314 "
        "with every Business Associate that creates, receives, maintains, or transmits PHI. "
        "Do not share or permit access to PHI until a signed BAA is in place. "
        "BAA must specify permitted uses, safeguard obligations, breach notification duties, "
        "and subcontractor requirements. Review and renew BAAs annually."
    ),
    "opt_out_mechanism": (
        "Add a clear and conspicuous 'Do Not Sell or Share My Personal Information' link "
        "on the homepage and within the privacy policy, per CCPA 1798.135. "
        "Implement Global Privacy Control (GPC) signal recognition. "
        "Process opt-out requests within 15 business days and confirm to the consumer. "
        "Do not require account creation to submit an opt-out request."
    ),
    "audit_log_requirement": (
        "Retain tamper-evident audit logs capturing all access to PHI and personal data "
        "for a minimum of 6 years from creation date, per HIPAA 45 CFR 164.316 and SOC 2 CC7. "
        "Logs must record: user identity, timestamp, action performed, and data accessed. "
        "Restrict log access to authorised personnel only. "
        "Test log integrity and completeness quarterly. Alert on anomalous access patterns."
    ),
    "availability_control": (
        "Implement redundancy, automated failover, and geographically separated backups "
        "to meet the committed SLA per SOC 2 Availability criterion A1. "
        "Test recovery procedures quarterly and document results. "
        "Publish accurate, real-time uptime metrics. "
        "Conduct root-cause analysis for all SLA-breach incidents within 5 business days "
        "and implement corrective actions to prevent recurrence."
    ),
}


def _get_remediation_text(gap_type) -> str:
    """Returns the keyword-rich remediation string for a given GapType enum or str."""
    key = gap_type.value if hasattr(gap_type, "value") else str(gap_type)
    return _REMEDIATIONS.get(
        key,
        (
            "Conduct a full gap analysis against the applicable regulatory requirements. "
            "Implement specific technical and organisational controls to remediate the identified "
            "deficiency. Document the remediation steps, assign ownership, and set a completion "
            "deadline. Verify effectiveness through an independent review within 90 days."
        ),
    )