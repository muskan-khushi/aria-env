"""
ARIA — Baseline Agent Classes
==============================
baseline/agent.py

Two agents:
  SinglePassAgent  — LLM with structured JSON, full conversation history
  MultiPassAgent   — Curriculum heuristic: read → identify+cite → remediate → escalate → finalise

Key fixes in this version:
  1. _MAX_READ_SECTIONS=10 cap: prevents reading phase eating all steps on hard/expert
     (easy=3 secs, medium=10 secs, hard=14 secs, expert=21 secs — uncapped = 0 audit steps)
  2. _llm_fail_count / _llm_disabled: after 3 consecutive 402/500 errors, permanently
     disables LLM for the episode and switches to _heuristic_identify_gap()
  3. _heuristic_identify_gap(): pattern-matching gap detector — ensures hard/expert
     always produce SOME findings even with no API credits (was scoring 0.03, now ~0.15-0.25)
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
MODEL_NAME   = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-72B-Instruct")
_MAX_TOKENS  = 512
_TEMPERATURE = 0.0


# ══════════════════════════════════════════════════════════════════════════════
# SinglePassAgent
# ══════════════════════════════════════════════════════════════════════════════

class SinglePassAgent:
    """
    LLM baseline agent with rolling 6-message conversation window.
    Expected scores (Bible §7.4): easy=0.87, medium=0.63, hard=0.44, expert=0.28
    """

    def __init__(self, client) -> None:
        self.client  = client
        self.history = []

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
                    *self.history[-6:],
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
    Curriculum heuristic agent. Phase boundaries (% of total steps):
      0 – 25%   READ:       request_section up to _MAX_READ_SECTIONS cap
      25 – 72%  AUDIT:      identify_gap → cite_evidence per finding
      72 – 90%  REMEDIATE:  submit_remediation for every confirmed finding
      90 – 100% FINALISE:   escalate_conflict → submit_final_report

    Expert override: respond_to_incident immediately if active_incident present.

    LLM failure handling:
      After _LLM_FAIL_THRESHOLD consecutive failures (e.g. 402 out-of-credits),
      switches permanently to _heuristic_identify_gap() for the episode.
      This prevents the hard/expert score-0.03 loop caused by:
        LLM fails → _fallback_action reads more sections → episode ends with no gaps found
    """

    _MAX_READ_SECTIONS  = 10   # stop reading after this many sections, force audit phase
    _LLM_FAIL_THRESHOLD = 3    # consecutive failures before disabling LLM

    def __init__(self, client=None) -> None:
        self.client = client
        self._escalated_conflicts: set[str] = set()
        self._llm_fail_count: int  = 0
        self._llm_disabled:   bool = False

    def act(self, obs: ARIAObservation) -> ARIAAction:
        step  = obs.steps_taken
        total = step + obs.steps_remaining

        # Expert override: incidents take absolute priority (Bible §5.2)
        if obs.active_incident:
            action = self._handle_incident(obs)
            if action:
                return action

        # Finalise when almost out of steps
        if obs.steps_remaining < 4:
            return self._finalization_phase(obs)

        # Reading phase: only if within first 25% AND under section cap
        still_reading = (
            step < total * 0.25
            and len(obs.visible_sections) < self._MAX_READ_SECTIONS
        )

        if still_reading:
            return self._reading_phase(obs)
        elif step < total * 0.72:
            return self._auditing_phase(obs)
        elif step < total * 0.90:
            return self._remediation_phase(obs)
        else:
            return self._finalization_phase(obs)

    # ── Phase 1: Read first N sections ───────────────────────────────────────

    def _reading_phase(self, obs: ARIAObservation) -> ARIAAction:
        for doc in obs.documents:
            for section in doc.sections:
                loc = f"{doc.doc_id}.{section.section_id}"
                if loc not in obs.visible_sections:
                    return ARIAAction(
                        action_type=ActionType.REQUEST_SECTION,
                        document_id=doc.doc_id,
                        section_id=section.section_id,
                    )
        return self._auditing_phase(obs)

    # ── Phase 2: Identify gaps + cite evidence ────────────────────────────────

    def _auditing_phase(self, obs: ARIAObservation) -> ARIAAction:
        # Priority 1: cite any uncited finding immediately (+0.12 each)
        uncited_action = self._cite_next_uncited(obs)
        if uncited_action:
            return uncited_action

        # Priority 2: LLM gap identification (or heuristic if LLM disabled)
        if self.client and not self._llm_disabled:
            return self._llm_identify_gap(obs)
        return self._heuristic_identify_gap(obs)

    def _cite_next_uncited(self, obs: ARIAObservation) -> Optional[ARIAAction]:
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
        from baseline.prompts import SYSTEM_PROMPT, build_user_prompt
        try:
            prompt   = build_user_prompt(obs)
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
            self._llm_fail_count = 0  # reset on success
            return ARIAAction(**data)

        except Exception as exc:
            self._llm_fail_count += 1
            print(
                f"    [MultiPass] LLM error "
                f"({self._llm_fail_count}/{self._LLM_FAIL_THRESHOLD}): {exc}",
                flush=True,
            )
            if self._llm_fail_count >= self._LLM_FAIL_THRESHOLD:
                self._llm_disabled = True
                print(
                    "    [MultiPass] LLM disabled — switching to heuristic mode.",
                    flush=True,
                )
            # On each failure: try heuristic immediately rather than reading more
            return self._heuristic_identify_gap(obs)

    def _heuristic_identify_gap(self, obs: ARIAObservation) -> ARIAAction:
        """
        Keyword-pattern gap detector for when LLM is unavailable.
        Scans visible section content for known violation signatures.
        Returns first undetected gap found, or reads next section, or finalises.
        """
        known_refs = {f.clause_ref for f in obs.active_findings}

        for doc in obs.documents:
            for section in doc.sections:
                loc = f"{doc.doc_id}.{section.section_id}"
                if loc not in obs.visible_sections:
                    continue
                content_lower = section.content.lower()
                clause_ref    = f"{doc.doc_id}.{section.section_id}"

                if clause_ref in known_refs:
                    continue

                for gap_type_str, (triggers, safe_phrases), severity_str, desc_tpl in _HEURISTIC_PATTERNS:
                    has_trigger    = any(p in content_lower for p in triggers)
                    is_red_herring = any(p in content_lower for p in safe_phrases)
                    if has_trigger and not is_red_herring:
                        try:
                            gap_type = GapType(gap_type_str)
                            severity = Severity(severity_str)
                        except Exception:
                            gap_type = gap_type_str   # type: ignore[assignment]
                            severity = severity_str   # type: ignore[assignment]
                        return ARIAAction(
                            action_type=ActionType.IDENTIFY_GAP,
                            clause_ref=clause_ref,
                            gap_type=gap_type,
                            severity=severity,
                            description=desc_tpl.format(loc=clause_ref),
                        )

        # No heuristic gap found — read one more unread section or finalise
        for doc in obs.documents:
            for section in doc.sections:
                loc = f"{doc.doc_id}.{section.section_id}"
                if loc not in obs.visible_sections:
                    return ARIAAction(
                        action_type=ActionType.REQUEST_SECTION,
                        document_id=doc.doc_id,
                        section_id=section.section_id,
                    )
        return self._finalization_phase(obs)

    # ── Phase 3: Remediate ────────────────────────────────────────────────────

    def _remediation_phase(self, obs: ARIAObservation) -> ARIAAction:
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
        return self._finalization_phase(obs)

    # ── Phase 4: Escalate conflicts + submit final report ─────────────────────

    def _finalization_phase(self, obs: ARIAObservation) -> ARIAAction:
        conflicts = getattr(obs.regulatory_context, "conflicts", []) or []
        for conflict in conflicts:
            cid = getattr(conflict, "conflict_id", str(conflict))
            if cid not in self._escalated_conflicts:
                self._escalated_conflicts.add(cid)
                return ARIAAction(
                    action_type=ActionType.ESCALATE_CONFLICT,
                    framework_a=getattr(conflict, "framework_a", None),
                    framework_b=getattr(conflict, "framework_b", None),
                    conflict_desc=getattr(conflict, "description", "Cross-framework conflict"),
                )
        return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)

    # ── Expert mode: incident response ────────────────────────────────────────

    def _handle_incident(self, obs: ARIAObservation) -> Optional[ARIAAction]:
        inc = obs.active_incident
        if inc is None:
            return None
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
# Heuristic gap patterns
# (gap_type_str, (trigger_phrases, safe_phrases), severity_str, desc_template)
# trigger_phrases: ANY match → potential gap
# safe_phrases:    ANY match → clause is compliant (red herring guard)
# ══════════════════════════════════════════════════════════════════════════════

_HEURISTIC_PATTERNS = [
    (
        "data_retention",
        (
            ["retain", "retention", "keep data", "store data", "archive", "as long as necessary",
             "indefinitely", "until no longer needed"],
            ["maximum period", "maximum retention", "delete after", "purge after",
             "retained for no longer", "not exceed", "automatically deleted", "24 months",
             "12 months", "7 years", "retention schedule"],
        ),
        "high",
        "No maximum retention period specified in {loc} — potential Article 5(1)(e) GDPR violation",
    ),
    (
        "consent_mechanism",
        (
            ["by using our service", "continuing to use", "implied consent",
             "deemed to have consented", "acceptance of these terms"],
            ["freely given", "explicit consent", "prior to processing", "withdrawable",
             "separate consent", "opt-in", "unambiguous consent"],
        ),
        "high",
        "Consent mechanism in {loc} may not meet GDPR Article 7 freely-given, specific, informed standard",
    ),
    (
        "breach_notification",
        (
            ["data breach", "security incident", "unauthorized access", "breach notification",
             "notify affected", "we will notify"],
            ["72 hours", "72-hour", "without undue delay", "supervisory authority",
             "article 33", "within 72", "dpa notification"],
        ),
        "high",
        "Breach notification clause in {loc} does not commit to GDPR Art.33 72-hour supervisory authority notification",
    ),
    (
        "cross_border_transfer",
        (
            ["united states", "us servers", "third country", "outside the eu",
             "outside europe", "international transfer", "transferred to and processed"],
            ["standard contractual clauses", "scc", "adequacy decision",
             "binding corporate rules", "article 46", "privacy framework"],
        ),
        "medium",
        "International transfer in {loc} lacks adequate transfer mechanism per GDPR Art.46 (SCCs/adequacy)",
    ),
    (
        "data_subject_rights",
        (
            ["decline deletion", "decline requests", "sole discretion", "may deny",
             "right to erasure", "right to delete", "deletion request"],
            ["without undue delay", "30 days", "article 17", "article 15",
             "exercised at any time", "right to erasure is honoured"],
        ),
        "medium",
        "Data subject rights clause in {loc} may improperly restrict GDPR Arts 15-21 rights",
    ),
    (
        "opt_out_mechanism",
        (
            ["contact us to opt", "email us to opt", "no automated opt-out",
             "do not currently provide an automated", "opt out by contacting"],
            ["do not sell or share", "automated opt-out", "privacy settings page",
             "global privacy control", "gpc signal", "1798.135"],
        ),
        "medium",
        "Opt-out mechanism in {loc} does not meet CCPA 1798.135 automated opt-out requirement",
    ),
    (
        "purpose_limitation",
        (
            ["other business purposes", "future purposes", "any other purpose",
             "including but not limited to", "such as advertising, market research"],
            ["compatible purpose", "article 5(1)(b)", "purpose limitation",
             "specified purpose only", "original purpose only"],
        ),
        "medium",
        "Open-ended purpose clause in {loc} violates GDPR Article 5(1)(b) purpose limitation",
    ),
    (
        "baa_requirement",
        (
            ["share data with", "third-party partners", "business associates",
             "subprocessors", "service providers receive phi", "vendor receives"],
            ["business associate agreement", "baa in place", "data processing agreement",
             "dpa signed", "45 cfr 164.314", "signed baa"],
        ),
        "high",
        "Vendor/processor data sharing in {loc} may lack required BAA per HIPAA 45 CFR 164.314",
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
# Shared helpers
# ══════════════════════════════════════════════════════════════════════════════

def _fallback_action(obs: ARIAObservation) -> ARIAAction:
    """Read next unread section, or submit final report. Never penalised."""
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
    Finds visible section content for a clause_ref like 'privacy_policy.s3'.
    Three-tier fuzzy match: exact → partial section_id → first visible in doc.
    """
    if not clause_ref:
        return None

    parts  = clause_ref.lower().replace("-", "_").split(".")
    doc_id = parts[0] if parts else ""

    # Tier 1 + 2: doc match + section_id partial match
    for doc in obs.documents:
        if doc.doc_id.lower() != doc_id:
            continue
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc not in obs.visible_sections:
                continue
            sec_id = section.section_id.lower()
            if len(parts) > 1 and (parts[1] in sec_id or sec_id in parts[1]):
                text = section.content[:500].strip()
                if text:
                    return {"text": text, "loc": loc}

    # Tier 3: first visible section of the correct doc
    for doc in obs.documents:
        if doc.doc_id.lower() != doc_id:
            continue
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections and section.content.strip():
                return {"text": section.content[:500].strip(), "loc": loc}

    return None


def _get_incident_response_detail(response_type: str, incident) -> str:
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
# Generic text scores 0.00 — these templates target 0.70+ keyword coverage.
# ══════════════════════════════════════════════════════════════════════════════

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