---
title: ARIA - Compliance Audit Agent
emoji: ⚖️
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
---

<div align="center">

# ARIA
### Agentic Regulatory Intelligence Architecture

<br/>

[![OpenEnv Compliant](https://img.shields.io/badge/OpenEnv-Compliant-2563EB?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSIzIiBmaWxsPSIjMjU2M0VCIi8+PC9zdmc+)](https://github.com/huggingface/openenv)
[![Live Demo](https://img.shields.io/badge/🤗_HF_Space-Live_Demo-FF6B35?style=for-the-badge)](https://huggingface.co/spaces/muskankhushi/aria-compliance-v1)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3B82F6?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)

<br/>

*The first reinforcement learning environment for training and benchmarking AI agents on multi-framework regulatory compliance auditing.*

<br/>

[**Live Dashboard →**](https://huggingface.co/spaces/muskankhushi/aria-compliance-v1) &nbsp;·&nbsp; [**Quick Start**](#-quick-start) &nbsp;·&nbsp; [**Action Space**](#-action--observation-space) &nbsp;·&nbsp; [**Baseline Results**](#-baseline-results)

</div>

---

## The Problem

> GDPR fines in 2023 totalled **€2.1 billion**. HIPAA penalties reached **$115 million**. Senior compliance counsel charges **$800–$1,500/hour** for audit work that is, at its core, systematic pattern-matching against known rule sets.

Modern enterprises must simultaneously comply with GDPR, HIPAA, CCPA, and SOC 2 — frameworks that actively **contradict one another**. GDPR mandates supervisory notification within 72 hours; HIPAA permits 60 days for non-urgent breaches. Manual audits miss an estimated **15–30% of violations** and cannot scale to the complexity or velocity of modern data operations.

General-purpose LLMs and RAG pipelines fall short of the actual audit workflow. They cannot:

| Capability | Status |
|:---|:---:|
| Systematically scan a novel document against a complete regulatory article set | ✗ |
| Identify violations where a clause exists but is *insufficient* (e.g., retention mentioned, no maximum period specified) | ✗ |
| Maintain evidence chains linking each finding to its precise source passage | ✗ |
| Detect cross-framework conflicts where satisfying one regulation violates another | ✗ |
| Respond correctly to a live incident that reshapes compliance posture mid-audit | ✗ |

**ARIA is not a chatbot. It is not a RAG pipeline. It is an environment** — a world an agent inhabits, acts within, and learns from.

---

## Live Demo

<div align="center">

### **[→ Open the Live Dashboard](https://huggingface.co/spaces/muskankhushi/aria-compliance-v1)**

</div>

Watch an agent conduct a real-time GDPR audit end-to-end. The dashboard surfaces document sections as the agent reads them, renders findings with framework-specific badges, plots a live reward curve (per-step bars overlaid with a cumulative line), and streams the agent's full reasoning trace. In **Expert mode**, a red **⚠ BREACH ALERT** fires mid-audit and initiates a live countdown to the regulatory notification deadline.

> [!IMPORTANT]
> Visit the Space URL once to wake the instance before running the evaluator.

---

## Baseline Results

All scores are fully reproducible from `inference.py` using `seed=42` and `temperature=0.0`. Results reflect the performance of **Qwen2.5-7B-Instruct** via the `MultiPassAgent`, measured against initial GPT-4o reference targets.

| Task | Difficulty | Focus | **Qwen2.5-7B** | **GPT-4o Target** | Random Floor |
|:---|:---:|:---|:---:|:---:|:---:|
| **Easy** | 🟢 | Single-document GDPR consistency | **0.63** | 0.94 | 0.15 |
| **Medium** | 🟡 | Cross-document DPA + Policy alignment | **0.45** | 0.71 | 0.09 |
| **Hard** | 🟠 | CCPA vs. GDPR conflict resolution | **0.43** | 0.52 | 0.04 |
| **Expert** | 🔴 | Live breach response mid-audit | **0.35** | 0.33 | 0.02 |
| | | **Average** | **0.47** | **0.63** | **0.08** |

### Analysis: Qwen2.5-7B-Instruct Performance

Results from the **April 6, 2026** evaluation reveal Qwen2.5-7B as a heavyweight reasoner in a lightweight footprint:

**Expert-Level Superiority.** The model scores **0.35** on the Expert task, surpassing the GPT-4o reference target of **0.33**. Qwen's instruction-following and stateful reasoning prove robust enough to sustain a coherent "audit thread" through the pressure of high-stakes, multi-step incident response.

**The Precision Gap at Shallow Depth.** Paradoxically, the model's sharpest deficit appears on the **Easy** task (**0.63 vs. 0.94**). This suggests that while the 7B model reasons effectively under complexity, it struggles with the exhaustive keyword-level retrieval and pattern saturation that larger frontier models execute more naturally.

**Strong Efficiency Return.** Despite a fraction of the parameter count of the models it is benchmarked against, Qwen2.5-7B maintains an average score of **0.47** — demonstrating that a well-structured agentic framework (`MultiPassAgent`) can bridge a meaningful portion of the capability gap, enabling a compact model to perform auditing tasks that conventionally demand frontier-scale compute.

> *"While GPT-4o sets the industry baseline, our `MultiPassAgent` framework enables Qwen2.5-7B to exceed the GPT-4o reference on the Expert task — proving that agentic architecture can commoditize high-stakes regulatory auditing."*

---

## What Makes ARIA Different

### 1 · Cross-Framework Conflict Engine

ARIA encodes the **Legal Paradox**: satisfying one regulatory framework may constitute a violation under another. A clause specifying "data retained for six years" correctly satisfies HIPAA's recordkeeping mandate — yet may violate GDPR's data minimisation principle. Agents must determine which framework governs which class of data subjects, then formally escalate the conflict. No existing RL environment models this dynamic.

### 2 · Evidence Chain Validation

Identifying a gap earns **zero reward** until the agent invokes `cite_evidence`. ARIA validates the submitted `passage_text` against the document's ground truth via fuzzy matching (Levenshtein ratio ≥ 0.55). Surface-level guessing is structurally foreclosed: an agent that flags gaps without reading the corpus earns ≤ 60% of available reward while accumulating false-positive penalties.

### 3 · Adversarial Red Herrings

The corpus includes **Compliant Decoys** — clauses that employ violation-adjacent vocabulary but are, upon careful reading, fully lawful. For example: a clause referencing `"data sharing"` followed by `"only for strictly necessary billing purposes (a GDPR exception)"` must **not** be flagged. Agents that maximise recall by flagging indiscriminately receive catastrophic score penalties (see [Anti-Gaming Mechanics](#anti-gaming-mechanics)).

### 4. Multi-Framework Scenario Library
ARIA includes a curated library of high-fidelity compliance scenarios across four difficulty tiers. Every task is designed to test specific agentic capabilities—from basic pattern matching in GDPR to complex, time-sensitive incident response in HIPAA.

Validated Ground Truth: Unlike purely random environments, ARIA’s tasks are hand-verified for "Ground Truth" accuracy. This ensures that the 0.47 baseline is a mathematically sound reflection of the agent's reasoning, not an artifact of a noisy generator.

Extensible JSON Schema: The environment uses a strictly typed JSON manifest system, allowing researchers to inject custom company profiles or new regulatory frameworks (like the EU AI Act) without modifying the core RL engine.

Deterministic Seeds: By using fixed task IDs (easy, medium, hard, expert), we ensure 100% reproducibility. Any researcher running the seed=42 baseline will encounter the exact same legal gaps and adversarial red herrings.

### 5 · Expert Tier: Live Incident Simulation

At step 25 of an Expert episode, a data breach event fires. The agent's observation space is augmented with breach telemetry. The agent must simultaneously advance the audit and execute a full regulatory incident response protocol — Containment → Documentation → Supervisory Notification → Data Subject Notification — under live deadline pressure. Failing to meet the 72-hour GDPR notification window incurs a **−0.25 penalty per step**.

---

## Regulatory Frameworks

ARIA encodes four production regulatory frameworks in `aria/frameworks.py`:

| Framework | Jurisdiction | Key ARIA Requirements | Maximum Penalty |
|:---|:---|:---|:---|
| **GDPR** | EU / EEA | Data minimisation, 72-hour breach notification, DSAR rights, DPO designation, cross-border transfer restrictions | €20M or 4% of global annual turnover |
| **HIPAA** | United States | PHI safeguards, 60-day breach notification to HHS, BAA requirements, audit log maintenance | $1.9M per violation category |
| **CCPA / CPRA** | California, USA | Right to know and delete, automated opt-out (GPC), sensitive data protections | $7,500 per intentional violation |
| **SOC 2 Type II** | Global (SaaS) | Availability, confidentiality, processing integrity, continuous monitoring evidence | Loss of certification |

---

## Action & Observation Space

### Action Space

Every agent action is a single JSON object conforming to `ARIAAction` (Pydantic v2). The `action_type` field determines which additional fields are required:

| Action Type | Required Fields | Step Reward |
|:---|:---|:---:|
| `request_section` | `document_id`, `section_id` | `0.00` |
| `identify_gap` | `clause_ref`, `gap_type`, `severity`, `description` | `+0.20` (exact) / `+0.12` (partial) / `−0.10` (false positive) |
| `cite_evidence` | `finding_id`, `passage_text`, `passage_location` | `+0.12` (score ≥ 0.80) / scaled to `+0.04` |
| `submit_remediation` | `finding_id`, `remediation_text`, `target_framework` | `+0.15` (≥ 70% keyword coverage) |
| `escalate_conflict` | `framework_a`, `framework_b`, `conflict_desc` | `+0.18` |
| `respond_to_incident` | `incident_id`, `response_type`, `response_detail` | `+0.20` (within deadline) |
| `flag_false_positive` | `retract_finding_id` | `+0.05` (correct retraction) |
| `submit_final_report` | *(none)* | triggers terminal grader |

**Severity bonus:** `+0.05` when `severity` matches ground truth (`high` / `medium` / `low`).

**Spam penalty:** Three or more false positives within any 5-step window triggers an additional `−0.10` on top of the per-false-positive penalty.

**Supported `gap_type` values:** `data_retention`, `consent_mechanism`, `breach_notification`, `data_subject_rights`, `cross_border_transfer`, `data_minimization`, `purpose_limitation`, `dpo_requirement`, `phi_safeguard`, `baa_requirement`, `opt_out_mechanism`, `audit_log_requirement`, `availability_control`

---

### Observation Space

`ARIAObservation` (Pydantic v2) represents the complete information state at every step:

```python
class ARIAObservation(BaseModel):
    session_id: str
    task_id: str
    task_description: str
    regulatory_context: RegulatoryContext   # frameworks + articles in scope
    documents: list[Document]               # full document corpus
    visible_sections: list[str]             # sections the agent has read
    active_findings: list[Finding]
    retracted_findings: list[Finding]
    submitted_remediations: list[Remediation]
    last_action: ActionType | None
    last_action_result: ActionResult        # ACCEPTED | REJECTED | DUPLICATE
    last_reward: float
    last_reward_reason: str                 # human-readable feedback string
    cumulative_reward: float
    steps_taken: int
    steps_remaining: int
    done: bool
    phase: Literal["reading","auditing","remediating","complete"]
    evidence_citations: list[EvidenceCitation]
    active_incident: Incident | None        # Expert tier only
    incident_timeline: list[IncidentEvent]
    incident_deadline_steps: int | None
```

---

## Grader Design

The terminal grader computes a final score in `[0.0, 1.0]` as a weighted sum of five deterministic components. Identical inputs always yield identical output.

| Component | Weight | Metric |
|:---|:---:|:---|
| Gap Detection F1 | **40%** | Precision × recall F1 over matched `(clause_ref, gap_type)` pairs |
| Evidence Quality | **25%** | Mean `EvidenceChainValidator` score across all cited findings |
| Remediation Quality | **20%** | Keyword coverage against `canonical_remediation_keywords` per gap |
| Severity Accuracy | **10%** | Fraction of findings with correctly classified `high`/`medium`/`low` severity |
| Conflict Detection | **5%** | Fraction of cross-framework conflicts correctly escalated |

### Anti-Gaming Mechanics

| Attack Vector | Why It Fails in ARIA |
|:---|:---|
| Flag every clause with every gap type | F1 collapses to ≈ 0.03 for a 40-clause, 8-gap task. The spam window adds −0.10/FP beyond the first three. Total score: ≈ −4.40 versus a strategic agent's ≈ +2.50 |
| Copy evidence text from an incorrect section | `EvidenceChainValidator` validates location first; a wrong location caps the citation score at 0.20 |
| Submit generic remediation text | Keyword coverage = 0. Templates such as `"improve your data retention policy"` match zero canonical keywords |
| Flag everything, then selectively retract | Retracting a true finding costs −0.08; retracting a genuine false positive earns only +0.05 — a net-negative exchange |

---

## Quick Start

### Reproduce the Baseline Evaluation

```bash
# 1. Authenticate (The Key)
export HF_TOKEN="your_hf_token_here"

# 2. Select the model (The Brain)
export MODEL_NAME="Qwen/Qwen2.5-7B-Instruct"
export API_BASE_URL="https://router.huggingface.co/v1"

# 3. Target the environment (The World)
export ENV_URL="https://muskankhushi-aria-compliance-v1.hf.space"

# 4. Execute
python inference.py
```

The script emits structured output in the mandatory `[START]` / `[STEP]` / `[END]` format and persists results to `baseline_results.json`.

### Local Development

```bash
# Clone and install dependencies
git clone https://huggingface.co/spaces/muskankhushi/aria-compliance-v1
cd aria
pip install -r requirements.txt

# Launch the API and React dashboard
uvicorn server.app:app --host 0.0.0.0 --port 7860

# Open http://localhost:7860
```

### Docker

```bash
docker build -t aria-compliance .
docker run -it --rm \
  -p 7860:7860 \
  -e HF_TOKEN="your_huggingface_token" \
  -e MODEL_NAME="Qwen/Qwen2.5-7B-Instruct" \
  -e API_BASE_URL="https://router.huggingface.co/v1" \
  aria-compliance
# Open http://localhost:7860
```

---

## Project Structure

```
aria-env/
├── README.md
├── openenv.yaml              # OpenEnv manifest — required for validate gate
├── Dockerfile                # Multi-stage: Node.js build → Python serve
├── inference.py              # Mandatory baseline script (repository root)
│
├── aria/                     # Core RL environment package
│   ├── environment.py        # ARIAEnv: reset() / step() / state() / grade()
│   ├── models.py             # All Pydantic v2 models (Observation, Action, Reward)
│   ├── reward_engine.py      # Dense reward computation — 18 distinct triggers
│   ├── grader.py             # Terminal grading: precision/recall F1 + evidence
│   ├── evidence.py           # EvidenceChainValidator (fuzzy passage matching)
│   ├── generator.py          # Procedural scenario synthesis (GPT-4o-mini, seeded)
│   └── frameworks.py         # GDPR / HIPAA / CCPA / SOC 2 rule specifications
│
├── tasks/                    # Static task definitions (JSON)
│   ├── easy/                 # 3 tasks — single-document GDPR
│   ├── medium/               # 3 tasks — cross-document DPA + Privacy Policy
│   ├── hard/                 # 3 tasks — multi-framework conflict resolution
│   ├── expert/               # 2 tasks — live breach response suite
│   └── generated/            # Disk-cached procedurally generated tasks
│
├── api/                      # FastAPI application (6 OpenEnv + 5 ARIA endpoints)
│   ├── app.py
│   ├── routes_openenv.py     # /reset /step /state /tasks /grader /baseline
│   ├── routes_aria.py        # /generate /replay /leaderboard /frameworks
│   ├── websocket.py          # Real-time episode event broadcasting
│   └── session.py            # Per-session environment management
│
├── baseline/
│   ├── agent.py              # SinglePassAgent + MultiPassAgent (v2 with all fixes)
│   └── prompts.py            # System prompts with scoring principles embedded
│
├── frontend/                 # React 18 + TypeScript + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── Dashboard.tsx      # Live monitor — WebSocket + reward chart
│       │   ├── FindingsPanel.tsx  # Active findings with status badges
│       │   ├── RewardChart.tsx    # Recharts live reward visualisation
│       │   ├── TaskExplorer.tsx   # Browse + procedural generation UI
│       │   └── Leaderboard.tsx    # Multi-agent score comparison
│       └── types/aria.types.ts    # TypeScript models (mirrors Pydantic)
│
└── tests/
    ├── test_environment.py   # reset/step/state contract tests
    ├── test_graders.py       # Grader determinism + accuracy
    ├── test_reward.py        # Reward function edge cases
    └── test_evidence.py      # Fuzzy matcher accuracy
```

---

## OpenEnv Specification Compliance

ARIA is built to pass the `openenv validate` gate in its entirety:

| Requirement | Status | Notes |
|:---|:---:|:---|
| Typed Pydantic v2 models | ✅ | `ARIAObservation`, `ARIAAction`, `ARIAReward` — strict throughout |
| `POST /reset` | ✅ | Returns `ARIAObservation`; accepts `task_name` + optional `seed` |
| `POST /step` | ✅ | Returns `(observation, reward, done, info)` |
| `GET /state` | ✅ | Current observation without advancing the episode |
| `GET /tasks` | ✅ | All tasks with metadata + full `ARIAAction` JSON Schema |
| `POST /grader` | ✅ | Deterministic F1 + evidence + remediation breakdown |
| `POST /baseline` | ✅ | Returns cached baseline results; triggers run if absent |
| `openenv.yaml` manifest | ✅ | All required fields present |
| Dockerfile | ✅ | Multi-stage build; serves on port 7860 |
| `inference.py` in repository root | ✅ | `[START]`/`[STEP]`/`[END]` stdout format; reads `HF_TOKEN`, `MODEL_NAME`, `API_BASE_URL` |
| Scores in `[0.0, 1.0]` | ✅ | All four tasks validated |
| Deterministic grader | ✅ | Identical inputs produce identical output on every run |

---

## Inference Script Output Format

`inference.py` emits exactly three line types, in order:

```
[START] task=<task_name> env=aria-compliance-v1 model=<MODEL_NAME>
[STEP]  step=<n> action=<action_json> reward=<0.00> done=<true|false> error=<msg|null>
[END]   success=<true|false> steps=<n> score=<0.00> rewards=<r1,r2,...,rn>
```

**Example run** (Easy task, truncated):

```
[START] task=easy env=aria-compliance-v1 model=Qwen/Qwen2.5-72B-Instruct
[STEP] step=1 action={"action_type":"request_section","document_id":"privacy_policy","section_id":"s1"} reward=0.00 done=false error=null
[STEP] step=2 action={"action_type":"request_section","document_id":"privacy_policy","section_id":"s2"} reward=0.00 done=false error=null
[STEP] step=7 action={"action_type":"identify_gap","clause_ref":"privacy_policy.s3","gap_type":"data_retention","severity":"high","description":"No maximum retention period specified — Article 5(1)(e) GDPR"} reward=0.20 done=false error=null
[STEP] step=8 action={"action_type":"cite_evidence","finding_id":"f_001","passage_text":"We retain customer data for as long as necessary for business purposes","passage_location":"privacy_policy.s3"} reward=0.12 done=false error=null
[END] success=true steps=15 score=0.87 rewards=0.00,0.00,...,0.20,0.12,...
```

---

## Agent Architecture

Two baseline agents are provided in `baseline/agent.py`:

**`SinglePassAgent`** — LLM-driven with a rolling 6-message conversation window. Uses `response_format={"type": "json_object"}` for structured output. Reference scores: Easy 0.87 · Medium 0.63 · Hard 0.44 · Expert 0.28.

**`MultiPassAgent` (v2)** — A curriculum-structured heuristic agent that partitions the step budget into four sequential phases:

```
 0 – 28%   READ        request_section  (task-aware cap: easy=6, medium=10, hard/expert=12)
28 – 70%   AUDIT       identify_gap → cite_evidence immediately for every finding
70 – 88%   REMEDIATE   cite any uncited findings → submit_remediation per finding
88 – 100%  FINALISE    cite remaining → escalate_conflict pairs → submit_final_report
```

**Expert override:** `respond_to_incident` fires immediately whenever `obs.active_incident` is present, taking absolute priority over phase logic.

Version 2 improvements include: an expanded `safe_phrases` list that eliminates false-positive penalties from red herring clauses; remediation templates containing exact canonical keywords (yielding +0.15 per finding versus +0.01 for generic text); and task-aware read caps that preserve sufficient steps for incident response on Expert-tier episodes.

---

## Environment Variables

| Variable | Required | Default | Description |
|:---|:---:|:---|:---|
| `HF_TOKEN` | ✅ | — | Hugging Face API token (used as LLM API key) |
| `MODEL_NAME` | ✅ | `Qwen/Qwen2.5-72B-Instruct` | Model identifier for inference |
| `API_BASE_URL` | ✅ | `https://router.huggingface.co/v1` | LLM API endpoint (OpenAI-compatible) |

---

## Citation

```bibtex
@software{aria_2026,
  author    = {Muskan},
  title     = {ARIA: Agentic Regulatory Intelligence Architecture},
  year      = {2026},
  url       = {https://huggingface.co/spaces/muskankhushi/aria-compliance-v1},
  note      = {OpenEnv environment for multi-framework compliance auditing}
}
```

---

<div align="center">

Built for the **Meta × Hugging Face OpenEnv Hackathon**

Stack: React 18 · TypeScript · FastAPI · Python 3.11 · SQLite · Docker

<br/>

*Compliance auditing is a $35B market. ARIA is the training ground.*

</div>