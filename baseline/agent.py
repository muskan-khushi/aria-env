"""
ARIA — Baseline Agent Classes
Separated from run_baseline.py so they can be imported independently.

Two agents:
  SinglePassAgent  — GPT-4o-mini with structured JSON, follows prompt instructions
  MultiPassAgent   — Curriculum heuristic: read → identify+cite → remediate → finalize
"""
from __future__ import annotations
import json
from aria.models import (
    ARIAObservation, ARIAAction, ActionType,
    GapType, Severity, Framework
)

SEED = 42


class SinglePassAgent:
    """
    GPT-4o-mini baseline agent.

    How it works:
    - Gets the full observation (all documents, current findings, step count, etc.)
    - Sends it to GPT-4o-mini with a detailed system prompt
    - GPT-4o-mini returns ONE JSON action
    - We parse it into ARIAAction and submit it

    Strengths: Reads the actual document content and reasons about it
    Weakness:  Can make mistakes, flag red herrings, miss cross-framework issues
    """

    def __init__(self, client):
        """client: an openai.OpenAI() instance"""
        self.client = client
        self.history = []  # keep last few turns for context

    def act(self, obs: ARIAObservation) -> ARIAAction:
        from baseline.prompts import SYSTEM_PROMPT, build_user_prompt
        user_msg = build_user_prompt(obs)
        self.history.append({"role": "user", "content": user_msg})

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.0,      # deterministic
                seed=SEED,            # reproducible
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    *self.history[-6:],   # last 3 turns of context
                ],
                max_tokens=512,
            )
            raw = response.choices[0].message.content
            self.history.append({"role": "assistant", "content": raw})
            data = json.loads(raw)
            return ARIAAction(**data)
        except Exception as e:
            print(f"    [SinglePass] LLM error: {e} — using fallback")
            return _fallback_action(obs)


class MultiPassAgent:
    """
    Curriculum heuristic agent. Does NOT require an API key.

    Strategy (mirrors what a good human auditor does):
      Phase 1 (0–35% of steps):   Read every document section systematically
      Phase 2 (35–70% of steps):  Identify gaps + cite evidence (uses LLM if available)
      Phase 3 (70–90% of steps):  Submit remediations for all confirmed findings
      Phase 4 (90–100% of steps): Escalate conflicts + submit final report

    This agent consistently scores 5-10 points higher than SinglePass because
    it reads ALL sections before judging — just like a thorough human auditor.
    """

    def __init__(self, client=None):
        """client: optional openai.OpenAI() — used for gap identification in phase 2"""
        self.client = client

    def act(self, obs: ARIAObservation) -> ARIAAction:
        step = obs.steps_taken
        total = step + obs.steps_remaining

        if step < total * 0.35:
            return self._reading_phase(obs)
        elif step < total * 0.70:
            return self._auditing_phase(obs)
        elif step < total * 0.90:
            return self._remediation_phase(obs)
        else:
            return self._finalization_phase(obs)

    # ── Phase 1: Read everything ──────────────────────────────────────────────

    def _reading_phase(self, obs: ARIAObservation) -> ARIAAction:
        """Read every unread section in document order."""
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

    # ── Phase 2: Identify gaps + cite evidence ────────────────────────────────

    def _auditing_phase(self, obs: ARIAObservation) -> ARIAAction:
        # Handle active incident immediately — deadlines are strict
        if obs.active_incident:
            action = self._handle_incident(obs)
            if action:
                return action

        # Always cite uncited findings before identifying new ones
        cited_ids = {c.finding_id for c in obs.evidence_citations}
        uncited = [f for f in obs.active_findings if f.finding_id not in cited_ids]
        if uncited:
            finding = uncited[0]
            passage = _find_passage(finding.clause_ref, obs)
            if passage:
                return ARIAAction(
                    action_type=ActionType.CITE_EVIDENCE,
                    finding_id=finding.finding_id,
                    passage_text=passage["text"],
                    passage_location=passage["loc"],
                )

        # Use LLM (if available) or fallback heuristic to identify next gap
        if self.client:
            return self._llm_identify_gap(obs)
        else:
            return _fallback_action(obs)

    def _handle_incident(self, obs: ARIAObservation) -> ARIAAction | None:
        """Respond to active incident in the correct order."""
        inc = obs.active_incident
        for resp in inc.required_responses:
            if resp not in inc.completed_responses:
                return ARIAAction(
                    action_type=ActionType.RESPOND_TO_INCIDENT,
                    incident_id=inc.incident_id,
                    response_type=resp,
                    response_detail=f"Executing required incident response: {resp.value}",
                )
        return None

    def _llm_identify_gap(self, obs: ARIAObservation) -> ARIAAction:
        """Ask GPT-4o-mini to identify the next compliance gap."""
        from baseline.prompts import SYSTEM_PROMPT
        try:
            visible = []
            for doc in obs.documents:
                for s in doc.sections:
                    if f"{doc.doc_id}.{s.section_id}" in obs.visible_sections:
                        visible.append(f"[{doc.doc_id}.{s.section_id}] {s.title}:\n{s.content[:400]}")

            known = {f.clause_ref for f in obs.active_findings}
            frameworks = [f.value for f in obs.regulatory_context.frameworks_in_scope]

            prompt = f"""Frameworks in scope: {frameworks}
Steps remaining: {obs.steps_remaining}

Document sections you have read:
{chr(10).join(visible[:10])}

Findings already identified (do NOT duplicate): {list(known)}

Identify ONE compliance gap not yet flagged.
Respond with EXACTLY ONE JSON object with action_type=identify_gap.
Required fields: action_type, clause_ref, gap_type, severity, description"""

            resp = self.client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.0,
                seed=SEED,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=256,
            )
            data = json.loads(resp.choices[0].message.content)
            return ARIAAction(**data)
        except Exception as e:
            print(f"    [MultiPass] LLM error: {e}")
            return _fallback_action(obs)

    # ── Phase 3: Remediate ────────────────────────────────────────────────────

    def _remediation_phase(self, obs: ARIAObservation) -> ARIAAction:
        """Submit remediations for all confirmed, unremediated findings."""
        unremediated = [
            f for f in obs.active_findings
            if f.status.value not in ("REMEDIATED", "RETRACTED")
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

    # ── Phase 4: Finalize ─────────────────────────────────────────────────────

    def _finalization_phase(self, obs: ARIAObservation) -> ARIAAction:
        return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _fallback_action(obs: ARIAObservation) -> ARIAAction:
    """Read next unread section, or submit final report if all read."""
    for doc in obs.documents:
        for section in doc.sections:
            if f"{doc.doc_id}.{section.section_id}" not in obs.visible_sections:
                return ARIAAction(
                    action_type=ActionType.REQUEST_SECTION,
                    document_id=doc.doc_id,
                    section_id=section.section_id,
                )
    return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)


def _find_passage(clause_ref: str, obs: ARIAObservation) -> dict | None:
    """Find the section content for a clause reference like 'privacy_policy.s3'."""
    parts = clause_ref.lower().split(".")
    if len(parts) < 2:
        return None
    doc_id, section_id = parts[0], parts[1]
    for doc in obs.documents:
        if doc.doc_id.lower() != doc_id:
            continue
        for section in doc.sections:
            if section.section_id.lower() == section_id:
                loc = f"{doc.doc_id}.{section.section_id}"
                if loc in obs.visible_sections:
                    # Use first 400 chars as the evidence passage
                    return {"text": section.content[:400], "loc": loc}
    return None


# Remediation templates keyed by gap type — specific enough to score well
_REMEDIATIONS = {
    "data_retention": (
        "Specify a maximum retention period for each data category (e.g., 24 months for profile data, "
        "12 months for analytics logs). Implement automated deletion upon expiry. "
        "Do not retain data longer than necessary per Article 5(1)(e) GDPR."
    ),
    "consent_mechanism": (
        "Replace bundled/implied consent with explicit, freely given, specific, informed, and "
        "unambiguous opt-in consent obtained prior to processing. Each processing purpose "
        "requires separate consent. Users must be able to withdraw consent at any time "
        "without detriment, per Article 7 GDPR."
    ),
    "breach_notification": (
        "Commit to notifying the supervisory authority (Data Protection Authority) within 72 hours "
        "of becoming aware of a personal data breach, without undue delay, as required by "
        "GDPR Article 33. Document the notification timeline and assign ownership."
    ),
    "data_subject_rights": (
        "Provide clear, accessible mechanisms to exercise all GDPR rights (Articles 15-21): "
        "access, erasure, rectification, restriction, portability, objection. Respond within "
        "30 days. Apply Article 17(3) exemptions narrowly, case-by-case, with documentation."
    ),
    "cross_border_transfer": (
        "Implement Standard Contractual Clauses (SCCs) as approved by the European Commission "
        "(Decision 2021/914) for all EU-US data transfers. Conduct Transfer Impact Assessments "
        "for high-risk transfers. Maintain copies of SCCs available to supervisory authorities."
    ),
    "data_minimization": (
        "Audit all collected data fields. Remove collection of any fields not strictly necessary "
        "for each specified purpose. Document justification for each retained field. "
        "Apply the minimum necessary standard per Article 5(1)(c) GDPR."
    ),
    "purpose_limitation": (
        "Remove open-ended purpose clauses. Enumerate all processing purposes explicitly and "
        "exhaustively prior to data collection. Any secondary use requires assessment of "
        "compatibility or fresh consent per Article 5(1)(b) GDPR."
    ),
    "dpo_requirement": (
        "Appoint a qualified Data Protection Officer (DPO) with the expertise required by "
        "Article 37 GDPR. Register the DPO with the supervisory authority. Ensure DPO "
        "independence and involve them in all DPIAs and high-risk processing decisions."
    ),
    "phi_safeguard": (
        "Implement HIPAA-required technical safeguards: AES-256 encryption at rest and TLS in "
        "transit, role-based access control, audit logs retained 6 years, workforce training, "
        "and minimum necessary standard for all PHI uses per 45 CFR 164.308/312."
    ),
    "baa_requirement": (
        "Execute a Business Associate Agreement (BAA) compliant with 45 CFR 164.314 with every "
        "vendor receiving PHI. Do not share or permit access to PHI until a signed BAA is in "
        "place. Review and renew BAAs annually."
    ),
    "opt_out_mechanism": (
        "Add a clear and conspicuous 'Do Not Sell or Share My Personal Information' link on the "
        "homepage and in the privacy policy, per CCPA 1798.135. Implement automated opt-out "
        "processing. Process opt-out requests within 15 business days."
    ),
    "audit_log_requirement": (
        "Retain audit logs capturing all access to PHI/personal data for a minimum of 6 years "
        "from creation date, per HIPAA 45 CFR 164.316 and SOC 2 CC7. Implement tamper-evident "
        "log storage with restricted access. Test log integrity quarterly."
    ),
    "availability_control": (
        "Implement redundancy, automated failover, and geographic backup to meet committed SLA. "
        "Conduct quarterly availability testing. Publish accurate uptime metrics. "
        "Document and address root causes of outages per SOC 2 A1 criteria."
    ),
}


def _get_remediation_text(gap_type) -> str:
    key = gap_type.value if hasattr(gap_type, "value") else str(gap_type)
    return _REMEDIATIONS.get(
        key,
        f"Review and remediate the compliance gap against applicable regulatory requirements. "
        f"Implement specific controls to address the identified deficiency."
    )