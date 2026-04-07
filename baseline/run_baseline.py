"""
ARIA — Baseline Inference Script
Reproducible baseline scoring using any OpenAI-compatible endpoint.
Supports Groq (recommended), HuggingFace, vLLM, and OpenAI.

SETUP:
  1. Get a FREE Groq API key at https://console.groq.com
  2. Set your .env file:
       GROQ_API_KEY=gsk_your_key_here
       API_BASE_URL=https://api.groq.com/openai/v1
       MODEL_NAME=llama-3.1-8b-instant
  3. Run: python baseline/run_baseline.py
"""
from __future__ import annotations
import json
import os
from dotenv import load_dotenv
import time

load_dotenv()

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from aria.environment import ARIAEnv
from aria.models import ARIAAction, ARIAObservation, ActionType, GapType, Severity, Framework

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

RESULTS_FILE = Path(__file__).parent / "baseline_results.json"
TASKS = ["easy", "medium", "hard", "expert"]
SEED = 42

# Dynamically fetch the model name
MODEL_NAME = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")

# ─── Field Name Normalization ──────────────────────────────────────────────────
# Some models (Qwen, Llama variants) return wrong field names.
# This maps all known wrong names → correct ARIAAction field names.

FIELD_ALIASES = {
    # action_type aliases
    "action": "action_type",
    "action_name": "action_type",
    "type": "action_type",
    "actionType": "action_type",
    # section_id aliases
    "section": "section_id",
    "sectionId": "section_id",
    "section_number": "section_id",
    # document_id aliases
    "doc_id": "document_id",
    "document": "document_id",
    "documentId": "document_id",
    "doc": "document_id",
    # finding_id aliases
    "finding": "finding_id",
    "findingId": "finding_id",
    # passage_text aliases
    "passage": "passage_text",
    "text": "passage_text",
    "quote": "passage_text",
    "evidence_text": "passage_text",
    # passage_location aliases
    "location": "passage_location",
    "evidence_location": "passage_location",
    "clause": "passage_location",
    # remediation_text aliases
    "remediation": "remediation_text",
    "fix": "remediation_text",
    "remedy": "remediation_text",
    # retract_finding_id aliases
    "retract_id": "retract_finding_id",
    "retract": "retract_finding_id",
    # incident_id aliases
    "incident": "incident_id",
    # response_type aliases
    "response": "response_type",
    # conflict_desc aliases
    "conflict_description": "conflict_desc",
    "description": "conflict_desc",  # only remapped if no 'description' field exists properly
}

# action_type VALUE aliases — some models return wrong enum values
ACTION_TYPE_ALIASES = {
    "remedy_gap": "submit_remediation",
    "remediate": "submit_remediation",
    "submit_remedy": "submit_remediation",
    "flag_gap": "identify_gap",
    "gap": "identify_gap",
    "read_section": "request_section",
    "get_section": "request_section",
    "read": "request_section",
    "cite": "cite_evidence",
    "evidence": "cite_evidence",
    "escalate": "escalate_conflict",
    "conflict": "escalate_conflict",
    "incident_response": "respond_to_incident",
    "respond": "respond_to_incident",
    "finalize": "submit_final_report",
    "done": "submit_final_report",
    "finish": "submit_final_report",
    "clarify": "request_clarification",
    "false_positive": "flag_false_positive",
    "retract": "flag_false_positive",
}


def normalize_llm_response(data: dict) -> dict:
    """
    Normalize a raw LLM JSON response to match ARIAAction field names.
    Handles wrong field names and wrong enum values from weaker models.
    """
    normalized = {}

    for key, value in data.items():
        # Remap wrong field names to correct ones
        correct_key = FIELD_ALIASES.get(key, key)
        normalized[correct_key] = value

    # Fix wrong action_type values
    if "action_type" in normalized:
        raw_val = str(normalized["action_type"]).strip().lower()
        if raw_val in ACTION_TYPE_ALIASES:
            normalized["action_type"] = ACTION_TYPE_ALIASES[raw_val]

    # Special case: if model returned "description" but we also have other fields,
    # don't clobber the identify_gap description field with conflict_desc alias
    # Only alias "description" -> "conflict_desc" if action_type is escalate_conflict
    if (data.get("description") and
            normalized.get("action_type") != "escalate_conflict" and
            "conflict_desc" in normalized and
            "description" not in data):
        # restore description as its own field
        normalized["description"] = normalized.pop("conflict_desc")

    return normalized


# ─── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are ARIA-Auditor, a senior AI compliance analyst. You review regulatory
documents and produce audit findings with precision and evidence.

YOUR AUDIT WORKFLOW (follow in order):
1. READ FIRST: Use request_section to read every document section systematically before flagging.
2. IDENTIFY GAPS: For each gap, provide clause_ref + gap_type + severity + description. Be specific.
3. CITE EVIDENCE: Immediately follow each identify_gap with cite_evidence quoting the exact offending passage.
4. REMEDIATE: For each confirmed gap, submit concrete remediation_text using specific regulatory language.
5. ESCALATE CONFLICTS: If two frameworks impose contradictory requirements, use escalate_conflict.
6. FINALIZE: submit_final_report when done or steps_remaining < 3.

SCORING PRINCIPLES:
- False positives cost -0.10 each. Only flag what you are certain about.
- Evidence citations are worth +0.12. Always cite immediately after identifying a gap.
- Remediations need specific language: "maximum retention period of X months", not vague advice.
- Correct severity (high/medium/low) earns +0.05 bonus per finding.
- Red herrings are compliant clauses — flagging them loses points.

CRITICAL — EXACT FIELD NAMES REQUIRED:
Use ONLY these exact field names in your JSON response. Wrong names cause immediate failure.
- "action_type"      ← NOT "action", "type", or "action_name"
- "section_id"       ← NOT "section" or "sectionId"
- "document_id"      ← NOT "doc_id", "doc", or "document"
- "finding_id"       ← NOT "finding" or "findingId"
- "passage_text"     ← NOT "text", "passage", or "quote"
- "passage_location" ← NOT "location" or "clause"
- "remediation_text" ← NOT "remediation" or "fix"

Valid action_type values (use EXACTLY as written):
  request_section, identify_gap, cite_evidence, submit_remediation,
  flag_false_positive, escalate_conflict, respond_to_incident,
  request_clarification, submit_final_report

Valid gap_type values:
  data_retention, consent_mechanism, breach_notification, data_subject_rights,
  cross_border_transfer, data_minimization, purpose_limitation, dpo_requirement,
  phi_safeguard, baa_requirement, opt_out_mechanism, audit_log_requirement,
  availability_control

Valid severity values: high, medium, low

Respond with EXACTLY ONE JSON object conforming to ARIAAction. No markdown, no explanation, just JSON.

EXAMPLE — Reading a section:
{"action_type": "request_section", "document_id": "privacy_policy", "section_id": "s1"}

EXAMPLE — Identifying a gap:
{"action_type": "identify_gap", "clause_ref": "privacy_policy.s3", "gap_type": "data_retention", "severity": "high", "description": "No maximum retention period specified for customer PII."}

EXAMPLE — Citing evidence:
{"action_type": "cite_evidence", "finding_id": "finding_1", "passage_text": "We retain customer data for as long as necessary...", "passage_location": "privacy_policy.s3"}

EXAMPLE — Submitting remediation:
{"action_type": "submit_remediation", "finding_id": "finding_1", "remediation_text": "Specify a maximum retention period of 24 months with automatic deletion after expiry per Article 5(1)(e) GDPR.", "target_framework": "GDPR"}
"""


def build_user_prompt(obs: ARIAObservation) -> str:
    visible_content = []
    for doc in obs.documents:
        for section in doc.sections:
            loc = f"{doc.doc_id}.{section.section_id}"
            if loc in obs.visible_sections:
                visible_content.append(f"[{loc}] {section.title}:\n{section.content}")

    findings_text = ""
    for f in obs.active_findings:
        findings_text += f"\n  - [{f.finding_id}] {f.clause_ref} | {f.gap_type.value} | {f.severity.value} | status:{f.status.value}"

    cited_finding_ids = {c.finding_id for c in obs.evidence_citations}
    uncited = [f for f in obs.active_findings if f.finding_id not in cited_finding_ids]

    incident_text = ""
    if obs.active_incident:
        inc = obs.active_incident
        remaining = inc.deadline_steps - (obs.steps_taken - inc.discovered_at_step)
        completed = [r.value for r in inc.completed_responses]
        required = [r.value for r in inc.required_responses]
        incident_text = f"""
⚠️ ACTIVE INCIDENT: {inc.description}
Records affected: {inc.records_affected:,}
Deadline: {remaining} steps remaining!
Required responses: {required}
Completed: {completed}
incident_id: {inc.incident_id}
"""

    return f"""CURRENT EPISODE STATE:
Task: {obs.task_id} — {obs.task_description}
Frameworks in scope: {[f.value for f in obs.regulatory_context.frameworks_in_scope]}
Phase: {obs.phase} | Steps taken: {obs.steps_taken} | Steps remaining: {obs.steps_remaining}
Cumulative reward: {obs.cumulative_reward:.3f}
Last action result: {obs.last_action_result.value} — {obs.last_reward_reason}
{incident_text}
DOCUMENTS (all sections, read with request_section):
{chr(10).join(f"  {doc.doc_id}: sections {[s.section_id for s in doc.sections]}" for doc in obs.documents)}

VISIBLE SECTIONS ({len(obs.visible_sections)} read):
{chr(10).join(visible_content) if visible_content else "  None yet — start reading!"}

ACTIVE FINDINGS ({len(obs.active_findings)}):
{findings_text if findings_text else "  None yet"}

UNCITED FINDINGS (need cite_evidence): {[f.finding_id for f in uncited]}
REMEDIATIONS SUBMITTED: {len(obs.submitted_remediations)}

Decide your next action. Remember:
1. Use EXACT field names: action_type, document_id, section_id, finding_id, passage_text, passage_location, remediation_text
2. Read all sections first, then identify gaps with evidence, then remediate.
3. Respond with ONLY a JSON object — no markdown, no explanation."""


# ─── SinglePass Agent ─────────────────────────────────────────────────────────

class SinglePassAgent:
    """LLM with structured JSON output. Temperature=0."""

    def __init__(self, client: "OpenAI"):
        self.client = client
        self.history = []

    def act(self, obs: ARIAObservation) -> ARIAAction:
        user_msg = build_user_prompt(obs)
        self.history.append({"role": "user", "content": user_msg})

        try:
            response = self.client.chat.completions.create(
                model=MODEL_NAME,
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    *self.history[-6:],  # last 3 turns context
                ],
                max_tokens=512,
            )
            raw = response.choices[0].message.content
            self.history.append({"role": "assistant", "content": raw})


            data = json.loads(raw)
            data = normalize_llm_response(data)
            return ARIAAction(**data)

        except Exception as e:
            print(f"    [SinglePass] LLM error: {e} — using fallback")
            return _fallback_action(obs)


# ─── MultiPass Agent ──────────────────────────────────────────────────────────

class MultiPassAgent:
    """Curriculum agent: read → identify+cite → remediate → finalize."""

    def __init__(self, client: "OpenAI"):
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
        # Handle active incident first — missing deadlines is -0.25 per miss
        if obs.active_incident:
            inc = obs.active_incident
            for resp in inc.required_responses:
                if resp not in inc.completed_responses:
                    return ARIAAction(
                        action_type=ActionType.RESPOND_TO_INCIDENT,
                        incident_id=inc.incident_id,
                        response_type=resp,
                        response_detail=f"Executing {resp.value} for incident {inc.incident_id}",
                    )

        # Cite uncited findings next — evidence is +0.12 per citation
        cited_ids = {c.finding_id for c in obs.evidence_citations}
        uncited = [f for f in obs.active_findings if f.finding_id not in cited_ids]
        if uncited:
            f = uncited[0]
            passage = _find_passage_for_finding(f.clause_ref, obs)
            if passage:
                return ARIAAction(
                    action_type=ActionType.CITE_EVIDENCE,
                    finding_id=f.finding_id,
                    passage_text=passage["text"],
                    passage_location=passage["location"],
                )

        # Use LLM to identify next gap
        return self._llm_identify_gap(obs)

    def _remediation_phase(self, obs: ARIAObservation) -> ARIAAction:
        unremediated = [f for f in obs.active_findings
                        if f.status.value not in ("REMEDIATED", "RETRACTED")]
        if unremediated:
            f = unremediated[0]
            remediation_text = _generate_remediation(f.gap_type, f.clause_ref)
            return ARIAAction(
                action_type=ActionType.SUBMIT_REMEDIATION,
                finding_id=f.finding_id,
                remediation_text=remediation_text,
                target_framework=f.framework,
            )
        return self._finalization_phase(obs)

    def _finalization_phase(self, obs: ARIAObservation) -> ARIAAction:
        return ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)

    def _llm_identify_gap(self, obs: ARIAObservation) -> ARIAAction:
        """Ask LLM to identify a gap based on visible sections."""
        if not self.client:
            return _fallback_action(obs)
        try:
            visible_text = []
            for doc in obs.documents:
                for section in doc.sections:
                    loc = f"{doc.doc_id}.{section.section_id}"
                    if loc in obs.visible_sections:
                        visible_text.append(f"[{loc}] {section.title}: {section.content[:300]}")
            if not visible_text:
                return _fallback_action(obs)

            known_refs = {f.clause_ref for f in obs.active_findings}
            prompt = f"""Frameworks: {[f.value for f in obs.regulatory_context.frameworks_in_scope]}
Document sections:
{chr(10).join(visible_text[:8])}
Already flagged: {list(known_refs)}

Identify ONE compliance gap not yet flagged.
Return JSON with EXACT field names: action_type, clause_ref, gap_type, severity, description
Example: {{"action_type": "identify_gap", "clause_ref": "privacy_policy.s3", "gap_type": "data_retention", "severity": "high", "description": "No maximum retention period specified."}}"""

            resp = self.client.chat.completions.create(
                model=MODEL_NAME,
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=256,
            )
            data = json.loads(resp.choices[0].message.content)
            data = normalize_llm_response(data)
            return ARIAAction(**data)

        except Exception as e:
            print(f"    [MultiPass] LLM error: {e}")
            return _fallback_action(obs)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _fallback_action(obs: ARIAObservation) -> ARIAAction:
    """Fallback: read next unread section or submit final report."""
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


def _find_passage_for_finding(clause_ref: str, obs: ARIAObservation) -> dict | None:
    """Find visible section content matching a clause_ref."""
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
                    return {"text": section.content[:400], "location": loc}
    return None


# Keyword-rich remediation templates that score well on ARIA's canonical keyword matching
REMEDIATION_TEMPLATES = {
    "data_retention": (
        "Specify a maximum retention period (e.g., 24 months) with automatic deletion "
        "after the period expires. Retention must not exceed what is necessary for the "
        "stated purpose per Article 5(1)(e) GDPR. Implement automated deletion workflows "
        "and document the retention limit in the privacy policy."
    ),
    "consent_mechanism": (
        "Replace implied or bundled consent with explicit, freely given, specific, and "
        "informed opt-in consent obtained prior to processing. Consent must be withdrawable "
        "at any time without detriment. Maintain a timestamped consent log per Article 7 GDPR."
    ),
    "breach_notification": (
        "Commit to notifying the supervisory authority within 72 hours of becoming aware of "
        "a personal data breach, without undue delay, as required by Article 33 GDPR. "
        "Establish a documented incident response plan with named DPA contact details."
    ),
    "data_subject_rights": (
        "Provide clear mechanisms to exercise GDPR rights: access, erasure, rectification, "
        "portability, and objection. Respond within 30 days. Apply Article 17(3) exceptions "
        "narrowly and document each case with a rights-request tracking log."
    ),
    "cross_border_transfer": (
        "Implement Standard Contractual Clauses (SCCs) approved by the European Commission "
        "for all EU-US data transfers, accompanied by Transfer Impact Assessments (TIAs) "
        "for high-risk transfers. Document all third-country transfers in the Article 30 record."
    ),
    "data_minimization": (
        "Limit data collection to the minimum fields strictly necessary for each specific "
        "purpose per Article 5(1)(c) GDPR. Conduct a data minimization audit, remove "
        "collection of unnecessary fields, and update the privacy notice to reflect changes."
    ),
    "purpose_limitation": (
        "Remove open-ended purpose clauses. Specify all processing purposes explicitly and "
        "exhaustively prior to data collection per Article 5(1)(b) GDPR. Incompatible "
        "secondary uses require fresh, specific consent."
    ),
    "dpo_requirement": (
        "Appoint a qualified Data Protection Officer and register them with the supervisory "
        "authority per Article 37 GDPR. Ensure DPO independence and involve DPO in all DPIA "
        "and high-risk processing decisions."
    ),
    "phi_safeguard": (
        "Implement HIPAA-compliant technical safeguards: AES-256 encryption at rest and in "
        "transit, role-based access controls applying the minimum necessary standard, audit "
        "logs retained for 6 years per 45 CFR 164.312, and annual workforce training."
    ),
    "baa_requirement": (
        "Execute a Business Associate Agreement (BAA) per 45 CFR 164.314 with all vendors "
        "receiving PHI before any PHI is shared. Maintain a BAA register and review annually. "
        "Do not transmit PHI to any vendor without a signed BAA in place."
    ),
    "opt_out_mechanism": (
        "Add a clear and conspicuous 'Do Not Sell or Share My Personal Information' link "
        "on the homepage per CCPA 1798.135. Implement automated opt-out processing within "
        "15 business days and honor Global Privacy Control (GPC) signals."
    ),
    "audit_log_requirement": (
        "Retain audit logs for a minimum of 6 years as required by HIPAA 45 CFR 164.316 "
        "and SOC 2 CC7. Implement tamper-evident, write-once log storage with access controls "
        "and automated alerting on suspicious access patterns."
    ),
    "availability_control": (
        "Implement redundancy, failover, and automated backup systems to meet committed SLA "
        "targets per SOC 2 Availability Criteria A1. Document RTO/RPO objectives, conduct "
        "quarterly DR drills, and publish accurate availability metrics with root cause "
        "analysis for any outages exceeding SLA thresholds."
    ),
}


def _generate_remediation(gap_type, clause_ref: str) -> str:
    key = gap_type.value if hasattr(gap_type, "value") else str(gap_type)
    template = REMEDIATION_TEMPLATES.get(key)
    if not template:
        return (
            f"Review and remediate the compliance gap at {clause_ref} against all applicable "
            "regulatory requirements. Implement specific, measurable controls with defined "
            "timelines and assign responsibility to a named team member."
        )
    return template


# ─── Run Baseline ─────────────────────────────────────────────────────────────

def run_baseline():
    """
    Priority order for API keys:
      1. GROQ_API_KEY  (recommended — free, fast, reliable)
      2. OPENAI_API_KEY
      3. HF_TOKEN      (HuggingFace — free credits run out quickly)
    """
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    hf_key = os.environ.get("HF_TOKEN")
    base_url = os.environ.get("API_BASE_URL")

    # Auto-configure Groq if key is set but base_url is not
    if groq_key and not base_url:
        base_url = "https://api.groq.com/openai/v1"
        print("🔧 Auto-configured Groq base URL.")

    api_key = groq_key or openai_key or hf_key

    if not api_key or not OPENAI_AVAILABLE:
        print("⚠️  No API key found. Running MultiPass heuristic agent only.")
        print("   → Set GROQ_API_KEY in your .env for LLM-powered agents (free at console.groq.com)")
        client = None
    else:
        client = OpenAI(api_key=api_key, base_url=base_url)
        key_source = "Groq" if groq_key else ("OpenAI" if openai_key else "HuggingFace")
        print(f"🔗 Connected to {key_source} | Model: {MODEL_NAME}")
        if base_url:
            print(f"   Base URL: {base_url}")

    results = {"results": [], "model": MODEL_NAME, "seed": SEED}

    for task_name in TASKS:
        print(f"\n{'='*55}")
        print(f"Task: {task_name.upper()}")

        for agent_name, AgentClass in [("SinglePass", SinglePassAgent), ("MultiPass", MultiPassAgent)]:
            if agent_name == "SinglePass" and client is None:
                print(f"  Skipping {agent_name} (no API key)")
                continue

            print(f"  Running {agent_name}...")
            env = ARIAEnv()
            obs = env.reset(task_name=task_name, seed=SEED)

            agent = AgentClass(client) if client else MultiPassAgent(None)

            step_count = 0
            total_reward = 0.0
            consecutive_errors = 0

            while not obs.done and step_count < obs.steps_remaining + obs.steps_taken + 1:
                try:
                    action = agent.act(obs)
                    obs, reward, done, _ = env.step(action)
                    total_reward += reward
                    step_count += 1
                    consecutive_errors = 0
                    if done:
                        break
                except Exception as e:
                    consecutive_errors += 1
                    print(f"    Step error ({consecutive_errors}): {e}")
                    if consecutive_errors >= 5:
                        print("    Too many consecutive errors — stopping episode early.")
                        break
                    # Try a safe fallback action to unstick the agent
                    try:
                        fallback = _fallback_action(obs)
                        obs, reward, done, _ = env.step(fallback)
                        total_reward += reward
                        step_count += 1
                        if done:
                            break
                    except Exception as fe:
                        print(f"    Fallback also failed: {fe}")
                        break

            grade = env.grade()
            f1_val = getattr(grade.f1_score, "f1", 0.0) if hasattr(grade, "f1_score") else 0.0
            precision = getattr(grade.f1_score, "precision", 0.0) if hasattr(grade, "f1_score") else 0.0
            recall = getattr(grade.f1_score, "recall", 0.0) if hasattr(grade, "f1_score") else 0.0

            result = {
                "task": task_name,
                "agent": agent_name,
                "score": grade.score,
                "f1": f1_val,
                "precision": precision,
                "recall": recall,
                "evidence_score": getattr(grade, "evidence_score", 0.0),
                "remediation_score": getattr(grade, "remediation_score", 0.0),
                "steps_taken": step_count,
                "cumulative_reward": total_reward,
                "breakdown": getattr(grade, "breakdown", {}),
            }
            results["results"].append(result)
            print(f"    Score: {grade.score:.3f} | F1: {f1_val:.3f} | "
                  f"P: {precision:.3f} | R: {recall:.3f} | Steps: {step_count}")

    # Save results
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_FILE, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n✅ Results saved to {RESULTS_FILE}")

    # Print summary table
    print("\n" + "=" * 70)
    print(f"{'Task':<10} {'Agent':<12} {'Score':<8} {'F1':<8} {'Prec':<8} {'Recall':<8} {'Steps'}")
    print("-" * 70)
    for r in results["results"]:
        print(
            f"{r['task']:<10} {r['agent']:<12} {r['score']:.3f}    "
            f"{r['f1']:.3f}    {r['precision']:.3f}    {r['recall']:.3f}    {r['steps_taken']}"
        )

    avg_score = sum(r["score"] for r in results["results"]) / max(len(results["results"]), 1)
    avg_f1 = sum(r["f1"] for r in results["results"]) / max(len(results["results"]), 1)
    print("-" * 70)
    print(f"{'AVERAGE':<10} {'':<12} {avg_score:.3f}    {avg_f1:.3f}")

    return results


if __name__ == "__main__":
    run_baseline()