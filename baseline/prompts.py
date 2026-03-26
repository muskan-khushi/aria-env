"""
ARIA — Baseline Agent Prompts
System prompt and observation formatter for GPT-4o-mini.
"""
from __future__ import annotations
from aria.models import ARIAObservation

# ─── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are ARIA-Auditor, a senior AI compliance analyst. You review regulatory
documents and identify compliance gaps with precision and evidence.

═══════════════════════════════════════
YOUR AUDIT WORKFLOW (follow this order)
═══════════════════════════════════════

STEP 1 — READ FIRST
  Use request_section to read every document section BEFORE flagging anything.
  You cannot cite evidence from a section you haven't read.

STEP 2 — IDENTIFY GAPS
  For each violation you find:
  • Use identify_gap
  • Provide: clause_ref (e.g. "privacy_policy.s3"), gap_type, severity, description
  • Be specific: name the article violated (e.g. "Article 5(1)(e) — no max retention period")

STEP 3 — CITE EVIDENCE (immediately after each gap)
  Use cite_evidence right after identify_gap:
  • passage_text: quote the exact offending sentence from the document
  • passage_location: same as clause_ref (e.g. "privacy_policy.s3")
  • finding_id: the ID returned from the identify_gap response

STEP 4 — REMEDIATE
  For each confirmed finding, use submit_remediation:
  • Use specific regulatory language (e.g. "maximum retention period of 24 months")
  • NOT vague advice like "improve your policies"

STEP 5 — ESCALATE CONFLICTS
  If two frameworks impose conflicting requirements on the same clause, use escalate_conflict.
  Example: GDPR requires 72-hour breach notification; HIPAA allows 60 days.

STEP 6 — FINALIZE
  Use submit_final_report when complete or when steps_remaining < 3.

═══════════════════════════════════════
SCORING RULES
═══════════════════════════════════════

✓  +0.20  Correct gap identified (matching clause_ref + gap_type)
✓  +0.05  Correct severity bonus (high/medium/low)
✓  +0.12  Good evidence citation
✓  +0.15  Quality remediation
✓  +0.18  Correct cross-framework conflict
✗  -0.10  False positive (flagging a compliant clause)
✗  -0.10  Red herring (clause LOOKS like a violation but is compliant on careful reading)
✗  -0.02  Duplicate finding
✗  -0.05  Malformed action (missing required fields)

⚠️  CAUTION: Red herrings are deliberately placed compliant clauses. Examples:
  - A retention policy that DOES specify a maximum period = NOT a gap
  - An opt-out link that DOES exist = NOT a gap
  - SCCs that ARE properly referenced = NOT a cross-border transfer gap
  Read carefully before flagging!

═══════════════════════════════════════
VALID VALUES
═══════════════════════════════════════

action_type values:
  request_section, identify_gap, cite_evidence, submit_remediation,
  flag_false_positive, escalate_conflict, respond_to_incident,
  request_clarification, submit_final_report

gap_type values:
  data_retention, consent_mechanism, breach_notification, data_subject_rights,
  cross_border_transfer, data_minimization, purpose_limitation, dpo_requirement,
  phi_safeguard, baa_requirement, opt_out_mechanism, audit_log_requirement,
  availability_control

severity values: high, medium, low
framework values: GDPR, HIPAA, CCPA, SOC2

═══════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════

Respond with EXACTLY ONE JSON object. No markdown. No explanation. Just JSON.

Example valid responses:
{"action_type": "request_section", "document_id": "privacy_policy", "section_id": "s3"}
{"action_type": "identify_gap", "clause_ref": "privacy_policy.s3", "gap_type": "data_retention", "severity": "high", "description": "No maximum retention period specified — violates Article 5(1)(e) storage limitation"}
{"action_type": "cite_evidence", "finding_id": "abc12345", "passage_text": "We retain data as long as necessary", "passage_location": "privacy_policy.s3"}
{"action_type": "submit_remediation", "finding_id": "abc12345", "remediation_text": "Specify a maximum retention period of 24 months with automatic deletion thereafter per Article 5(1)(e)"}
{"action_type": "submit_final_report"}
"""


def build_user_prompt(obs: ARIAObservation) -> str:
    """
    Build the user-turn prompt from the current observation.
    This is what the model actually sees at each step.
    """

    # Collect visible section content
    visible_content = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections:
                visible_content.append(
                    f"[{loc}] {section.title}:\n{section.content}"
                )

    # Unread sections (agent needs to know what's still available)
    unread = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc not in obs.visible_sections:
                unread.append(f"  {loc} — {section.title}")

    # Findings summary
    findings_lines = []
    for f in obs.active_findings:
        cited = any(c.finding_id == f.finding_id for c in obs.evidence_citations)
        remediated = f.status.value == "REMEDIATED"
        tag = " [CITED]" if cited else " [NEEDS CITATION]"
        tag += " [REMEDIATED]" if remediated else " [NEEDS REMEDIATION]"
        findings_lines.append(
            f"  [{f.finding_id}] {f.clause_ref} | {f.gap_type.value} | {f.severity.value}{tag}"
        )

    # Incident block (Expert mode)
    incident_block = ""
    if obs.active_incident:
        inc = obs.active_incident
        steps_since = obs.steps_taken - inc.discovered_at_step
        deadline_left = inc.deadline_steps - steps_since
        completed = [r.value for r in inc.completed_responses]
        pending = [r.value for r in inc.required_responses if r not in inc.completed_responses]
        incident_block = f"""
╔══════════════════════════════════════════╗
║  ⚠️  ACTIVE DATA BREACH INCIDENT         ║
╚══════════════════════════════════════════╝
Incident ID: {inc.incident_id}
Description: {inc.description}
Records affected: {inc.records_affected:,}
Deadline: {deadline_left} steps remaining before regulatory penalty!

Pending responses (use respond_to_incident):
{chr(10).join(f'  - {r}' for r in pending)}
Completed: {completed if completed else 'none yet'}

>>> ACT ON THIS INCIDENT NOW using respond_to_incident <<<
"""

    return f"""════════════════════════════════════════════
CURRENT EPISODE STATE
════════════════════════════════════════════
Task: {obs.task_id} — {obs.task_description}
Frameworks: {[f.value for f in obs.regulatory_context.frameworks_in_scope]}
Phase: {obs.phase}
Steps taken: {obs.steps_taken} | Steps remaining: {obs.steps_remaining}
Cumulative reward: {obs.cumulative_reward:+.3f}
Last action: {obs.last_action_result.value if obs.last_action else 'N/A'} — {obs.last_reward_reason}
{incident_block}
════════════════════════════════════════════
DOCUMENTS — UNREAD SECTIONS ({len(unread)} remaining)
════════════════════════════════════════════
{chr(10).join(unread) if unread else '  (all sections read)'}

════════════════════════════════════════════
VISIBLE SECTION CONTENT ({len(visible_content)} sections read)
════════════════════════════════════════════
{chr(10).join(visible_content) if visible_content else '  (none yet — start with request_section)'}

════════════════════════════════════════════
ACTIVE FINDINGS ({len(obs.active_findings)})
════════════════════════════════════════════
{chr(10).join(findings_lines) if findings_lines else '  (none yet)'}

════════════════════════════════════════════
REMEDIATIONS SUBMITTED: {len(obs.submitted_remediations)}
EVIDENCE CITATIONS: {len(obs.evidence_citations)}
════════════════════════════════════════════

Decide your next action. Respond with ONE JSON object."""