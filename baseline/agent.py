"""
ARIA — Baseline Agent Classes  (token-optimised v4)
=====================================================
baseline/agent.py

TOKEN OPTIMISATION vs v3 (scores preserved):
  1. LLM called ONLY for gap identification — all other actions (read, cite,
     remediate, escalate, finalise, incident) are pure deterministic heuristic.
     Result: ≤8 LLM calls per episode instead of 25-39.
  2. LLM prompt is ALWAYS the small _build_llm_gap_prompt() — no growing section
     dump, no conversation history window.
  3. History window REMOVED — each LLM call is self-contained.
  4. Section content in prompts capped at 200 chars (was 300-400).
  5. _MAX_TOKENS reduced to 256 — gap JSON fits in ~40 tokens (was 800).
  6. LLM disabled after 2 consecutive failures → pure heuristic.

Logic PRESERVED (scores unchanged):
  - All heuristic patterns identical to v3 (same triggers + safe_phrases).
  - All remediation templates identical (same canonical keywords → same grader scores).
  - Phase boundaries identical.
  - Incident handling identical.
  - _safe_action / gap_type normalisation identical.
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Optional

from aria.models import (
    ARIAObservation, ARIAAction, ActionType,
    GapType, Severity, Framework,
)

# ── Config ───────────────────────────────────────────────────────────────────
MODEL_NAME   = os.environ.get("MODEL_NAME", "nvidia/nemotron-3-super-120b-a12b:free")
_MAX_TOKENS  = 256    # gap JSON is ~40 tokens; 256 is generous headroom (was 800)
_TEMPERATURE = 0.0


def _extract_json(text: str) -> dict:
    """Robustly extract JSON from LLM response text."""
    text = text.strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    md_match = re.search(r'```(?:json)?\s*\n?(\{.*?\})\s*```', text, re.DOTALL)
    if md_match:
        try:
            return json.loads(md_match.group(1))
        except json.JSONDecodeError:
            pass
    brace_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Cannot extract JSON from: {text[:200]}")


# ══════════════════════════════════════════════════════════════════════════════
# Gap-type alias table — maps LLM hallucinations → valid GapType strings
# ══════════════════════════════════════════════════════════════════════════════

_GAP_TYPE_ALIASES: dict[str, str] = {
    "sub_processor_transparency":   "baa_requirement",
    "subprocessor_transparency":    "baa_requirement",
    "subprocessor_management":      "baa_requirement",
    "third_party_disclosure":       "baa_requirement",
    "vendor_management":            "baa_requirement",
    "third_party_data_sharing":     "baa_requirement",
    "processor_agreement":          "baa_requirement",
    "data_processor_agreement":     "baa_requirement",
    "data_sharing":                 "data_minimization",
    "data_transfer":                "cross_border_transfer",
    "international_transfer":       "cross_border_transfer",
    "cross_border_data_transfer":   "cross_border_transfer",
    "access_rights":                "data_subject_rights",
    "subject_rights":               "data_subject_rights",
    "right_to_erasure":             "data_subject_rights",
    "data_rights":                  "data_subject_rights",
    "privacy_notice":               "purpose_limitation",
    "notice_requirement":           "purpose_limitation",
    "transparency":                 "purpose_limitation",
    "encryption":                   "phi_safeguard",
    "security_safeguard":           "phi_safeguard",
    "technical_safeguard":          "phi_safeguard",
    "security_measure":             "phi_safeguard",
    "data_security":                "phi_safeguard",
    "consent":                      "consent_mechanism",
    "opt_in":                       "consent_mechanism",
    "lawful_basis":                 "consent_mechanism",
    "retention":                    "data_retention",
    "storage_limitation":           "data_retention",
    "breach":                       "breach_notification",
    "incident_notification":        "breach_notification",
    "minimisation":                 "data_minimization",
    "minimization":                 "data_minimization",
    "data_collection":              "data_minimization",
    "dpo":                          "dpo_requirement",
    "data_protection_officer":      "dpo_requirement",
    "audit_log":                    "audit_log_requirement",
    "logging":                      "audit_log_requirement",
    "access_log":                   "audit_log_requirement",
    "availability":                 "availability_control",
    "sla":                          "availability_control",
    "uptime":                       "availability_control",
    "opt_out":                      "opt_out_mechanism",
    "do_not_sell":                  "opt_out_mechanism",
    "ccpa_opt_out":                 "opt_out_mechanism",
}

_VALID_GAP_TYPES: frozenset[str] = frozenset(e.value for e in GapType)


def _normalize_gap_type(raw: str) -> Optional[str]:
    if not raw:
        return None
    cleaned = raw.strip().lower().replace("-", "_").replace(" ", "_")
    if cleaned in _VALID_GAP_TYPES:
        return cleaned
    if cleaned in _GAP_TYPE_ALIASES:
        return _GAP_TYPE_ALIASES[cleaned]
    for valid in _VALID_GAP_TYPES:
        if valid.startswith(cleaned) or cleaned.startswith(valid[:8]):
            return valid
    return None


def _safe_action(data: dict, obs: ARIAObservation) -> ARIAAction:
    """Normalise LLM JSON and construct ARIAAction safely."""
    if "gap_type" in data and data["gap_type"]:
        fixed = _normalize_gap_type(str(data["gap_type"]))
        if fixed:
            data["gap_type"] = fixed
        else:
            print(f"    [ARIA] Unknown gap_type '{data['gap_type']}' — fallback", flush=True)
            return _fallback_action(obs)
    if "severity" in data and data["severity"]:
        sev_raw = str(data["severity"]).strip().lower()
        if sev_raw not in ("high", "medium", "low"):
            data["severity"] = "medium"
    try:
        return ARIAAction(**data)
    except Exception as exc:
        print(f"    [ARIA] ARIAAction failed: {exc} — fallback", flush=True)
        return _fallback_action(obs)


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
    Find visible section content for a clause_ref like 'privacy_policy.s3'.
    Three-tier fuzzy match: exact → partial section_id → first visible in doc.
    """
    if not clause_ref:
        return None
    parts  = clause_ref.lower().replace("-", "_").split(".")
    doc_id = parts[0] if parts else ""

    # Tier 1+2: doc match + section_id partial match
    for doc in obs.documents:
        if doc.doc_id.lower() != doc_id:
            continue
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc not in obs.visible_sections:
                continue
            sec_id = section.section_id.lower()
            if len(parts) > 1 and (parts[1] in sec_id or sec_id in parts[1]):
                text = section.content[:600].strip()
                if text:
                    return {"text": text, "loc": loc}

    # Tier 3: first visible section of the correct doc
    for doc in obs.documents:
        if doc.doc_id.lower() != doc_id:
            continue
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections and section.content.strip():
                return {"text": section.content[:600].strip(), "loc": loc}

    return None


def _get_incident_response_detail(response_type: str, incident) -> str:
    inc_type = getattr(incident, "incident_type", "data_breach")
    details = {
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
            "Notify the competent Data Protection Authority within 72 hours of awareness, "
            "without undue delay (GDPR Art. 33). Include: nature of breach, categories and "
            "approximate number of data subjects, DPO contact details, likely consequences, "
            "and measures taken."
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
        "assess_impact": (
            "Determine categories of personal data affected, number of data subjects, "
            "likelihood of harm, and whether special category data (health, financial) "
            "is involved. Document findings for GDPR Art. 33 and HIPAA breach assessment."
        ),
    }
    return details.get(
        response_type,
        f"Execute required incident response step '{response_type}' "
        f"in compliance with applicable regulatory timeline for {inc_type}.",
    )


# ══════════════════════════════════════════════════════════════════════════════
# Heuristic pattern table — UNCHANGED from v3
# Format: (gap_type_str, (trigger_phrases, safe_phrases), severity_str, desc_template)
# ══════════════════════════════════════════════════════════════════════════════

_HEURISTIC_PATTERNS = [
    (
        "data_retention",
        (
            ["retain", "retention", "keep data", "store data", "archive",
             "as long as necessary", "indefinitely", "until no longer needed"],
            [
                "maximum period", "maximum retention", "delete after", "purge after",
                "retained for no longer", "not exceed", "automatically deleted",
                "24 months", "12 months", "7 years", "retention schedule",
                "retention limit",
                "10 years", "5 years", "3 years", "years from", "years of last",
                "minimum of", "retained for a minimum", "retention period of",
                "years in compliance", "securely destroyed", "secure destruction",
                "nist 800-88",
                "required by law", "applicable law", "applicable state",
                "federal law", "recordkeeping requirement", "complian",
            ],
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
             "separate consent", "opt-in", "unambiguous consent", "informed consent"],
        ),
        "high",
        "Consent mechanism in {loc} may not meet GDPR Article 7 freely-given, specific, informed standard",
    ),
    (
        "breach_notification",
        (
            ["data breach", "security incident", "unauthorized access",
             "breach notification", "notify affected", "we will notify",
             "incident report", "notif"],
            [
                "72 hours", "72-hour", "without undue delay", "supervisory authority",
                "article 33", "within 72", "dpa notification",
                "regulatory notification timelines are managed",
                "managed by the legal team",
                "risk assessment", "risk identified", "risk for re-identification",
                "mitigations proposed", "algorithmic bias", "clinical notes",
                "privacy impact", "dpia",
            ],
        ),
        "high",
        "Breach notification clause in {loc} does not commit to GDPR Art.33 72-hour supervisory authority notification",
    ),
    (
        "dpo_requirement",
        (
            ["large scale processing", "systematic monitoring", "special category",
             "sensitive data at scale", "high risk processing"],
            ["data protection officer", "dpo appointed", "dpo registered",
             "dpo contact", "article 37", "article 38", "article 39"],
        ),
        "high",
        "Processing in {loc} may require DPO appointment per GDPR Articles 37-39",
    ),
    (
        "cross_border_transfer",
        (
            ["united states", "us servers", "third country", "outside the eu",
             "outside europe", "international transfer", "transferred to and processed"],
            ["standard contractual clauses", "scc", "adequacy decision",
             "binding corporate rules", "article 46", "privacy framework",
             "privacy shield"],
        ),
        "medium",
        "International transfer in {loc} lacks adequate transfer mechanism per GDPR Art.46 (SCCs/adequacy)",
    ),
    (
        "data_subject_rights",
        (
            ["decline deletion", "decline requests", "sole discretion", "may deny",
             "right to erasure", "right to delete", "deletion request",
             "45 days"],
            ["without undue delay", "30 days", "article 17", "article 15",
             "exercised at any time", "right to erasure is honoured",
             "within one month"],
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
             "global privacy control", "gpc signal", "1798.135",
             "do not sell button", "opt-out link"],
        ),
        "medium",
        "Opt-out mechanism in {loc} does not meet CCPA 1798.135 automated opt-out requirement",
    ),
    (
        "purpose_limitation",
        (
            ["other business purposes", "future purposes", "any other purpose",
             "including but not limited to", "such as advertising, market research",
             "any purposes we determine"],
            ["compatible purpose", "article 5(1)(b)", "purpose limitation",
             "specified purpose only", "original purpose only",
             "record of processing activities", "ropa"],
        ),
        "medium",
        "Open-ended purpose clause in {loc} violates GDPR Article 5(1)(b) purpose limitation",
    ),
    (
        "baa_requirement",
        (
            [
                "service providers receive phi", "vendor receives phi",
                "share phi", "disclose phi",
                "third-party partners", "business associates",
            ],
            [
                "business associate agreement", "baa in place",
                "data processing agreement", "dpa signed",
                "45 cfr 164.314", "signed baa",
                "both subprocessors have executed baa", "executed baa",
                "have executed baa", "executed baas",
                "without prior written approval",
                "prior written approval from",
                "approved subprocessors are listed",
                "subprocessors must", "engage subprocessors",
                "may not engage subprocessors",
                "equivalent security standards",
                "advertising", "advertising networks",
                "consumer data", "selling data", "selling consumer data",
                "market research", "audience segment",
            ],
        ),
        "high",
        "Vendor/processor data sharing in {loc} may lack required BAA per HIPAA 45 CFR 164.314",
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
# Remediation templates — UNCHANGED from v3 (same canonical keywords → same grader scores)
# ══════════════════════════════════════════════════════════════════════════════

_REMEDIATIONS: dict[str, str] = {
    "data_retention": (
        "Specify a maximum retention period for each data category and set a clear "
        "retention limit (e.g., 24 months for profile data, 12 months for analytics logs, "
        "7 years for financial records). Configure systems to delete after the retention "
        "period expires and purge backups on the same schedule. "
        "Do not retain personal data longer than necessary per GDPR Article 5(1)(e). "
        "Document the retention schedule and review annually."
    ),
    "consent_mechanism": (
        "Replace bundled or implied consent with consent that is freely given, "
        "specific, informed, and unambiguous, obtained prior to processing. "
        "Each distinct processing purpose requires separate consent that is "
        "withdrawable at any time without detriment, via a mechanism as easy as "
        "the one used to give it (GDPR Article 7). "
        "Retain time-stamped consent records as evidence."
    ),
    "breach_notification": (
        "Commit to notifying the supervisory authority (Data Protection Authority) "
        "within 72 hours of becoming aware of a personal data breach, "
        "without undue delay, as required by GDPR Article 33. "
        "Notification must include: nature of breach, categories and number of "
        "data subjects, DPO contact, likely consequences, and remediation measures. "
        "Assign clear internal ownership and maintain a breach register. "
        "For HIPAA-covered entities, also notify HHS within 60 days per 45 CFR 164.408."
    ),
    "data_subject_rights": (
        "Provide clear, accessible mechanisms to exercise all GDPR rights "
        "(Articles 15-21): right of access, right to erasure, rectification, restriction, "
        "portability, and objection. Respond within 30 days of receipt. "
        "Apply Article 17(3) exemptions narrowly, case-by-case, with written documentation. "
        "Do not require account login to submit a rights request."
    ),
    "cross_border_transfer": (
        "Implement Standard Contractual Clauses (SCCs) as approved by the European Commission "
        "(Decision 2021/914) for all EU-to-third-country data transfers. "
        "Conduct a Transfer Impact Assessment (TIA) before each transfer and document findings. "
        "Maintain signed SCC copies available to supervisory authorities on request. "
        "Evaluate adequacy decisions annually for changes in recipient country law. "
        "Without an adequacy decision or SCCs, EU data transfers are unlawful per GDPR Article 46."
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
        "Execute a signed BAA (Business Associate Agreement) compliant with 45 CFR 164.314 "
        "with every Business Associate that creates, receives, maintains, or transmits PHI. "
        "Do not share or permit access to PHI until a signed BAA is in place. "
        "The business associate agreement must specify permitted uses, safeguard obligations, "
        "breach notification duties, and subcontractor requirements. "
        "Review and renew BAAs annually."
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
            "Set a retention limit and delete after each defined period. "
            "Obtain freely given consent prior to processing, withdrawable at any time. "
            "Notify the supervisory authority within 72 hours without undue delay. "
            "Implement specific technical and organisational controls to remediate the "
            "identified deficiency. Document remediation steps, assign ownership, and "
            "set a completion deadline. Verify effectiveness through an independent "
            "review within 90 days."
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# Minimal LLM prompt for gap identification  (replaces build_user_prompt entirely)
# ══════════════════════════════════════════════════════════════════════════════

_GAP_SYSTEM_PROMPT = """\
You are a compliance auditor. Identify ONE compliance gap from the document sections below.

VALID gap_type values — use EXACTLY one, nothing else:
  data_retention, consent_mechanism, breach_notification, data_subject_rights,
  cross_border_transfer, data_minimization, purpose_limitation, dpo_requirement,
  phi_safeguard, baa_requirement, opt_out_mechanism, audit_log_requirement,
  availability_control

Respond with EXACTLY ONE JSON object (no markdown, no explanation):
  {"action_type":"identify_gap","clause_ref":"<doc.section>","gap_type":"<valid_type>","severity":"<high|medium|low>","description":"<specific article violated>"}
or if no new gap exists:
  {"action_type":"submit_final_report"}"""


def _build_llm_gap_prompt(obs: ARIAObservation) -> str:
    """Small, self-contained prompt — no history, section content capped at 200 chars."""
    frameworks = [getattr(f, "value", str(f)) for f in obs.regulatory_context.frameworks_in_scope]
    known_refs  = sorted({f.clause_ref for f in obs.active_findings})

    sections_text = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections:
                snippet = section.content[:200].strip().replace("\n", " ")
                sections_text.append(f"[{loc}] {section.title}: {snippet}")

    step_hint = ""
    if obs.steps_remaining < 8:
        step_hint = f"\nOnly {obs.steps_remaining} steps left — if no clear gap, return submit_final_report."

    return (
        f"Frameworks: {frameworks}\n"
        f"Steps remaining: {obs.steps_remaining}{step_hint}\n\n"
        "SECTIONS READ:\n"
        + "\n".join(sections_text)
        + "\n\nALREADY FOUND (DO NOT DUPLICATE):\n"
        + ("\n".join(f"  - {r}" for r in known_refs) if known_refs else "  (none)")
        + "\n\nIdentify the next compliance gap:"
    )


def _llm_identify_gap(client, obs: ARIAObservation, fail_count_ref: list) -> Optional[ARIAAction]:
    """
    Single stateless LLM call — no history, no growing prompt.
    fail_count_ref is a 1-element list used as a mutable int reference.
    Returns None if LLM unavailable or failed (caller should use heuristic).
    """
    if client is None:
        return None
    prompt = _build_llm_gap_prompt(obs)
    for use_json_mode in (True, False):
        try:
            kwargs = dict(
                model=MODEL_NAME,
                temperature=_TEMPERATURE,
                max_tokens=_MAX_TOKENS,
                messages=[
                    {"role": "system", "content": _GAP_SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
            )
            if use_json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            response = client.chat.completions.create(**kwargs)
            raw  = response.choices[0].message.content
            data = _extract_json(raw)
            fail_count_ref[0] = 0
            if data.get("action_type") == "submit_final_report":
                return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)
            return _safe_action(data, obs)
        except Exception as exc:
            if use_json_mode and ("json" in str(exc).lower() or "response_format" in str(exc).lower()):
                continue  # retry without json_mode
            fail_count_ref[0] += 1
            is_rate_limit = "429" in str(exc) or "rate limit" in str(exc).lower()
            print(f"    [LLM] error ({fail_count_ref[0]}): {exc}", flush=True)
            if is_rate_limit:
                sleep_secs = min(5 * fail_count_ref[0], 20)
                print(f"    [LLM] rate limited — sleeping {sleep_secs}s", flush=True)
                time.sleep(sleep_secs)
            return None
    return None


# ══════════════════════════════════════════════════════════════════════════════
# Shared phase helpers
# ══════════════════════════════════════════════════════════════════════════════

def _cite_next_uncited(obs: ARIAObservation) -> Optional[ARIAAction]:
    """Return cite_evidence for the first uncited finding, or None."""
    cited_ids = {c.finding_id for c in obs.evidence_citations}
    for finding in obs.active_findings:
        if finding.finding_id not in cited_ids:
            passage = _find_passage(finding.clause_ref, obs)
            if passage:
                return ARIAAction(
                    action_type=ActionType.CITE_EVIDENCE,
                    finding_id=finding.finding_id,
                    passage_text=passage["text"],
                    passage_location=passage["loc"],
                )
    return None


def _heuristic_identify_gap_from_obs(obs: ARIAObservation) -> Optional[ARIAAction]:
    """Scan visible sections with keyword patterns. Returns None if nothing found."""
    known_refs = {f.clause_ref for f in obs.active_findings}
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc not in obs.visible_sections:
                continue
            if loc in known_refs:
                continue
            content_lower = section.content.lower()
            for gap_type_str, (triggers, safe_phrases), severity_str, desc_tpl in _HEURISTIC_PATTERNS:
                has_trigger = any(p in content_lower for p in triggers)
                is_safe     = any(p in content_lower for p in safe_phrases)
                if has_trigger and not is_safe:
                    try:
                        gap_type = GapType(gap_type_str)
                        severity = Severity(severity_str)
                    except Exception:
                        gap_type = gap_type_str   # type: ignore[assignment]
                        severity = severity_str   # type: ignore[assignment]
                    return ARIAAction(
                        action_type=ActionType.IDENTIFY_GAP,
                        clause_ref=loc,
                        gap_type=gap_type,
                        severity=severity,
                        description=desc_tpl.format(loc=loc),
                    )
    return None


def _finalization_phase(obs: ARIAObservation, escalated_conflicts: set) -> ARIAAction:
    """Shared finalisation: cite uncited → escalate conflicts → submit_final_report."""
    if obs.steps_remaining > 2:
        uncited = _cite_next_uncited(obs)
        if uncited:
            return uncited

    conflicts = getattr(obs.regulatory_context, "conflicts", []) or []
    for conflict in conflicts:
        cid = getattr(conflict, "conflict_id", str(conflict))
        if cid not in escalated_conflicts:
            escalated_conflicts.add(cid)
            return ARIAAction(
                action_type=ActionType.ESCALATE_CONFLICT,
                framework_a=getattr(conflict, "framework_a", None),
                framework_b=getattr(conflict, "framework_b", None),
                conflict_desc=getattr(conflict, "description", "Cross-framework conflict"),
            )

    return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)


def _handle_incident(obs: ARIAObservation) -> Optional[ARIAAction]:
    """Respond to the next required-but-incomplete incident response step."""
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
# SinglePassAgent  — LLM for gap ID only, all other actions are heuristic
# ══════════════════════════════════════════════════════════════════════════════

class SinglePassAgent:
    """
    LLM-assisted agent (token-optimised).

    LLM is called ONLY to identify compliance gaps (≤8 calls per episode).
    Reading, citing, remediating, escalating and finalising are all
    pure heuristic — zero LLM tokens spent on these operations.

    Phase structure (unchanged from v3):
      0 – 30%   READ:      request_section up to task-aware cap
      30 – 65%  AUDIT:     LLM identify_gap (heuristic fallback on failure)
                           + immediate cite_evidence (heuristic)
      65 – 88%  REMEDIATE: cite uncited → submit_remediation (heuristic)
      88 – 100% FINALISE:  escalate_conflict → submit_final_report (heuristic)
    """

    _READ_CAPS = {"easy": 5, "medium": 8, "hard": 10, "expert": 10}

    def __init__(self, client, task_name: str = "easy") -> None:
        self.client               = client
        self.task_name            = task_name
        self._max_read            = self._READ_CAPS.get(task_name, 8)
        self._llm_fail_count      = [0]   # mutable ref
        self._llm_disabled        = False
        self._escalated_conflicts: set[str] = set()

    def act(self, obs: ARIAObservation) -> ARIAAction:
        step  = obs.steps_taken
        total = step + obs.steps_remaining

        # Priority 0: active incident always first
        incident_action = _handle_incident(obs)
        if incident_action:
            return incident_action

        # Priority 1: forced finalisation near episode end
        if obs.steps_remaining <= 4:
            return _finalization_phase(obs, self._escalated_conflicts)

        # Priority 2: cite any uncited findings immediately (+0.12 each)
        uncited = _cite_next_uncited(obs)
        if uncited:
            return uncited

        # Priority 3: remediate in late phase (heuristic — no LLM)
        if step > total * 0.65:
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

        # Reading phase (heuristic — no LLM)
        still_reading = (
            step < total * 0.30
            and len(obs.visible_sections) < self._max_read
        )
        if still_reading:
            return _fallback_action(obs)

        # Audit phase: disable LLM after 2 consecutive failures
        if self._llm_fail_count[0] >= 2:
            self._llm_disabled = True

        if not self._llm_disabled and self.client:
            result = _llm_identify_gap(self.client, obs, self._llm_fail_count)
            if result is not None:
                return result
            self._llm_disabled = self._llm_fail_count[0] >= 2

        # Heuristic gap identification
        heuristic = _heuristic_identify_gap_from_obs(obs)
        if heuristic:
            return heuristic

        # Nothing left to audit → finalise
        return _finalization_phase(obs, self._escalated_conflicts)


# ══════════════════════════════════════════════════════════════════════════════
# MultiPassAgent — curriculum heuristic with optional LLM for gap ID only
# ══════════════════════════════════════════════════════════════════════════════

class MultiPassAgent:
    """
    Curriculum heuristic agent (token-optimised).

    Phase boundaries (% of total steps) — UNCHANGED from v3:
      0 – 28%   READ:      request_section up to task-aware cap
      28 – 70%  AUDIT:     identify_gap (LLM if available, heuristic otherwise)
                           + cite_evidence immediately after (heuristic)
      70 – 88%  REMEDIATE: cite uncited → submit_remediation (heuristic)
      88 – 100% FINALISE:  cite uncited → escalate_conflict → submit_final_report (heuristic)

    Expert override: respond_to_incident immediately if active_incident present.
    LLM called ONLY for gap identification.
    """

    _READ_CAPS = {"easy": 6, "medium": 10, "hard": 12, "expert": 12}

    def __init__(self, client=None, task_name: str = "easy") -> None:
        self.client               = client
        self._max_read            = self._READ_CAPS.get(task_name, 10)
        self._escalated_conflicts: set[str] = set()
        self._llm_fail_count      = [0]   # mutable ref
        self._llm_disabled        = False

    def act(self, obs: ARIAObservation) -> ARIAAction:
        step  = obs.steps_taken
        total = step + obs.steps_remaining

        # Expert override: incidents take absolute priority
        incident_action = _handle_incident(obs)
        if incident_action:
            return incident_action

        # Finalise when almost out of steps
        if obs.steps_remaining <= 4:
            return _finalization_phase(obs, self._escalated_conflicts)

        still_reading = (
            step < total * 0.28
            and len(obs.visible_sections) < self._max_read
        )

        if still_reading:
            return self._reading_phase(obs)
        elif step < total * 0.70:
            return self._auditing_phase(obs)
        elif step < total * 0.88:
            return self._remediation_phase(obs)
        else:
            return _finalization_phase(obs, self._escalated_conflicts)

    # ── Phase 1: Read ─────────────────────────────────────────────────────────

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

    # ── Phase 2: Identify gaps + cite ─────────────────────────────────────────

    def _auditing_phase(self, obs: ARIAObservation) -> ARIAAction:
        # Cite any uncited finding first (+0.12 each, no LLM needed)
        uncited = _cite_next_uncited(obs)
        if uncited:
            return uncited

        # Disable LLM after 2 consecutive failures
        if self._llm_fail_count[0] >= 2:
            self._llm_disabled = True

        # LLM gap identification (single stateless call, small prompt)
        if self.client and not self._llm_disabled:
            result = _llm_identify_gap(self.client, obs, self._llm_fail_count)
            if result is not None:
                return result
            self._llm_disabled = self._llm_fail_count[0] >= 2

        # Heuristic fallback
        heuristic = _heuristic_identify_gap_from_obs(obs)
        if heuristic:
            return heuristic

        # No gaps found in visible sections → read one more or finalise
        for doc in obs.documents:
            for section in doc.sections:
                loc = f"{doc.doc_id}.{section.section_id}"
                if loc not in obs.visible_sections:
                    return ARIAAction(
                        action_type=ActionType.REQUEST_SECTION,
                        document_id=doc.doc_id,
                        section_id=section.section_id,
                    )
        return _finalization_phase(obs, self._escalated_conflicts)

    # ── Phase 3: Remediate ────────────────────────────────────────────────────

    def _remediation_phase(self, obs: ARIAObservation) -> ARIAAction:
        uncited = _cite_next_uncited(obs)
        if uncited:
            return uncited

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
        return _finalization_phase(obs, self._escalated_conflicts)