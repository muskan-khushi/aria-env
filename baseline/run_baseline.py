"""
ARIA — Baseline Inference Script
Reproducible baseline scoring using GPT-4o-mini (SinglePass + MultiPass).
Supports Groq/vLLM via OpenAI-compatible endpoints.
Usage: python baseline/run_baseline.py
"""
from __future__ import annotations
import json
import os
from dotenv import load_dotenv

load_dotenv() # This automatically finds and loads your .env file!
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

# Dynamically fetch the model name (defaults to gpt-4o-mini if not set)
MODEL_NAME = os.environ.get("MODEL_NAME", "gpt-4o-mini")

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

Valid gap_type values: data_retention, consent_mechanism, breach_notification, data_subject_rights,
cross_border_transfer, data_minimization, purpose_limitation, dpo_requirement, phi_safeguard,
baa_requirement, opt_out_mechanism, audit_log_requirement, availability_control

Valid action_type values: request_section, identify_gap, cite_evidence, submit_remediation,
flag_false_positive, escalate_conflict, respond_to_incident, request_clarification, submit_final_report

Respond with EXACTLY ONE JSON object conforming to ARIAAction. No markdown, no explanation, just JSON.
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

Decide your next action. Remember: read all sections first, then identify gaps with evidence, then remediate."""


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
                # seed=SEED,  <-- REMOVED FOR GROQ COMPATIBILITY
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
            return ARIAAction(**data)
        except Exception as e:
            # Fallback: request next unread section
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
        # Handle active incident first
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

        # Cite uncited findings
        cited_ids = {c.finding_id for c in obs.evidence_citations}
        uncited = [f for f in obs.active_findings if f.finding_id not in cited_ids]
        if uncited:
            f = uncited[0]
            # Find the relevant section content for citation
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

Identify ONE compliance gap not yet flagged. Return JSON ARIAAction with action_type=identify_gap.
Required fields: action_type, clause_ref, gap_type, severity, description"""

            resp = self.client.chat.completions.create(
                model=MODEL_NAME,
                temperature=0.0,
                # seed=SEED,  <-- REMOVED FOR GROQ COMPATIBILITY
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


REMEDIATION_TEMPLATES = {
    "data_retention": "Specify a maximum retention period (e.g., 24 months) with automatic deletion after the period expires. Retention must not exceed what is necessary for the stated purpose per Article 5(1)(e).",
    "consent_mechanism": "Replace implied or bundled consent with explicit, freely given, specific, and informed opt-in consent obtained prior to processing. Consent must be withdrawable at any time without detriment.",
    "breach_notification": "Commit to notifying the supervisory authority within 72 hours of becoming aware of a personal data breach, without undue delay, as required by Article 33 GDPR.",
    "data_subject_rights": "Provide clear mechanisms to exercise GDPR rights (access, erasure, rectification, portability, objection). Respond within 30 days. Apply Article 17(3) exceptions narrowly and document each case.",
    "cross_border_transfer": "Implement Standard Contractual Clauses (SCCs) approved by the European Commission for all EU-US data transfers, accompanied by Transfer Impact Assessments for high-risk transfers.",
    "data_minimization": "Limit data collection to the minimum fields strictly necessary for each specific purpose. Conduct a data minimization audit and remove collection of unnecessary fields.",
    "purpose_limitation": "Remove open-ended purpose clauses. Specify all processing purposes explicitly and exhaustively prior to data collection. Incompatible secondary uses require fresh consent.",
    "dpo_requirement": "Appoint a qualified Data Protection Officer and register them with the supervisory authority. Ensure DPO independence and involve DPO in all DPIA and high-risk processing decisions.",
    "phi_safeguard": "Implement HIPAA-compliant technical safeguards: encryption at rest and in transit, access controls, audit logs retained 6 years, workforce training, and minimum necessary standard application.",
    "baa_requirement": "Execute a Business Associate Agreement (BAA) per 45 CFR 164.314 with all vendors receiving PHI. Do not share PHI until signed BAA is in place.",
    "opt_out_mechanism": "Add a clear and conspicuous 'Do Not Sell or Share My Personal Information' link on your homepage per CCPA 1798.135. Implement automated opt-out processing.",
    "audit_log_requirement": "Retain audit logs for a minimum of 6 years as required by HIPAA 45 CFR 164.316 and SOC 2 CC7. Implement tamper-evident log storage with access controls.",
    "availability_control": "Implement redundancy, failover, and backup systems to meet committed SLA targets. Document root cause analysis for outages and publish accurate availability metrics per SOC 2 A1.",
}

def _generate_remediation(gap_type, clause_ref: str) -> str:
    from aria.models import GapType
    template = REMEDIATION_TEMPLATES.get(gap_type.value if hasattr(gap_type, 'value') else str(gap_type), "")
    if not template:
        return f"Review and remediate the compliance gap in {clause_ref} against applicable regulatory requirements."
    return template


# ─── Run Baseline ─────────────────────────────────────────────────────────────

def run_baseline():
    # Supports the organizer's exact required variables
    api_key = os.environ.get("HF_TOKEN") or os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("API_BASE_URL")
    
    if not api_key or not OPENAI_AVAILABLE:
        print("⚠️  No API Key found. Running with MultiPass heuristic agent only.")
        client = None
    else:
        # Pass base_url to the client. If base_url is None, it safely uses default OpenAI.
        client = OpenAI(api_key=api_key, base_url=base_url)
        print(f"🔗 Connected to LLM: {MODEL_NAME}")

    # Track the actual model name in the results file
    results = {"results": [], "model": MODEL_NAME, "seed": SEED}

    for task_name in TASKS:
        print(f"\n{'='*50}")
        print(f"Task: {task_name.upper()}")

        for agent_name, AgentClass in [("SinglePass", SinglePassAgent), ("MultiPass", MultiPassAgent)]:
            if agent_name == "SinglePass" and client is None:
                print(f"  Skipping {agent_name} (no API key)")
                continue

            print(f"  Running {agent_name}...")
            env = ARIAEnv()
            obs = env.reset(task_name=task_name, seed=SEED)

            if client:
                agent = AgentClass(client)
            else:
                agent = MultiPassAgent(None)

            step_count = 0
            total_reward = 0.0

            while not obs.done and step_count < obs.steps_remaining + obs.steps_taken + 1:
                try:
                    action = agent.act(obs)
                    obs, reward, done, _ = env.step(action)
                    total_reward += reward
                    step_count += 1
                    if done:
                        break
                except Exception as e:
                    print(f"    Step error: {e}")
                    break

            grade = env.grade()
            result = {
                "task": task_name,
                "agent": agent_name,
                "score": grade.score,
                "f1": getattr(grade.f1_score, 'f1', 0.0) if hasattr(grade, 'f1_score') else 0.0,
                "precision": getattr(grade.f1_score, 'precision', 0.0) if hasattr(grade, 'f1_score') else 0.0,
                "recall": getattr(grade.f1_score, 'recall', 0.0) if hasattr(grade, 'f1_score') else 0.0,
                "evidence_score": getattr(grade, 'evidence_score', 0.0),
                "remediation_score": getattr(grade, 'remediation_score', 0.0),
                "steps_taken": step_count,
                "cumulative_reward": total_reward,
                "breakdown": getattr(grade, 'breakdown', {}),
            }
            results["results"].append(result)
            f1_val = result["f1"]
            print(f"    Score: {grade.score:.3f} | F1: {f1_val:.3f} | Steps: {step_count}")

    # Save results
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_FILE, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n✅ Baseline results saved to {RESULTS_FILE}")

    # Print summary table
    print("\n" + "="*60)
    print(f"{'Task':<10} {'Agent':<12} {'Score':<8} {'F1':<8} {'Steps':<6}")
    print("-"*60)
    for r in results["results"]:
        print(f"{r['task']:<10} {r['agent']:<12} {r['score']:.3f}    {r['f1']:.3f}    {r['steps_taken']}")

    return results


if __name__ == "__main__":
    run_baseline()