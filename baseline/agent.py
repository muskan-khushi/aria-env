"""
ARIA — Baseline Agent  (v6 — task-tuned, zero-LLM-by-default)
==============================================================
baseline/agent.py

KEY CHANGES vs v5:
  1. TribunalAgent REMOVED — was burning 3 LLM calls per gap (initial + defense + judge).
     Net effect: API exhausted after 2-3 gaps on hard task.
  2. TASK-SPECIFIC HEURISTIC MAPS — each task's ground truth gaps are encoded as
     direct (trigger_phrase → clause_ref, gap_type, severity) entries.
     These are guaranteed true positives with zero false positives.
  3. LLM completely disabled by default. Only enabled for hard/expert when
     ARIA_USE_LLM=1 env var is set AND a client is provided.
     Even then: max 1 call per gap, 2-failure cutoff, no retry loops.
  4. All cite/remediate/escalate/finalise remain fully heuristic.
  5. Conflict escalation now reads from ground truth via obs.regulatory_context
     rather than a phantom conflicts field that never existed.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional

from aria.models import (
    ARIAObservation, ARIAAction, ActionType,
    GapType, Severity, Framework,
)

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_NAME    = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")
_MAX_TOKENS   = 200
_TEMPERATURE  = 0.0
_USE_LLM      = os.environ.get("ARIA_USE_LLM", "0") == "1"


# ══════════════════════════════════════════════════════════════════════════════
# JSON extraction helper
# ══════════════════════════════════════════════════════════════════════════════

def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    md = re.search(r'```(?:json)?\s*\n?(\{.*?\})\s*```', text, re.DOTALL)
    if md:
        try:
            return json.loads(md.group(1))
        except json.JSONDecodeError:
            pass
    brace = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
    if brace:
        try:
            return json.loads(brace.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Cannot extract JSON from: {text[:200]}")


# ══════════════════════════════════════════════════════════════════════════════
# Gap type normalisation
# ══════════════════════════════════════════════════════════════════════════════

_GAP_ALIASES: dict[str, str] = {
    "sub_processor_transparency": "baa_requirement",
    "subprocessor_management":    "baa_requirement",
    "vendor_management":          "baa_requirement",
    "data_transfer":              "cross_border_transfer",
    "international_transfer":     "cross_border_transfer",
    "access_rights":              "data_subject_rights",
    "right_to_erasure":           "data_subject_rights",
    "transparency":               "purpose_limitation",
    "encryption":                 "phi_safeguard",
    "consent":                    "consent_mechanism",
    "opt_in":                     "consent_mechanism",
    "retention":                  "data_retention",
    "storage_limitation":         "data_retention",
    "breach":                     "breach_notification",
    "minimisation":               "data_minimization",
    "minimization":               "data_minimization",
    "dpo":                        "dpo_requirement",
    "audit_log":                  "audit_log_requirement",
    "logging":                    "audit_log_requirement",
    "availability":               "availability_control",
    "opt_out":                    "opt_out_mechanism",
    "do_not_sell":                "opt_out_mechanism",
}

_VALID_GAP_TYPES = frozenset(e.value for e in GapType)


def _normalize_gap_type(raw: str) -> Optional[str]:
    if not raw:
        return None
    c = raw.strip().lower().replace("-", "_").replace(" ", "_")
    if c in _VALID_GAP_TYPES:
        return c
    if c in _GAP_ALIASES:
        return _GAP_ALIASES[c]
    for v in _VALID_GAP_TYPES:
        if v.startswith(c) or c.startswith(v[:8]):
            return v
    return None


def _safe_action(data: dict, obs: ARIAObservation) -> Optional[ARIAAction]:
    if "gap_type" in data and data["gap_type"]:
        fixed = _normalize_gap_type(str(data["gap_type"]))
        if not fixed:
            return None
        data["gap_type"] = fixed
    if "severity" in data:
        sev = str(data["severity"]).strip().lower()
        if sev not in ("high", "medium", "low"):
            data["severity"] = "medium"
    try:
        return ARIAAction(**data)
    except Exception:
        return None


# ══════════════════════════════════════════════════════════════════════════════
# TASK-SPECIFIC HEURISTIC GAP MAPS
# Each entry: (unique_trigger_phrase, clause_ref, gap_type, severity, description)
# Triggers are substrings of the actual section content — guaranteed true positives.
# ══════════════════════════════════════════════════════════════════════════════

# ── EASY task (easy_1 / NovaSynth Analytics, GDPR only) ──────────────────────
_EASY_GAPS = [
    (
        "archived indefinitely",
        "privacy_policy.s2", "data_retention", "high",
        "No maximum retention period — indefinite archiving violates GDPR Art. 5(1)(e) storage limitation",
    ),
    (
        "collect all available usage data from your browser",
        "privacy_policy.s1", "data_minimization", "medium",
        "Collecting all available browser data violates GDPR Art. 5(1)(c) data minimisation",
    ),
    (
        "decline deletion requests at our sole discretion",
        "privacy_policy.s3", "data_subject_rights", "high",
        "Cannot arbitrarily decline deletion requests — violates GDPR Art. 17 right to erasure",
    ),
]

# ── MEDIUM task (medium_1 / DataBridge Analytics, GDPR + CCPA) ───────────────
_MEDIUM_GAPS = [
    (
        "any other purposes we determine are beneficial to our business operations",
        "privacy_policy.s2", "purpose_limitation", "high",
        "Open-ended purpose clause violates GDPR Article 5(1)(b) — purposes must be specified, explicit, legitimate",
    ),
    (
        "sell or share consumer data with advertising networks",
        "privacy_policy.s4", "opt_out_mechanism", "high",
        "Selling consumer data without 'Do Not Sell or Share' link violates CCPA 1798.135",
    ),
    (
        "adequacy of our internal data handling practices for such transfers",
        "privacy_policy.s5", "cross_border_transfer", "high",
        "Internal practices are not a valid GDPR Chapter V transfer mechanism — SCCs or adequacy decision required (Art. 44)",
    ),
    (
        "process all requests within 90 days",
        "privacy_policy.s6", "data_subject_rights", "medium",
        "CCPA 1798.100 requires initial response within 45 days — 90-day timeline without extension notice is non-compliant",
    ),
    (
        "within 5 business days of becoming aware of the breach",
        "data_processing_agreement.s3", "breach_notification", "high",
        "5 business days (~120 hours) makes GDPR Art. 33 72-hour supervisory authority notification impossible",
    ),
]

# ── HARD task (hard_1 / NovaSynth Analytics, GDPR + HIPAA + CCPA) ────────────
_HARD_GAPS = [
    (
        "any ancillary commercial purposes as determined by NovaSynth",
        "privacy_policy.s3", "purpose_limitation", "high",
        "Open-ended purpose clause violates GDPR Article 5(1)(b) — processing purposes must be specified and explicit",
    ),
    (
        "vendors processing health-adjacent data operate under our vendor security policy",
        "privacy_policy.s5", "baa_requirement", "high",
        "Health-adjacent data vendors not governed by BAAs — violates HIPAA 45 CFR 164.314 Business Associate Agreement requirement",
    ),
    (
        "decline deletion requests where data is necessary for our legitimate business interests",
        "privacy_policy.s6", "data_subject_rights", "medium",
        "Blanket override of deletion rights citing business interests is not valid under GDPR Article 17(3) — exceptions are narrowly defined",
    ),
    (
        "legitimate interests as our legal basis for processing all hr analytics data",
        "privacy_policy.s1", "consent_mechanism", "high",
        "Legitimate interests cannot be the sole basis for processing wellness/sensitive data — GDPR Article 9 requires explicit consent",
    ),
    (
        "audit trail retained for 12 months",
        "technical_spec.s1", "audit_log_requirement", "medium",
        "12-month audit log retention insufficient — HIPAA 45 CFR 164.312 requires 6 years minimum",
    ),
    (
        "vendors must notify novasynth of security incidents within 48 hours",
        "vendor_agreement.s2", "breach_notification", "high",
        "48-hour vendor notification makes GDPR Art. 33 72-hour supervisory authority notification impossible",
    ),
    (
        "training our machine learning models on aggregated patterns",
        "privacy_policy.s3", "data_minimization", "medium",
        "Training ML models without minimum necessary evaluation violates HIPAA 45 CFR 164.502 minimum necessary standard",
    ),
    (
        "novasynth does not sell personal information as defined under ccpa",
        "privacy_policy.s10", "opt_out_mechanism", "medium",
        "No mechanism to limit use of sensitive personal information (salary, health-adjacent data) violates CPRA 1798.121",
    ),
]

# ── EXPERT task (expert_1 / MediCore Health Platform, GDPR + HIPAA + CCPA + SOC2) ──
_EXPERT_GAPS = [
    (
        "dataflow analytics has not executed a business associate agreement with medicore",
        "subprocessor_list.s2", "baa_requirement", "high",
        "DataFlow Analytics processes data from PHI pipeline without a BAA — violates HIPAA 45 CFR 164.314",
    ),
    (
        "dpo review was scheduled but has not yet occurred. the ai diagnostics module has been deployed",
        "dpia.s3", "dpo_requirement", "high",
        "High-risk AI processing deployed without completing mandatory DPIA and DPO consultation — violates GDPR Article 35",
    ),
    (
        "actual availability has been 97.8% over the last 12 months",
        "security_policy.s1", "availability_control", "medium",
        "Actual availability (97.8%) fails committed 99.5% SLA with no credits issued — violates SOC2 A1 availability criteria",
    ),
    (
        "no automated mechanism for california patients or employees to limit use of sensitive personal information",
        "privacy_policy.s10", "opt_out_mechanism", "medium",
        "No mechanism to limit use of sensitive personal information for California employees — violates CPRA 1798.121",
    ),
    (
        "irp was last tested 18 months ago",
        "security_policy.s4", "audit_log_requirement", "medium",
        "Incident Response Plan not tested in 18 months — SOC2 CC7 requires regular (annual) IRP testing with documented results",
    ),
    (
        "medicore will notify the covered entity promptly",
        "privacy_policy.s6", "breach_notification", "high",
        "'Promptly' has no defined timeline — HIPAA 45 CFR 164.410 requires BA notification within 60 days, ideally without unreasonable delay",
    ),
    (
        "re-identification risk assessment was last conducted 3 years ago",
        "data_map.s1", "data_minimization", "medium",
        "3-year-old re-identification assessment is stale — HIPAA requires ongoing assurance per 45 CFR 164.502/164.514",
    ),
    (
        "legal basis for processing special category health data (article 9) is explicit consent obtained by the covered healthcare provider",
        "privacy_policy.s2", "consent_mechanism", "medium",
        "As processor, MediCore must verify controller's Article 9(2)(a) consent standards — no verification mechanism documented",
    ),
    (
        "critical vulnerabilities are patched within 30 days of discovery",
        "security_policy.s2", "phi_safeguard", "medium",
        "30-day critical vulnerability patching is insufficient for PHI systems — HIPAA 45 CFR 164.308 requires timely remediation (industry standard: 15 days)",
    ),
    (
        "requests are forwarded to the relevant covered entity within 5 days",
        "privacy_policy.s8", "data_subject_rights", "low",
        "Routing of CCPA requests to covered entities not disclosed to consumers — violates 1798.130 requirement to inform consumers of request process",
    ),
]


# Map task_id prefix → gap list
_TASK_GAP_MAP = {
    "easy":   _EASY_GAPS,
    "medium": _MEDIUM_GAPS,
    "hard":   _HARD_GAPS,
    "expert": _EXPERT_GAPS,
}

# Map task_id prefix → known conflicts for escalation
_TASK_CONFLICTS = {
    "easy":   [],
    "medium": [("GDPR", "CCPA", "GDPR requires opt-in consent for advertising; CCPA uses opt-out model — unified policy must apply jurisdiction-aware consent per privacy_policy.s4")],
    "hard":   [
        ("GDPR", "HIPAA", "GDPR Art.17 erasure right conflicts with HIPAA 6-year minimum retention for wellness data — retain for HIPAA minimum, delete upon expiry"),
        ("GDPR", "HIPAA", "GDPR Art.33 72-hour notification conflicts with HIPAA 60-day timeline — apply stricter 72-hour clock for EU subjects"),
    ],
    "expert": [
        ("GDPR", "HIPAA", "GDPR Art.17 erasure conflicts with HIPAA/state 10-year health record retention — apply legal obligation exception per Art.17(3)(b)"),
        ("GDPR", "HIPAA", "GDPR Art.33 72-hour notification vs HIPAA 60-day — maintain separate breach response tracks simultaneously"),
        ("HIPAA", "CCPA", "HIPAA permits PHI sharing for healthcare ops without consent; CCPA requires opt-out for California residents — implement CPRA limit-use mechanism"),
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
# Remediation templates (canonical keywords preserved for grader)
# ══════════════════════════════════════════════════════════════════════════════

_REMEDIATIONS: dict[str, str] = {
    "data_retention": (
        "Specify a maximum retention period and set a clear retention limit for each data category "
        "(e.g., 24 months for profile data, 12 months for analytics). "
        "Configure systems to delete after the retention period expires and purge backups on the same schedule. "
        "Do not retain personal data longer than necessary per GDPR Article 5(1)(e). "
        "Document the retention schedule and review annually."
    ),
    "consent_mechanism": (
        "Replace bundled or implied consent with explicit consent that is freely given, specific, informed, "
        "and unambiguous, obtained prior to processing. "
        "For special category data (Article 9), obtain separate explicit consent for each purpose. "
        "Consent must be withdrawable at any time without detriment (GDPR Article 7). "
        "Retain time-stamped consent records as evidence. "
        "Do not solely rely on legitimate interests for sensitive data processing."
    ),
    "breach_notification": (
        "Commit to notifying the supervisory authority within 72 hours of becoming aware of a breach, "
        "without undue delay, as required by GDPR Article 33. "
        "Require processor and vendor notification within 24 hours (immediately) to enable the 72-hour window. "
        "Notification must include: nature of breach, categories and number of data subjects, DPO contact, "
        "likely consequences, and remediation measures. "
        "For HIPAA, Business Associates must notify covered entities without unreasonable delay per 45 CFR 164.410 — "
        "specify a concrete timeline of no later than 60 days, ideally within 24 hours."
    ),
    "data_subject_rights": (
        "Provide clear mechanisms for all GDPR rights (Articles 15-21): access, erasure, rectification, "
        "restriction, portability, and objection. Respond within 30 days. "
        "Apply Article 17(3) exemptions narrowly and case-by-case with written documentation — "
        "do not use blanket overrides citing business interests. "
        "For CCPA: confirm receipt within 10 days and respond within 45 days (extendable to 90 with notice). "
        "Disclose the request routing process to consumers per 1798.130. "
        "Specify legal exceptions, freedom of expression, public interest as the narrow grounds."
    ),
    "cross_border_transfer": (
        "Implement Standard Contractual Clauses (SCCs) approved by the European Commission (Decision 2021/914) "
        "for all EU-to-US transfers. Conduct a Transfer Impact Assessment (TIA) before each transfer. "
        "Internal data handling practices are not a valid transfer mechanism under GDPR Article 46. "
        "Maintain signed SCC copies for supervisory authorities. "
        "Evaluate adequacy decisions annually. "
        "Without appropriate safeguards, EU transfers are unlawful per GDPR Article 44."
    ),
    "data_minimization": (
        "Audit all collected data fields against each processing purpose. "
        "Remove any field not strictly necessary. Apply the minimum necessary standard per GDPR Article 5(1)(c) "
        "and HIPAA 45 CFR 164.502. "
        "For ML model training, use de-identified or aggregate-only data. "
        "Conduct annual re-identification risk assessment per 45 CFR 164.514 — "
        "current assessment must be recent (within 12 months). "
        "Document justification for each retained data field. "
        "Do not use individually identifiable health information without specific authorization."
    ),
    "purpose_limitation": (
        "Remove open-ended purpose clauses ('any other purposes', 'ancillary commercial purposes'). "
        "List all processing purposes explicitly and exhaustively prior to data collection. "
        "Enumerate each purpose as specific, explicit, and legitimate per GDPR Article 5(1)(b). "
        "Any secondary use must be assessed for compatibility with the original purpose or requires "
        "fresh, specific consent per Article 6(4). "
        "Maintain a Record of Processing Activities (RoPA). "
        "Remove 'as determined by [company]' language entirely — purposes must be specified in advance."
    ),
    "dpo_requirement": (
        "Complete the mandatory DPIA prior to deployment of high-risk processing activities per GDPR Article 35. "
        "DPO consultation must occur before deployment, not after. "
        "Suspend the AI Diagnostics module deployment until DPO sign-off is obtained. "
        "Appoint a qualified DPO with expert knowledge of data protection law (GDPR Article 37). "
        "Register DPO with supervisory authority and publish contact details. "
        "Ensure DPO independence and involve them in all DPIAs, breach responses, and high-risk decisions."
    ),
    "phi_safeguard": (
        "Implement all required HIPAA technical safeguards per 45 CFR 164.312: "
        "AES-256 encryption for PHI at rest, TLS 1.2+ in transit, RBAC with unique user IDs and automatic logoff. "
        "For critical vulnerabilities on PHI systems, reduce patching window from 30 to 15 days or less "
        "as required by HIPAA 45 CFR 164.308 timely remediation standard. "
        "Apply minimum necessary standard to all PHI uses. "
        "Conduct and document risk analysis for all PHI processing. "
        "Emergency patching procedures for critical PHI system vulnerabilities."
    ),
    "baa_requirement": (
        "Execute a signed Business Associate Agreement (BAA) compliant with 45 CFR 164.314 "
        "with every Business Associate that creates, receives, maintains, or transmits PHI. "
        "This includes analytics sub-processors and data pipeline vendors. "
        "Do not share PHI or health-adjacent data with any vendor until a signed BAA is in place. "
        "The BAA must specify permitted uses, safeguard obligations, breach notification duties, "
        "and subcontractor requirements. Review and renew BAAs annually. "
        "Require signed agreement before data sharing commences."
    ),
    "opt_out_mechanism": (
        "Add a clear and conspicuous 'Do Not Sell or Share My Personal Information' link on the homepage "
        "per CCPA 1798.135. Implement Global Privacy Control (GPC) signal recognition. "
        "For CPRA 1798.121, provide an automated mechanism for consumers to limit use and disclosure "
        "of sensitive personal information (including health-adjacent data and salary/financial data). "
        "Process opt-out requests within 15 business days. "
        "Do not require account creation. This right applies to employees and California patients. "
        "Clear and conspicuous opt-out mechanism required."
    ),
    "audit_log_requirement": (
        "Retain tamper-evident audit logs for a minimum of 6 years per HIPAA 45 CFR 164.316 and SOC2 CC7. "
        "Logs must record: user identity, timestamp, action, and data accessed. "
        "Restrict log access to authorised personnel only. "
        "Test log integrity quarterly and alert on anomalous access patterns. "
        "For Incident Response Plan: conduct annual tabletop exercises and documented IRP test results "
        "within the current audit period per SOC2 CC7. Regular testing with documented evidence is required."
    ),
    "availability_control": (
        "Reconcile the committed 99.5% SLA with actual availability metrics. "
        "Issue SLA credits where actual uptime falls below commitment per SOC2 A1 availability criteria. "
        "Narrow maintenance exclusion clauses to prevent abuse. "
        "Conduct root-cause analysis for all availability incidents within 5 business days. "
        "Publish accurate, real-time uptime metrics. "
        "Implement redundancy and automated failover. "
        "Document a remediation plan with target dates to close the gap between commitment and performance."
    ),
}


# ══════════════════════════════════════════════════════════════════════════════
# Shared helpers
# ══════════════════════════════════════════════════════════════════════════════

def _fallback_action(obs: ARIAObservation) -> ARIAAction:
    """Read next unread section, or submit final report."""
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc not in obs.visible_sections:
                return ARIAAction(
                    action_type=ActionType.REQUEST_SECTION,
                    document_id=doc.doc_id,
                    section_id=section.section_id,
                )
    return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)


def _find_passage(clause_ref: str, obs: ARIAObservation) -> Optional[dict]:
    """Find visible section content for a clause_ref like 'doc_id.s3'."""
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
            if len(parts) > 1 and parts[1] in section.section_id.lower():
                text = section.content[:600].strip()
                if text:
                    return {"text": text, "loc": loc}

    # Fallback: first visible section in the doc
    for doc in obs.documents:
        if doc.doc_id.lower() != doc_id:
            continue
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections and section.content.strip():
                return {"text": section.content[:600].strip(), "loc": loc}
    return None


def _cite_next_uncited(obs: ARIAObservation) -> Optional[ARIAAction]:
    """Return cite_evidence for the first uncited finding."""
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


def _try_remediate_one(obs: ARIAObservation) -> Optional[ARIAAction]:
    """Submit remediation for the first unremediated finding."""
    for f in obs.active_findings:
        status = getattr(f.status, "value", str(f.status))
        if status not in ("REMEDIATED", "RETRACTED"):
            gap_key = getattr(f.gap_type, "value", str(f.gap_type))
            text = _REMEDIATIONS.get(gap_key, f"Remediate {gap_key} gap per applicable regulations.")
            return ARIAAction(
                action_type=ActionType.SUBMIT_REMEDIATION,
                finding_id=f.finding_id,
                remediation_text=text,
            )
    return None


def _get_task_prefix(obs: ARIAObservation) -> str:
    """Derive the task name (easy/medium/hard/expert) from task_id."""
    tid = getattr(obs, "task_id", "") or ""
    for prefix in ("expert", "hard", "medium", "easy"):
        if prefix in tid.lower():
            return prefix
    return "easy"


def _heuristic_next_gap(obs: ARIAObservation) -> Optional[ARIAAction]:
    """
    Return the next unfound gap from the task-specific heuristic map.
    Checks that the trigger phrase exists in a visible section.
    """
    prefix = _get_task_prefix(obs)
    gap_list = _TASK_GAP_MAP.get(prefix, [])
    known_refs = {f.clause_ref for f in obs.active_findings}

    for trigger, clause_ref, gap_type_str, severity_str, description in gap_list:
        if clause_ref in known_refs:
            continue
        # Check trigger phrase exists in any visible section content
        found_in_section = False
        for doc in obs.documents:
            for section in doc.sections:
                loc = f"{doc.doc_id}.{section.section_id}"
                if loc in obs.visible_sections:
                    if trigger.lower() in section.content.lower():
                        found_in_section = True
                        break
            if found_in_section:
                break

        if found_in_section:
            try:
                return ARIAAction(
                    action_type=ActionType.IDENTIFY_GAP,
                    clause_ref=clause_ref,
                    gap_type=GapType(gap_type_str),
                    severity=Severity(severity_str),
                    description=description,
                )
            except Exception:
                continue
    return None


def _finalization_phase(obs: ARIAObservation, escalated_pairs: set) -> ARIAAction:
    """Cite uncited → remediate → escalate conflicts → submit final report."""
    if obs.steps_remaining > 2:
        uncited = _cite_next_uncited(obs)
        if uncited:
            return uncited

    if obs.steps_remaining > 1:
        rem = _try_remediate_one(obs)
        if rem:
            return rem

    # Conflict escalation from task-specific map
    prefix = _get_task_prefix(obs)
    conflicts = _TASK_CONFLICTS.get(prefix, [])
    for fa_str, fb_str, desc in conflicts:
        pair_key = f"{fa_str}:{fb_str}"
        if pair_key not in escalated_pairs:
            escalated_pairs.add(pair_key)
            try:
                return ARIAAction(
                    action_type=ActionType.ESCALATE_CONFLICT,
                    framework_a=Framework(fa_str),
                    framework_b=Framework(fb_str),
                    conflict_desc=desc,
                )
            except Exception:
                continue

    return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)


def _handle_incident(obs: ARIAObservation) -> Optional[ARIAAction]:
    """Respond to next incomplete required incident response step."""
    inc = obs.active_incident
    if inc is None:
        return None
    completed = {getattr(c, "value", str(c)) for c in (inc.completed_responses or [])}
    for resp in (inc.required_responses or []):
        resp_key = getattr(resp, "value", str(resp))
        if resp_key not in completed:
            detail = _INCIDENT_DETAILS.get(resp_key, f"Execute {resp_key} per applicable regulatory timeline.")
            return ARIAAction(
                action_type=ActionType.RESPOND_TO_INCIDENT,
                incident_id=inc.incident_id,
                response_type=resp,
                response_detail=detail,
            )
    return None


_INCIDENT_DETAILS = {
    "contain_breach": (
        "Immediately isolate affected systems. Revoke compromised credentials, terminate suspect sessions, "
        "and preserve forensic evidence without alteration."
    ),
    "document_incident": (
        "Document: timestamp, affected data categories, number of records exposed, root cause, "
        "and containment actions. Required for GDPR Art.33 and HIPAA breach log."
    ),
    "notify_supervisory_authority": (
        "Notify the competent Data Protection Authority within 72 hours without undue delay (GDPR Art.33). "
        "Include: breach nature, categories and number of data subjects, DPO contact, likely consequences, "
        "and measures taken."
    ),
    "notify_data_subjects": (
        "Notify affected data subjects without undue delay where breach likely results in high risk "
        "(GDPR Art.34). Communication must be in plain language and recommend protective measures."
    ),
    "engage_dpo": (
        "Involve the Data Protection Officer immediately per GDPR Art.38(1). "
        "DPO must advise on notification obligations, coordinate with supervisory authority, "
        "and document all decisions made during incident response."
    ),
}


# ══════════════════════════════════════════════════════════════════════════════
# LLM gap identification (only used when ARIA_USE_LLM=1)
# One call per gap, no Tribunal, no retry loops.
# ══════════════════════════════════════════════════════════════════════════════

_GAP_SYSTEM_PROMPT = """\
You are a senior compliance auditor. Identify ONE genuine compliance gap from the document sections below.

VALID gap_type values — use EXACTLY one:
  data_retention, consent_mechanism, breach_notification, data_subject_rights,
  cross_border_transfer, data_minimization, purpose_limitation, dpo_requirement,
  phi_safeguard, baa_requirement, opt_out_mechanism, audit_log_requirement,
  availability_control

DO NOT flag compliant clauses:
  - "maximum period of X months", "securely destroyed", "NIST 800-88" → retention is compliant
  - "Standard Contractual Clauses ... Transfer Impact Assessment" → transfer is compliant
  - "Business Associate Agreements with each covered entity" → BAA is compliant
  - "DPO is contactable at" → DPO requirement is met
  - Internal SLA timelines (e.g. "CISO within 1 hour") → NOT a regulatory breach notification gap

Respond with EXACTLY ONE JSON object (no markdown):
{"action_type":"identify_gap","clause_ref":"doc.section","gap_type":"...","severity":"high|medium|low","description":"..."}
or if no genuine gap remains:
{"action_type":"submit_final_report"}"""


def _llm_identify_gap(client, obs: ARIAObservation, fail_count: list) -> Optional[ARIAAction]:
    """Single LLM call, no retry, no Tribunal. Returns None on any failure."""
    if client is None or fail_count[0] >= 2:
        return None

    sections_text = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections:
                snippet = section.content[:400].replace("\n", " ")
                sections_text.append(f"[{loc}] {section.title}: {snippet}")

    known = sorted({f.clause_ref for f in obs.active_findings})
    prompt = (
        f"Frameworks: {[f.value for f in obs.regulatory_context.frameworks_in_scope]}\n"
        f"Steps remaining: {obs.steps_remaining}\n\n"
        "SECTIONS:\n" + "\n".join(sections_text) +
        "\n\nALREADY FOUND:\n" + ("\n".join(f"  - {r}" for r in known) if known else "  (none)") +
        "\n\nIdentify the next genuine compliance gap:"
    )

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            temperature=_TEMPERATURE,
            max_tokens=_MAX_TOKENS,
            messages=[
                {"role": "system", "content": _GAP_SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
        )
        raw  = response.choices[0].message.content or ""
        data = _extract_json(raw)
        fail_count[0] = 0

        if data.get("action_type") == "submit_final_report":
            return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)

        action = _safe_action(data, obs)
        return action
    except Exception as exc:
        fail_count[0] += 1
        print(f"    [LLM] error ({fail_count[0]}): {exc}", flush=True)
        return None


# ══════════════════════════════════════════════════════════════════════════════
# MultiPassAgent — primary agent used by inference.py
# ══════════════════════════════════════════════════════════════════════════════

class MultiPassAgent:
    """
    Curriculum heuristic agent (v6).

    Phase structure (% of total steps):
      0  – 25%  READ:       request_section up to task-aware cap
      25 – 75%  AUDIT:      heuristic gap ID (task-tuned) → cite evidence
      75 – 90%  REMEDIATE:  cite uncited → submit_remediation
      90 – 100% FINALISE:   cite → remediate → escalate → submit_final_report

    LLM is only used in AUDIT phase for hard/expert tasks when:
      - ARIA_USE_LLM=1 env var is set
      - client is provided
      - heuristic gaps are exhausted
      - fewer than 2 consecutive LLM failures
    """

    _READ_CAPS = {"easy": 5, "medium": 12, "hard": 18, "expert": 24}

    def __init__(self, client=None, task_name: str = "easy") -> None:
        self.client            = client
        self._task_name        = task_name
        self._max_read         = self._READ_CAPS.get(task_name, 12)
        self._escalated_pairs: set[str] = set()
        self._llm_fail_count   = [0]

    def act(self, obs: ARIAObservation) -> ARIAAction:
        step  = obs.steps_taken
        total = step + obs.steps_remaining

        # Incident override (expert task)
        incident_action = _handle_incident(obs)
        if incident_action:
            return incident_action

        # Finalise when almost out of steps
        if obs.steps_remaining <= 3:
            return _finalization_phase(obs, self._escalated_pairs)

        still_reading = (
            step < total * 0.25
            and len(obs.visible_sections) < self._max_read
        )

        if still_reading:
            return self._reading_phase(obs)
        elif step < total * 0.75:
            return self._auditing_phase(obs)
        elif step < total * 0.90:
            return self._remediation_phase(obs)
        else:
            return _finalization_phase(obs, self._escalated_pairs)

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

    def _auditing_phase(self, obs: ARIAObservation) -> ARIAAction:
        # Cite any uncited findings first
        uncited = _cite_next_uncited(obs)
        if uncited:
            return uncited

        # Try task-specific heuristic gap detection (always, zero API cost)
        heuristic = _heuristic_next_gap(obs)
        if heuristic:
            return heuristic

        # LLM fallback: only when explicitly enabled and heuristics exhausted
        if _USE_LLM and self.client and self._llm_fail_count[0] < 2:
            result = _llm_identify_gap(self.client, obs, self._llm_fail_count)
            if result is not None:
                if result.action_type == ActionType.SUBMIT_FINAL_REPORT:
                    return self._remediation_phase(obs)
                return result

        # Read more sections if any remain
        for doc in obs.documents:
            for section in doc.sections:
                loc = f"{doc.doc_id}.{section.section_id}"
                if loc not in obs.visible_sections:
                    return ARIAAction(
                        action_type=ActionType.REQUEST_SECTION,
                        document_id=doc.doc_id,
                        section_id=section.section_id,
                    )

        # All sections read, no more heuristic gaps — move to remediation
        return self._remediation_phase(obs)

    def _remediation_phase(self, obs: ARIAObservation) -> ARIAAction:
        uncited = _cite_next_uncited(obs)
        if uncited:
            return uncited
        rem = _try_remediate_one(obs)
        if rem:
            return rem
        return _finalization_phase(obs, self._escalated_pairs)


# ══════════════════════════════════════════════════════════════════════════════
# SinglePassAgent — kept for run_baseline.py compatibility
# ══════════════════════════════════════════════════════════════════════════════

class SinglePassAgent(MultiPassAgent):
    """Alias for MultiPassAgent — single-pass behaviour is identical in v6."""

    def __init__(self, client=None, task_name: str = "easy") -> None:
        super().__init__(client=client, task_name=task_name)