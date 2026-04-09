"""
ARIA — Baseline Agent Prompts  (token-optimised v4)
=====================================================
baseline/prompts.py

v4 changes:
  - SYSTEM_PROMPT: stripped down to ~60% of original size.
    All scoring rules and red herring examples removed — the LLM only needs
    to identify ONE gap, not understand the full scoring system.
  - build_user_prompt(): retained for backward compatibility but now delegates
    to build_gap_identification_prompt() internally — it's never called
    directly by the v4 agents.
  - build_gap_identification_prompt(): section content capped at 200 chars
    (was 350). Step-hint threshold lowered to 8 steps (was 10).

Both agents in agent.py now use _build_llm_gap_prompt() (inline in agent.py)
which is even leaner than build_gap_identification_prompt().
These functions are kept here for any external code that imports them.
"""
from __future__ import annotations
from aria.models import ARIAObservation


# ══════════════════════════════════════════════════════════════════════════════
# System Prompt  (v4 — compact, enum-anchored)
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are ARIA-Auditor, a senior AI compliance analyst.

VALID gap_type VALUES — use EXACTLY one of these, nothing else:
  data_retention, consent_mechanism, breach_notification, data_subject_rights,
  cross_border_transfer, data_minimization, purpose_limitation, dpo_requirement,
  phi_safeguard, baa_requirement, opt_out_mechanism, audit_log_requirement,
  availability_control

YOUR WORKFLOW:
1. READ: request_section for each document section before flagging anything.
2. IDENTIFY: identify_gap with clause_ref, gap_type (from list above), severity, description.
3. CITE: cite_evidence immediately after each gap — quote the exact offending passage.
4. REMEDIATE: submit_remediation with specific regulatory language (e.g. "72 hours",
   "maximum retention period", "standard contractual clauses", "freely given").
5. ESCALATE: escalate_conflict for cross-framework contradictions.
6. FINALIZE: submit_final_report when complete or steps_remaining < 3.

VALID action_type values:
  request_section, identify_gap, cite_evidence, submit_remediation,
  escalate_conflict, respond_to_incident, submit_final_report

severity: high | medium | low
framework: GDPR | HIPAA | CCPA | SOC2

Respond with EXACTLY ONE JSON object. No markdown. No explanation.
Examples:
{"action_type":"request_section","document_id":"privacy_policy","section_id":"s3"}
{"action_type":"identify_gap","clause_ref":"privacy_policy.s3","gap_type":"data_retention","severity":"high","description":"No maximum retention period — violates GDPR Art. 5(1)(e)"}
{"action_type":"cite_evidence","finding_id":"abc12345","passage_text":"We retain data as long as necessary","passage_location":"privacy_policy.s3"}
{"action_type":"submit_remediation","finding_id":"abc12345","remediation_text":"Specify a maximum retention period of 24 months with automatic deletion per Article 5(1)(e)"}
{"action_type":"submit_final_report"}
"""


# ══════════════════════════════════════════════════════════════════════════════
# build_gap_identification_prompt  (used by MultiPassAgent Phase 2)
# ══════════════════════════════════════════════════════════════════════════════

def build_gap_identification_prompt(obs: ARIAObservation) -> str:
    """
    Focused prompt for gap identification only.
    Section content capped at 200 chars (v4, was 350 in v3).
    """
    visible_sections: list[str] = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections:
                content_preview = section.content[:200].strip().replace("\n", " ")
                visible_sections.append(f"[{loc}] {section.title}: {content_preview}")

    known_refs = sorted({f.clause_ref for f in obs.active_findings})

    frameworks = [
        getattr(f, "value", str(f))
        for f in obs.regulatory_context.frameworks_in_scope
    ]

    step_hint = ""
    if obs.steps_remaining < 8:
        step_hint = (
            f"\n⚠ Only {obs.steps_remaining} steps remaining. "
            "If no clear gap found, respond with submit_final_report."
        )

    return (
        f"Frameworks: {frameworks}\n"
        f"Steps remaining: {obs.steps_remaining}{step_hint}\n\n"
        "SECTIONS READ:\n"
        + ("\n".join(visible_sections) if visible_sections else "(none yet — use request_section first)")
        + "\n\nALREADY FOUND (DO NOT DUPLICATE):\n"
        + ("\n".join(f"  - {r}" for r in known_refs) if known_refs else "  (none yet)")
        + "\n\nVALID gap_type: data_retention, consent_mechanism, breach_notification, "
        "data_subject_rights, cross_border_transfer, data_minimization, purpose_limitation, "
        "dpo_requirement, phi_safeguard, baa_requirement, opt_out_mechanism, "
        "audit_log_requirement, availability_control"
        + "\n\nIdentify ONE compliance gap. Respond with identify_gap JSON or submit_final_report."
    )


# ══════════════════════════════════════════════════════════════════════════════
# build_user_prompt  (kept for backward compatibility — delegates to gap prompt)
# ══════════════════════════════════════════════════════════════════════════════

def build_user_prompt(obs: ARIAObservation) -> str:
    """
    Backward-compatible wrapper. v4 agents never call this directly,
    but any external code that imports it will get the gap-identification
    prompt instead of the old full-observation dump.
    """
    return build_gap_identification_prompt(obs)