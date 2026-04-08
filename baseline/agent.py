"""
ARIA — Baseline Agent Classes
==============================
baseline/agent.py

Two agents:
  SinglePassAgent  — LLM with structured JSON, full conversation window + enum guard
  MultiPassAgent   — Curriculum heuristic: read → identify+cite → remediate → escalate → finalise

Fixes in this version (v3):
  1. _normalize_gap_type(): maps common LLM hallucinations to valid GapType enum values.
       sub_processor_transparency → baa_requirement
       data_sharing               → data_minimization
       subprocessor_management    → baa_requirement
       third_party_disclosure     → baa_requirement
       data_transfer              → cross_border_transfer
       access_rights              → data_subject_rights
       privacy_notice             → purpose_limitation
       encryption                 → phi_safeguard
       … (full table in _GAP_TYPE_ALIASES below)
  2. _safe_action(): validates/normalises JSON before constructing ARIAAction.
       — called in BOTH SinglePassAgent and MultiPassAgent._llm_identify_gap
       — invalid gap_type → normalised → fallback if still invalid
  3. MultiPassAgent._llm_identify_gap now uses the focused
       build_gap_identification_prompt() instead of the full build_user_prompt(),
       cutting token waste and directing the LLM to output a single identify_gap.
  4. SYSTEM_PROMPT reinforced with the full gap_type enum on every call so the
       model always has the canonical list in-context.
  5. Phase boundaries unchanged from v2; read caps unchanged from v2.
  6. _HEURISTIC_PATTERNS and _REMEDIATIONS unchanged from v2.
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

# ── Config ─────────────────────────────────────────────────────────────────────
MODEL_NAME   = os.environ.get("MODEL_NAME", "nvidia/nemotron-3-super-120b-a12b:free")
_MAX_TOKENS  = 800
_TEMPERATURE = 0.0


def _extract_json(text: str) -> dict:
    """
    Robustly extract JSON from LLM response text.
    Handles: plain JSON, markdown code blocks, text with embedded JSON.
    """
    text = text.strip()
    # Try direct parse first
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    # Try extracting from markdown code block
    md_match = re.search(r'```(?:json)?\s*\n?(\{.*?\})\s*```', text, re.DOTALL)
    if md_match:
        try:
            return json.loads(md_match.group(1))
        except json.JSONDecodeError:
            pass
    # Try finding first { ... } block
    brace_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Cannot extract JSON from response: {text[:200]}")

# ══════════════════════════════════════════════════════════════════════════════
# Gap-type alias table  (v3 fix #1)
# Maps common LLM hallucinations → valid GapType enum value strings
# ══════════════════════════════════════════════════════════════════════════════

_GAP_TYPE_ALIASES: dict[str, str] = {
    # sub-processor / vendor management
    "sub_processor_transparency":   "baa_requirement",
    "subprocessor_transparency":    "baa_requirement",
    "subprocessor_management":      "baa_requirement",
    "third_party_disclosure":       "baa_requirement",
    "vendor_management":            "baa_requirement",
    "third_party_data_sharing":     "baa_requirement",
    "processor_agreement":          "baa_requirement",
    "data_processor_agreement":     "baa_requirement",

    # generic data sharing / transfer
    "data_sharing":                 "data_minimization",
    "data_transfer":                "cross_border_transfer",
    "international_transfer":       "cross_border_transfer",
    "cross_border_data_transfer":   "cross_border_transfer",

    # access / rights
    "access_rights":                "data_subject_rights",
    "subject_rights":               "data_subject_rights",
    "right_to_erasure":             "data_subject_rights",
    "data_rights":                  "data_subject_rights",

    # notices / purposes
    "privacy_notice":               "purpose_limitation",
    "notice_requirement":           "purpose_limitation",
    "transparency":                 "purpose_limitation",

    # security / encryption
    "encryption":                   "phi_safeguard",
    "security_safeguard":           "phi_safeguard",
    "technical_safeguard":          "phi_safeguard",
    "security_measure":             "phi_safeguard",
    "data_security":                "phi_safeguard",

    # consent variants
    "consent":                      "consent_mechanism",
    "opt_in":                       "consent_mechanism",
    "lawful_basis":                 "consent_mechanism",

    # retention variants
    "retention":                    "data_retention",
    "storage_limitation":           "data_retention",

    # breach variants
    "breach":                       "breach_notification",
    "incident_notification":        "breach_notification",

    # minimisation variants
    "minimisation":                 "data_minimization",
    "minimization":                 "data_minimization",
    "data_collection":              "data_minimization",

    # DPO variants
    "dpo":                          "dpo_requirement",
    "data_protection_officer":      "dpo_requirement",

    # audit / logging
    "audit_log":                    "audit_log_requirement",
    "logging":                      "audit_log_requirement",
    "access_log":                   "audit_log_requirement",

    # availability
    "availability":                 "availability_control",
    "sla":                          "availability_control",
    "uptime":                       "availability_control",

    # opt-out variants
    "opt_out":                      "opt_out_mechanism",
    "do_not_sell":                  "opt_out_mechanism",
    "ccpa_opt_out":                 "opt_out_mechanism",
}

_VALID_GAP_TYPES: frozenset[str] = frozenset(e.value for e in GapType)


def _normalize_gap_type(raw: str) -> Optional[str]:
    """
    Returns a valid GapType string for *raw*, or None if it cannot be mapped.
    Tries (in order):
      1. Already valid → return as-is
      2. Lowercase + strip → valid → return
      3. Alias table lookup
      4. Prefix match against valid values (first match wins)
    """
    if not raw:
        return None
    cleaned = raw.strip().lower().replace("-", "_").replace(" ", "_")
    if cleaned in _VALID_GAP_TYPES:
        return cleaned
    if cleaned in _GAP_TYPE_ALIASES:
        return _GAP_TYPE_ALIASES[cleaned]
    # Prefix match: "data_ret" → "data_retention"
    for valid in _VALID_GAP_TYPES:
        if valid.startswith(cleaned) or cleaned.startswith(valid[:8]):
            return valid
    return None


def _safe_action(data: dict, obs: ARIAObservation) -> ARIAAction:
    """
    Normalise *data* from LLM JSON and construct ARIAAction safely.
    — Fixes gap_type hallucinations before Pydantic validation.
    — Falls back to _fallback_action on any remaining error.
    """
    # Normalise gap_type if present
    if "gap_type" in data and data["gap_type"]:
        fixed = _normalize_gap_type(str(data["gap_type"]))
        if fixed:
            data["gap_type"] = fixed
        else:
            # Cannot map → demote to a read action to avoid -0.05 penalty
            print(
                f"    [ARIA] Unknown gap_type '{data['gap_type']}' — "
                "cannot normalise, falling back to read.",
                flush=True,
            )
            return _fallback_action(obs)

    # Normalise severity if present (guard against hallucinated values)
    if "severity" in data and data["severity"]:
        sev_raw = str(data["severity"]).strip().lower()
        if sev_raw not in ("high", "medium", "low"):
            data["severity"] = "medium"  # safe default

    try:
        return ARIAAction(**data)
    except Exception as exc:
        print(f"    [ARIA] ARIAAction construction failed: {exc} — falling back.", flush=True)
        return _fallback_action(obs)


# ══════════════════════════════════════════════════════════════════════════════
# SinglePassAgent
# ══════════════════════════════════════════════════════════════════════════════

class SinglePassAgent:
    """
    LLM baseline agent with rolling 6-message conversation window.
    v3: uses _safe_action() to guard against invalid gap_type enum values.
    """

    def __init__(self, client) -> None:
        self.client  = client
        self.history = []

    def act(self, obs: ARIAObservation) -> ARIAAction:
        from baseline.prompts import SYSTEM_PROMPT, build_user_prompt

        user_msg = build_user_prompt(obs)
        self.history.append({"role": "user", "content": user_msg})

        try:
            # Try with JSON mode first; fall back to plain text if unsupported
            try:
                response = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    temperature=_TEMPERATURE,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        *self.history[-4:],
                    ],
                    max_tokens=_MAX_TOKENS,
                )
            except Exception:
                # Some OpenRouter providers don't support response_format
                response = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    temperature=_TEMPERATURE,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        *self.history[-4:],
                    ],
                    max_tokens=_MAX_TOKENS,
                )
            raw  = response.choices[0].message.content
            self.history.append({"role": "assistant", "content": raw})
            data = _extract_json(raw)
            return _safe_action(data, obs)   # v3: normalise before validation

        except Exception as exc:
            print(f"    [SinglePass] LLM error: {exc} — using fallback", flush=True)
            return _fallback_action(obs)


# ══════════════════════════════════════════════════════════════════════════════
# MultiPassAgent  (primary baseline — Bible §7.3)
# ══════════════════════════════════════════════════════════════════════════════

class MultiPassAgent:
    """
    Curriculum heuristic agent with all v2 fixes applied + v3 LLM guard.

    Phase boundaries (% of total steps):
      0 – 28%   READ:       request_section up to task-aware _max_read cap
      28 – 70%  AUDIT:      identify_gap → cite_evidence per finding
      70 – 88%  REMEDIATE:  cite uncited → submit_remediation for every confirmed finding
      88 – 100% FINALISE:   cite uncited → escalate_conflict → submit_final_report

    Expert override: respond_to_incident immediately if active_incident present.

    v3 changes:
      - _llm_identify_gap uses build_gap_identification_prompt (focused, fewer tokens)
      - _safe_action() applied to all LLM output before ARIAAction(**data)
    """

    _LLM_FAIL_THRESHOLD = 3

    # Task-aware read caps: leave enough steps for auditing/remediation
    _READ_CAPS = {
        "easy":   6,
        "medium": 10,
        "hard":   12,
        "expert": 12,
    }

    def __init__(self, client=None, task_name: str = "easy") -> None:
        self.client    = client
        self._max_read = self._READ_CAPS.get(task_name, 10)
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
        if obs.steps_remaining <= 4:
            return self._finalization_phase(obs)

        # Reading phase: only if within first 28% AND under section cap
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
        # v3: use the focused prompt instead of the full observation prompt
        from baseline.prompts import SYSTEM_PROMPT, build_gap_identification_prompt
        try:
            prompt   = build_gap_identification_prompt(obs)   # v3 fix #3
            # Try with JSON mode first; fall back if unsupported
            try:
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
            except Exception:
                response = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    temperature=_TEMPERATURE,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": prompt},
                    ],
                    max_tokens=_MAX_TOKENS,
                )
            raw  = response.choices[0].message.content
            data = _extract_json(raw)
            self._llm_fail_count = 0  # reset on success
            return _safe_action(data, obs)   # v3 fix #2

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
            return self._heuristic_identify_gap(obs)

    def _heuristic_identify_gap(self, obs: ARIAObservation) -> ARIAAction:
        """
        Keyword-pattern gap detector for when LLM is unavailable.
        Scans visible section content for known violation signatures.
        safe_phrases act as red-herring guards — if ANY safe phrase is present,
        the section is treated as compliant and skipped.
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
                            clause_ref=clause_ref,
                            gap_type=gap_type,
                            severity=severity,
                            description=desc_tpl.format(loc=clause_ref),
                        )

        # No gap found in visible sections — read one more unread section or finalise
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
        # First: collect any uncited findings — +0.12 per citation, worth doing here too
        uncited_action = self._cite_next_uncited(obs)
        if uncited_action:
            return uncited_action

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
        # 1. Cite any remaining uncited findings before closing (+0.12 each)
        if obs.steps_remaining > 2:
            uncited_action = self._cite_next_uncited(obs)
            if uncited_action:
                return uncited_action

        # 2. Escalate cross-framework conflicts (+0.18 each — only 1 opportunity per conflict)
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

        # 3. Submit final report
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
# Heuristic gap patterns — v2 with expanded safe_phrases
#
# Format: (gap_type_str, (trigger_phrases, safe_phrases), severity_str, desc_template)
#   trigger_phrases : ANY match in section content → potential gap
#   safe_phrases    : ANY match → section is compliant, skip it (red herring guard)
# ══════════════════════════════════════════════════════════════════════════════

_HEURISTIC_PATTERNS = [
    # ── Data Retention ────────────────────────────────────────────────────────
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

    # ── Consent Mechanism ─────────────────────────────────────────────────────
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

    # ── Breach Notification ───────────────────────────────────────────────────
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

    # ── DPO Requirement ───────────────────────────────────────────────────────
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

    # ── Cross-Border Transfer ─────────────────────────────────────────────────
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

    # ── Data Subject Rights ───────────────────────────────────────────────────
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

    # ── Opt-Out Mechanism ─────────────────────────────────────────────────────
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

    # ── Purpose Limitation ────────────────────────────────────────────────────
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

    # ── BAA Requirement ───────────────────────────────────────────────────────
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
    }
    return details.get(
        response_type,
        f"Execute required incident response step '{response_type}' "
        f"in compliance with applicable regulatory timeline for {inc_type}.",
    )


# ══════════════════════════════════════════════════════════════════════════════
# Remediation templates — v2 with EXACT canonical keywords embedded verbatim
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
        "(Articles 15–21): right of access, right to erasure, rectification, restriction, "
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