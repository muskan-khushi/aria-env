"""
ARIA — Baseline Agent Prompts
==============================
baseline/prompts.py

Three prompt builders:
  SYSTEM_PROMPT               — role + workflow + scoring rules (shared by all agents)
  build_user_prompt()         — full observation → user-turn string (SinglePassAgent)
  build_gap_identification_prompt() — focused auditing prompt (MultiPassAgent Phase 2)
"""
from __future__ import annotations
from aria.models import ARIAObservation

# ══════════════════════════════════════════════════════════════════════════════
# System Prompt  (Bible §7.2 — teaches correct audit workflow AND scoring rules)
# ══════════════════════════════════════════════════════════════════════════════

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
SCORING RULES (know these to win)
═══════════════════════════════════════

✓  +0.20  Correct gap identified (matching clause_ref + gap_type)
✓  +0.05  Correct severity bonus (high/medium/low matches ground truth)
✓  +0.12  Good evidence citation (passage from correct section)
✓  +0.15  Quality remediation (hits canonical keywords)
✓  +0.18  Correct cross-framework conflict identified
✓  +0.30  Recall bonus at episode end (gaps_found / total_gaps × 0.30)
✓  +0.20  Precision bonus at episode end (1 − false_positive_rate × 0.20)
✗  -0.10  False positive (flagging a compliant clause)
✗  -0.10  Red herring (clause looks like violation but is compliant — read carefully)
✗  -0.08  Retracting a correct finding
✗  -0.05  Malformed action (missing required fields)
✗  -0.02  Duplicate finding (same clause_ref + gap_type)
✗  -0.02  Re-requesting a section already read

⚠️  RED HERRING EXAMPLES (do NOT flag these):
  - "We retain data for a maximum period of 24 months" → COMPLIANT (max period IS specified)
  - "Users may opt out via Privacy Settings page" → COMPLIANT (opt-out mechanism EXISTS)
  - "Transfers governed by Standard Contractual Clauses" → COMPLIANT (SCCs ARE referenced)
  - "We collect general wellness survey responses" → COMPLIANT (not PHI under HIPAA)
  Read every clause carefully before flagging!

═══════════════════════════════════════
VALID FIELD VALUES
═══════════════════════════════════════

action_type:
  request_section, identify_gap, cite_evidence, submit_remediation,
  flag_false_positive, escalate_conflict, respond_to_incident,
  request_clarification, submit_final_report

gap_type:
  data_retention, consent_mechanism, breach_notification, data_subject_rights,
  cross_border_transfer, data_minimization, purpose_limitation, dpo_requirement,
  phi_safeguard, baa_requirement, opt_out_mechanism, audit_log_requirement,
  availability_control

severity: high, medium, low
framework: GDPR, HIPAA, CCPA, SOC2

═══════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════

Respond with EXACTLY ONE JSON object. No markdown. No explanation. Just JSON.

Examples:
{"action_type": "request_section", "document_id": "privacy_policy", "section_id": "s3"}
{"action_type": "identify_gap", "clause_ref": "privacy_policy.s3", "gap_type": "data_retention", "severity": "high", "description": "No maximum retention period specified — violates Article 5(1)(e) storage limitation"}
{"action_type": "cite_evidence", "finding_id": "abc12345", "passage_text": "We retain data as long as necessary", "passage_location": "privacy_policy.s3"}
{"action_type": "submit_remediation", "finding_id": "abc12345", "remediation_text": "Specify a maximum retention period of 24 months with automatic deletion thereafter per Article 5(1)(e)"}
{"action_type": "escalate_conflict", "framework_a": "GDPR", "framework_b": "HIPAA", "conflict_desc": "GDPR Art.33 requires supervisory authority notification within 72 hours; HIPAA 45 CFR 164.408 allows 60 days"}
{"action_type": "submit_final_report"}
"""


# ══════════════════════════════════════════════════════════════════════════════
# build_user_prompt  — full observation prompt (used by SinglePassAgent)
# ══════════════════════════════════════════════════════════════════════════════

def build_user_prompt(obs: ARIAObservation) -> str:
    """
    Builds the user-turn prompt from the full current observation.
    SinglePassAgent sends this every step with the last 3 assistant turns for context.
    MultiPassAgent also uses this in _llm_identify_gap for Phase 2 LLM calls.
    """
    # ── Visible section content ────────────────────────────────────────────────
    visible_content: list[str] = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections:
                visible_content.append(f"[{loc}] {section.title}:\n{section.content}")

    # ── Unread sections ────────────────────────────────────────────────────────
    unread: list[str] = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc not in obs.visible_sections:
                unread.append(f"  {loc} — {section.title}")

    # ── Findings summary ───────────────────────────────────────────────────────
    cited_ids = {c.finding_id for c in obs.evidence_citations}
    findings_lines: list[str] = []
    for f in obs.active_findings:
        cited      = f.finding_id in cited_ids
        remediated = getattr(f.status, "value", str(f.status)) == "REMEDIATED"
        tag = " [CITED]" if cited else " ⚠ NEEDS CITATION"
        tag += " [REMEDIATED]" if remediated else " | NEEDS REMEDIATION"
        findings_lines.append(
            f"  [{f.finding_id}] {f.clause_ref} | "
            f"{getattr(f.gap_type, 'value', f.gap_type)} | "
            f"{getattr(f.severity, 'value', f.severity)}{tag}"
        )

    # ── Incident block (Expert mode) ───────────────────────────────────────────
    incident_block = ""
    if obs.active_incident:
        inc         = obs.active_incident
        steps_since = obs.steps_taken - getattr(inc, "discovered_at_step", 0)
        deadline    = getattr(inc, "deadline_steps", 10)
        deadline_left = max(0, deadline - steps_since)

        completed_raw = getattr(inc, "completed_responses", []) or []
        required_raw  = getattr(inc, "required_responses", []) or []
        completed = [getattr(r, "value", str(r)) for r in completed_raw]
        pending   = [
            getattr(r, "value", str(r)) for r in required_raw
            if getattr(r, "value", str(r)) not in completed
        ]

        incident_block = f"""
╔══════════════════════════════════════════╗
║  ⚠️  ACTIVE DATA BREACH INCIDENT         ║
╚══════════════════════════════════════════╝
Incident ID   : {inc.incident_id}
Description   : {getattr(inc, 'description', 'Data breach in progress')}
Records affected: {getattr(inc, 'records_affected', '?'):,}
⏰ Deadline   : {deadline_left} steps remaining before -0.25 regulatory penalty!

Pending responses (use respond_to_incident for each in order):
{chr(10).join(f'  - {r}' for r in pending) if pending else '  (all complete)'}
Completed: {completed if completed else 'none yet'}

>>> RESPOND TO THIS INCIDENT NOW — deadline penalty is -0.25 per missed step <<<
"""

    # ── Assemble ───────────────────────────────────────────────────────────────
    last_action_result = getattr(obs.last_action_result, "value", str(obs.last_action_result)) \
        if obs.last_action_result else "N/A"

    return f"""════════════════════════════════════════════
CURRENT EPISODE STATE
════════════════════════════════════════════
Task        : {obs.task_id} — {obs.task_description}
Frameworks  : {[getattr(f, 'value', str(f)) for f in obs.regulatory_context.frameworks_in_scope]}
Phase       : {obs.phase}
Steps taken : {obs.steps_taken} | Steps remaining: {obs.steps_remaining}
Cumulative reward: {obs.cumulative_reward:+.3f}
Last action : {last_action_result} — {obs.last_reward_reason}
{incident_block}
════════════════════════════════════════════
DOCUMENTS — UNREAD SECTIONS ({len(unread)} remaining)
════════════════════════════════════════════
{chr(10).join(unread) if unread else '  (all sections read — move to identify_gap)'}

════════════════════════════════════════════
VISIBLE SECTION CONTENT ({len(visible_content)} sections read)
════════════════════════════════════════════
{chr(10).join(visible_content) if visible_content else '  (none yet — start with request_section)'}

════════════════════════════════════════════
ACTIVE FINDINGS ({len(obs.active_findings)})
════════════════════════════════════════════
{chr(10).join(findings_lines) if findings_lines else '  (none yet)'}

════════════════════════════════════════════
REMEDIATIONS SUBMITTED : {len(obs.submitted_remediations)}
EVIDENCE CITATIONS     : {len(obs.evidence_citations)}
════════════════════════════════════════════

{'⚠ FINAL STEPS: Use submit_final_report NOW to lock in recall + precision bonuses!' if obs.steps_remaining < 5 else ''}
Decide your next action. Respond with ONE JSON object."""


# ══════════════════════════════════════════════════════════════════════════════
# build_gap_identification_prompt  — focused prompt for MultiPassAgent Phase 2
# ══════════════════════════════════════════════════════════════════════════════

def build_gap_identification_prompt(obs: ARIAObservation) -> str:
    """
    Builds a tightly-scoped prompt for the LLM to identify the NEXT compliance gap.
    Used exclusively by MultiPassAgent._llm_identify_gap() in Phase 2.

    Differences from build_user_prompt():
      - Only sends visible section content (not unread stubs) → fewer tokens
      - Explicitly lists already-found findings to prevent duplicates (-0.02 each)
      - Ends with a direct instruction: ONE identify_gap JSON only
      - Fits comfortably within max_tokens=512 for the response
    """
    # ── Visible content (trimmed to 400 chars per section to stay within context) ──
    visible_sections: list[str] = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections:
                content_preview = section.content[:400].strip()
                visible_sections.append(f"[{loc}] {section.title}:\n{content_preview}")

    # ── Already-identified clause refs (avoid duplicates) ─────────────────────
    known_refs = sorted({f.clause_ref for f in obs.active_findings})

    # ── Frameworks in scope ────────────────────────────────────────────────────
    frameworks = [
        getattr(f, "value", str(f))
        for f in obs.regulatory_context.frameworks_in_scope
    ]

    # ── Steps budget hint ──────────────────────────────────────────────────────
    step_hint = ""
    if obs.steps_remaining < 10:
        step_hint = (
            f"\n⚠ Only {obs.steps_remaining} steps remaining. "
            "If no clear gap found, respond with submit_final_report instead."
        )

    return f"""You are auditing for compliance gaps. Frameworks in scope: {frameworks}
Steps remaining: {obs.steps_remaining}
{step_hint}

══════════════════════════════════════
DOCUMENT SECTIONS YOU HAVE READ
══════════════════════════════════════
{chr(10).join(visible_sections) if visible_sections else '(no sections read yet — use request_section first)'}

══════════════════════════════════════
FINDINGS ALREADY IDENTIFIED (DO NOT DUPLICATE)
══════════════════════════════════════
{chr(10).join(f'  - {r}' for r in known_refs) if known_refs else '  (none yet)'}

══════════════════════════════════════
TASK
══════════════════════════════════════
Identify ONE compliance gap that:
  1. Is NOT already in the list above
  2. Is a REAL violation (not a red herring — verify the clause is actually non-compliant)
  3. Has a specific clause_ref, the correct gap_type enum value, and severity

If all real gaps are already found, respond with:
{{"action_type": "submit_final_report"}}

Respond with EXACTLY ONE JSON object — either identify_gap or submit_final_report."""