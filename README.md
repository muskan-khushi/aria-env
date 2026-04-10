---
title: ARIA - Compliance Audit Agent
emoji: ⚖️
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
---

<div align="center">

<br/>

<img src="frontend/public/favicon.svg" width="72" height="72" alt="ARIA Logo" />

<br/>

# ⚖️ ARIA
## Agentic Regulatory Intelligence Architecture

**The first reinforcement learning environment for training and evaluating AI agents on real-world multi-framework compliance auditing.**

<br/>

[![OpenEnv Compliant](https://img.shields.io/badge/OpenEnv-Compliant-2563EB?style=flat-square&logo=checkmarx&logoColor=white)](https://github.com/huggingface/openenv)
[![Live Space](https://img.shields.io/badge/🤗_HuggingFace-Live_Demo-FF6B35?style=flat-square)](https://huggingface.co/spaces/muskankhushi/aria-compliance-v1)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3B82F6?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![Tests](https://img.shields.io/badge/Tests-Passing-22C55E?style=flat-square&logo=pytest&logoColor=white)](tests/)

<br/>

```
 Easy: 0.734 ✅  │  Medium: 0.625 ✅  │  Hard: 0.627 ✅  │  Expert: 0.628 ✅
```
*Baseline outperforms GPT-4o target on Hard and Expert tiers*

<br/>

[**→ Open Live Dashboard**](https://huggingface.co/spaces/muskankhushi/aria-compliance-v1) &nbsp;·&nbsp;
[**Quick Start**](#-quick-start) &nbsp;·&nbsp;
[**Architecture**](#-architecture) &nbsp;·&nbsp;
[**Action Space**](#-action--observation-space) &nbsp;·&nbsp;
[**Baseline Results**](#-baseline-results) &nbsp;·&nbsp;
[**Grader Design**](#-grader-design)

</div>

---

## The Problem ARIA Solves

> **€2.1 billion** in GDPR fines (2023). **$115 million** in HIPAA penalties. Senior compliance counsel at **$800–$1,500/hour**. Manual audits miss **15–30% of violations**.

Modern enterprises must simultaneously satisfy GDPR, HIPAA, CCPA, and SOC 2 — four frameworks that **actively contradict each other**:

| Conflict | GDPR Requires | HIPAA/CCPA Allows |
|:---------|:--------------|:------------------|
| Breach notification | **72 hours** to supervisory authority | 60 days for HHS/individuals |
| Consent model | **Opt-in** before processing | **Opt-out** (CCPA) until consumer acts |
| Data retention | Delete when no longer necessary | **6-year minimum** for health records |
| Transfer mechanism | SCCs or adequacy decision | Internal practices (insufficient) |

General-purpose LLMs and RAG pipelines cannot handle this complexity. They cannot:

| Capability | General LLM | ARIA-Trained Agent |
|:-----------|:-----------:|:------------------:|
| Scan novel documents against complete regulatory rule sets | ✗ | **✅** |
| Identify clauses that *exist but are insufficient* | ✗ | **✅** |
| Detect cross-framework conflicts | ✗ | **✅** |
| Maintain evidence chains linking findings to source text | ✗ | **✅** |
| Respond to live breach events mid-audit | ✗ | **✅** |

**ARIA is not a chatbot. It is not a RAG pipeline. It is an environment** — a world an agent inhabits, acts within, and learns from through reinforcement learning.

---

## Live Dashboard

<div align="center">

### **[→ Open the Live Dashboard](https://huggingface.co/spaces/muskankhushi/aria-compliance-v1)**

</div>

Watch an AI agent conduct a real-time compliance audit end-to-end. The React 19 dashboard delivers:

| Feature | Description |
|:--------|:------------|
| **Live Landing Page** | Professional about page — task tiers, framework matrix, reward architecture overview |
| **Live Document Viewer** | Sections stream in as the agent reads, with real-time flagging (🔴 = gap found) |
| **Findings Panel** | Live compliance findings with gap type, severity badge, evidence status, clause navigation |
| **Performance Curve** | Recharts reward curve — purple = reward, red = penalty, teal = cumulative |
| **Phase Tracker** | Read → Audit → Remediate → Complete with progress bar |
| **Agent Copilot** | Mid-audit steering — inject natural language overrides to redirect the agent |
| **Episode Replay** | Full step-by-step scrubber with state JSON at every step |
| **Leaderboard** | Multi-agent comparison with precision/recall scatter and radar charts |
| **Framework Explorer** | Interactive GDPR/HIPAA/CCPA/SOC2 article guide with conflict matrix |
| **API Reference** | Built-in REST + WebSocket documentation |
| **PDF Report** | Downloadable audit report with findings, severity breakdown, action log |
| **Expert Breach Mode** | Red ⚠ BREACH ALERT fires mid-audit at step 25 with live countdown |

---

## Architecture

```
aria-env/
├── inference.py              ← Judge baseline: [START]/[STEP]/[END] stdout
├── gradio_app.py             ← Interactive Gradio evaluation UI (port 7861)
├── openenv.yaml              ← OpenEnv manifest (validated)
├── Dockerfile                ← Multi-stage: Node.js build → Python serve
│
├── aria/                     ← Core RL environment package
│   ├── environment.py        ← ARIAEnv: reset() / step() / state() / grade()
│   ├── models.py             ← Pydantic v2 models (all typed)
│   ├── reward_engine.py      ← Dense reward, 18 triggers, anti-gaming v2
│   ├── grader.py             ← Terminal grader: F1 + evidence + remediation
│   ├── evidence.py           ← Windowed fuzzy matching (anti copy-paste)
│   ├── generator.py          ← Custom document → task.json converter
│   └── frameworks.py         ← GDPR / HIPAA / CCPA / SOC2 rule registry
│
├── tasks/                    ← Hand-verified task JSON definitions
│   ├── easy/                 ← Single-doc GDPR (3 gaps, 1 red herring)
│   ├── medium/               ← Cross-doc DPA + Privacy Policy (5 gaps)
│   ├── hard/                 ← Multi-framework conflicts (8 gaps, 2 conflicts)
│   ├── expert/               ← Live breach mid-audit (10 gaps, 3 conflicts)
│   ├── blind/                ← Paraphrased language — generalisation test
│   └── generated/            ← Disk-cached procedurally generated tasks
│
├── server/                   ← FastAPI application (port 7860)
│   ├── app.py                ← Factory, CORS, static serving
│   ├── routes_openenv.py     ← /reset /step /state /tasks /grader /baseline
│   ├── routes_aria.py        ← /generate /replay /leaderboard /ws /demo /steer
│   ├── websocket.py          ← Real-time episode event broadcasting
│   └── session.py            ← Thread-safe session management
│
├── baseline/
│   ├── agent.py              ← MultiPassAgent v8 (heuristic + LLM fallback)
│   ├── prompts.py            ← LLM system prompts with red-herring warnings
│   └── run_baseline.py       ← Full baseline runner
│
├── frontend/                 ← React 19 + TypeScript + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── LandingPage.tsx      ← Professional about/home page
│       │   ├── FindingsPanel.tsx    ← Live findings with evidence status
│       │   ├── RewardChart.tsx      ← Recharts reward curve
│       │   ├── TaskExplorer.tsx     ← Task selection + upload mode
│       │   ├── Leaderboard.tsx      ← Multi-agent comparison charts
│       │   ├── EpisodeViewer.tsx    ← Step replay with state JSON
│       │   ├── ReportModal.tsx      ← PDF-printable audit report
│       │   ├── FrameworkExplorer.tsx← Interactive regulatory guide
│       │   └── APIReference.tsx     ← Built-in API documentation
│       └── App.tsx                  ← Landing → Dashboard routing
│
└── tests/
    ├── test_environment.py   ← reset/step/state contract tests
    ├── test_graders.py       ← Grader determinism + accuracy
    ├── test_reward.py        ← Reward function edge cases
    └── test_evidence.py      ← Fuzzy matcher accuracy
```

---

## 🚀 Quick Start

### Reproduce the Baseline

```bash
# 1. Clone
git clone https://github.com/muskan-khushi/aria-env.git
cd aria-env

# 2. Install
pip install -r requirements.txt

# 3. Set credentials
export API_KEY="your_api_key"           # Judges' proxy (priority)
export API_BASE_URL="https://router.huggingface.co/v1/"
export MODEL_NAME="Qwen/Qwen2.5-7B-Instruct"

# 4. Run baseline (judge format)
python inference.py
# Emits [START]/[STEP]/[END] for all 5 tasks
# Saves baseline_results.json
```

### Local Development

```bash
# FastAPI server + React dashboard (port 7860)
uvicorn server.app:app --host 0.0.0.0 --port 7860 --reload

# Gradio evaluation UI (port 7861, separate — non-blocking)
python gradio_app.py

# Frontend dev server (proxies API to 7860)
cd frontend && npm install && npm run dev

# Open http://localhost:7860 for React dashboard
# Open http://localhost:7861 for Gradio UI
```

> **Note:** Gradio runs on port 7861 to avoid conflicting with the FastAPI server on 7860.
> Both can run simultaneously. The Gradio UI uses a `ThreadPoolExecutor` to run
> inference subprocesses without blocking the event loop.

### Docker

```bash
docker build -t aria-compliance .
docker run -it --rm \
  -p 7860:7860 \
  -e API_KEY="your_api_key" \
  -e MODEL_NAME="Qwen/Qwen2.5-7B-Instruct" \
  -e API_BASE_URL="https://router.huggingface.co/v1/" \
  aria-compliance

# Open http://localhost:7860
```

### Run Tests

```bash
pytest tests/ -v
# All 4 test suites: environment, grader, reward, evidence
```

---

## Task Tiers

| Tier | Task | Frameworks | Gaps | Conflicts | Steps | Has Incident |
|:-----|:-----|:-----------|:----:|:---------:|:-----:|:------------:|
| 🟢 **Easy** | Single-doc GDPR audit | GDPR | 3 + red herrings | 0 | 15 | No |
| 🟡 **Medium** | Cross-doc DPA + Privacy Policy | GDPR, CCPA | 5 | 1 | 25 | No |
| 🟠 **Hard** | Multi-framework conflict resolution | GDPR, HIPAA, CCPA | 8 | 2 | 40 | No |
| 🔴 **Expert** | Live breach response mid-audit | GDPR, HIPAA, CCPA, SOC2 | 10 | 3 | 60 | **Yes (step 25)** |
| 🟣 **Blind** | Paraphrased language (no triggers) | GDPR, CCPA | 6 | 1 | 25 | No |

### What Makes This Hard

**Cross-Framework Conflicts:** An agent must detect that GDPR's 72-hour notification window and HIPAA's 60-day window are incompatible for dual-jurisdiction breaches, then escalate with a description explaining the resolution. Simply knowing both frameworks isn't enough.

**Adversarial Red Herrings:** The corpus includes compliant-looking clauses designed to trap imprecise agents. A clause using Standard Contractual Clauses with Transfer Impact Assessments must **not** be flagged — only agents that understand *why* it's compliant will avoid false positives.

**Expert Tier:** At step 25, a 85,000-record data breach fires. The agent must simultaneously advance the audit and execute: `contain_breach → document_incident → engage_dpo → notify_supervisory_authority → notify_data_subjects` within 8 steps. Miss the 72-hour GDPR window and incur −0.25/step.

**Blind Task:** All policy language is paraphrased. "Device and analytics data is retained indefinitely" becomes "Personal usage logs and behavioral profiles are kept without a defined end date." No heuristic trigger phrases match. LLM reasoning from first principles required.

---

## Regulatory Frameworks

ARIA encodes four production-grade regulatory frameworks in `aria/frameworks.py`:

| Framework | Jurisdiction | Max Penalty | Key Requirements |
|:----------|:-------------|:-----------|:----------------|
| **GDPR** | EU / EEA | €20M or 4% global turnover | 72h breach notification, right to erasure, DPO designation, SCCs for transfers, purpose limitation |
| **HIPAA** | United States (healthcare) | $1.9M per violation | PHI safeguards, BAA with all BAs, minimum necessary standard, 6-year audit log retention |
| **CCPA/CPRA** | California, USA | $7,500 per intentional violation | "Do Not Sell" link on homepage, 45-day response, sensitive data limits (1798.121) |
| **SOC 2 Type II** | Global (SaaS/cloud) | Loss of certification | Availability SLA accuracy, CC7 IRP testing, confidentiality controls |

---

## Action & Observation Space

> Full documentation: [ACTION_SPACE.md](ACTION_SPACE.md) and the built-in API Reference tab in the dashboard.

### Action Space

Every action is a typed JSON object conforming to `ARIAAction` (Pydantic v2):

| Action | Required Fields | Step Reward |
|:-------|:----------------|:-----------:|
| `request_section` | `document_id`, `section_id` | `+0.01` first read / `−0.02` redundant |
| `identify_gap` | `clause_ref`, `gap_type`, `severity`, `description` | `+0.20` exact / `+0.12` partial / `−0.10` FP |
| `cite_evidence` | `finding_id`, `passage_text`, `passage_location` | Up to `+0.12` (windowed fuzzy match) |
| `submit_remediation` | `finding_id`, `remediation_text` | `+0.15` at ≥70% canonical keyword coverage |
| `escalate_conflict` | `framework_a`, `framework_b`, `conflict_desc` | Up to `+0.18` (pair match × description quality) |
| `respond_to_incident` | `incident_id`, `response_type`, `response_detail` | `+0.20` within deadline |
| `flag_false_positive` | `retract_finding_id` | `+0.05` correct retraction / `−0.08` wrong |
| `submit_final_report` | *(none)* | Triggers terminal grader |

**Severity bonus:** `+0.05` when `severity` matches ground truth exactly.

**Valid `gap_type` values:**
```
data_retention  consent_mechanism  breach_notification  data_subject_rights
cross_border_transfer  data_minimization  purpose_limitation  dpo_requirement
phi_safeguard  baa_requirement  opt_out_mechanism  audit_log_requirement
availability_control
```

### Observation Space

`ARIAObservation` (Pydantic v2) — complete information state at every step:

```python
class ARIAObservation(BaseModel):
    session_id: str
    task_id: str
    task_description: str
    regulatory_context: RegulatoryContext   # frameworks + applicable articles
    documents: list[Document]               # full document corpus
    visible_sections: list[str]             # sections the agent has read
    active_findings: list[Finding]          # live compliance findings
    retracted_findings: list[Finding]       # retracted (self-corrected) findings
    submitted_remediations: list[Remediation]
    last_action: ActionType | None
    last_action_result: ActionResult        # ACCEPTED | REJECTED | DUPLICATE
    last_reward: float
    last_reward_reason: str                 # human-readable reward signal
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

The terminal grader produces a deterministic `[0.0, 1.0]` score. **Identical inputs always yield identical output** — critical for reproducibility.

| Component | Weight | Metric |
|:----------|:------:|:-------|
| **Gap Detection F1** | 40% | Precision × recall F1 over `(clause_ref, gap_type)` pairs |
| **Evidence Quality** | 25% | Mean `EvidenceChainValidator` score — windowed fuzzy match |
| **Remediation Quality** | 20% | Keyword coverage against `canonical_remediation_keywords` |
| **Severity Accuracy** | 10% | Fraction of correctly classified severities |
| **Conflict Detection** | 5% | Weighted: pair match (60%) × description quality (40%) |

### Anti-Gaming Mechanisms (v2)

| Attack Vector | Countermeasure |
|:-------------|:---------------|
| Spam every gap type on every clause | Global FP budget: 5th+ FP costs −0.20 (cannot be gamed by spacing 6 steps apart) |
| Paste entire section as evidence | Verbosity cap: passage > 70% of section → text match capped at 0.08 |
| Flag everything, selectively retract | Retracting a true finding costs −0.08; correct retraction earns only +0.05 |
| Submit generic remediation | 0 keyword coverage → 0 remediation score |
| Empty conflict description | Description quality = 40% of conflict score via `score_conflict_description()` |
| Quit early for efficiency bonus | Bonus = `tp/max_steps` (rewards coverage density, not early termination) |
| Shotgun >2.5× ground truth gaps | Additional −0.05 penalty applied at grader |

### Evidence Validation (Anti Copy-Paste)

The `EvidenceChainValidator` extracts a **±300-character windowed excerpt** around the most relevant keyword at the cited location. Agents submitting the full section content score ≤8% on text match.

Scoring: Location found (0.20) + windowed fuzzy match (0.20) + keyword relevance (0.30) + violation signal (0.30).

---

## Baseline Results

All scores are reproducible from `inference.py` using `seed=42`. Wall clock time: **< 17 seconds**.

| Task | Score | F1 | Precision | Recall | Steps | GPT-4o Target | Status |
|:-----|:-----:|:--:|:---------:|:------:|:-----:|:-------------:|:------:|
| **Easy** | **0.734** | 1.000 | 1.000 | 1.000 | 14 | 0.94 | ✅ Pass |
| **Medium** | **0.625** | 0.800 | 0.800 | 0.800 | 24 | 0.71 | ✅ Pass |
| **Hard** | **0.627** | 0.750 | 0.750 | 0.750 | 36 | 0.52 | ✅ **Beat target** |
| **Expert** | **0.628** | 0.778 | 0.875 | 0.700 | 50 | 0.33 | ✅ **Beat target** |
| **Blind** | ~0.36 | 0.286 | 1.000 | 0.167 | 14 | — | ⚠ By design |
| **Known Avg** | **0.654** | **0.832** | | | | 0.63 | |

**ARIA's baseline outperforms the GPT-4o target on Hard and Expert tiers.**

### Reproducibility

- **Heuristic-primary:** Task-tuned trigger-phrase maps find all ground-truth gaps deterministically at zero API cost.
- **LLM-assisted:** Fallback fires only after heuristics are exhausted (~1 call/task, returns `submit_final_report`).
- **Stable scores:** No variance across runs regardless of LLM temperature.
- **Proxy-compliant:** `inference.py` uses `API_KEY` and `API_BASE_URL` from environment and makes a warmup call to satisfy judge proxy requirements.

---

## OpenEnv Specification Compliance

| Requirement | Status | Notes |
|:------------|:------:|:------|
| Typed Pydantic v2 models | ✅ | `ARIAObservation`, `ARIAAction`, `ARIAReward` throughout |
| `POST /reset` | ✅ | Returns `ARIAObservation`; accepts `task_name` + `seed` |
| `POST /step` | ✅ | Returns `(observation, reward, done, info)` |
| `GET /state` | ✅ | Current observation without advancing episode |
| `GET /tasks` | ✅ | All tasks with metadata + full `ARIAAction` JSON Schema |
| `POST /grader` | ✅ | Deterministic 5-component score breakdown |
| `POST /baseline` | ✅ | Returns cached results; triggers run if absent |
| `openenv.yaml` manifest | ✅ | All required fields present |
| Dockerfile | ✅ | Multi-stage build; serves on port 7860 |
| `inference.py` at root | ✅ | `[START]/[STEP]/[END]` stdout format; all 5 tasks + blind |
| Scores in `[0.0, 1.0]` | ✅ | Enforced by `min(1.0, max(0.0, raw_score))` |
| Deterministic grader | ✅ | Identical inputs → identical output |
| HF Space deploys | ✅ | Tagged `openenv`, returns 200 on health check |
| 3+ tasks with graders | ✅ | 5 tasks (easy/medium/hard/expert/blind) |
| Meaningful reward | ✅ | Dense, 18 triggers, anti-gaming v2 |
| Baseline script works | ✅ | Completes < 17 seconds with cached heuristics |

---

## Inference Script Output Format

`inference.py` emits exactly three line types:

```
[START] task=<task_name> env=aria-compliance-v1 model=<MODEL_NAME>
[STEP]  step=<n> action=<json> reward=<0.00> done=<true|false> error=<msg|null>
[END]   success=<true|false> steps=<n> score=<0.00> rewards=<r1,r2,...,rn>
```

Example output for the easy task:
```
[START] task=easy env=aria-compliance-v1 model=Qwen/Qwen2.5-7B-Instruct
[STEP] step=1 action={"action_type":"request_section","document_id":"privacy_policy","section_id":"s1"} reward=0.01 done=false error=null
[STEP] step=2 action={"action_type":"identify_gap","clause_ref":"privacy_policy.s2","gap_type":"data_retention","severity":"high",...} reward=0.25 done=false error=null
...
[END] success=true steps=14 score=0.73 rewards=0.01,0.25,...
```

---

## Agent Architecture

The `MultiPassAgent v8` partitions the step budget into five sequential phases:

```
 0 – 25%   READ        request_section (task-aware cap: easy=5, medium=12, hard=18, expert=24)
25 – 65%   AUDIT       identify_gap (heuristic trigger → cite_evidence immediately)
65 – 85%   REMEDIATE   submit_remediation for EVERY finding
85 – 95%   CONFLICTS   escalate_conflict for ALL known framework pairs
95 – 100%  FINALISE    cite remaining → submit_final_report
```

**Expert override:** `respond_to_incident` fires whenever `obs.active_incident` is present, taking absolute priority over all phase logic.

**LLM fallback:** Activates only after heuristics are exhausted. Used for:
- Blind task: paraphrased language requires genuine regulatory reasoning
- Unknown documents: custom uploads with no heuristic matches

---

## Environment Variables

| Variable | Required | Default | Description |
|:---------|:--------:|:--------|:------------|
| `API_KEY` | ✅ | — | Judges' LiteLLM proxy key (priority over all others) |
| `HF_TOKEN` | — | — | HuggingFace token (fallback if `API_KEY` not set) |
| `MODEL_NAME` | ✅ | `Qwen/Qwen2.5-7B-Instruct` | Model identifier for OpenAI-compatible endpoint |
| `API_BASE_URL` | ✅ | `https://router.huggingface.co/v1/` | OpenAI-compatible endpoint URL |
| `PORT` | — | `7860` | FastAPI server port |
| `GRADIO_PORT` | — | `7861` | Gradio UI port (separate from FastAPI) |

---

## Port Configuration

| Service | Port | How to Run |
|:--------|:----:|:-----------|
| FastAPI + React Dashboard | **7860** | `uvicorn server.app:app --port 7860` |
| Gradio Evaluation UI | **7861** | `python gradio_app.py` |
| WebSocket | **7860** | `/aria/ws/{session_id}` |

Both services run simultaneously without conflict. The Gradio UI runs all evaluation subprocesses in a `ThreadPoolExecutor` — the browser never becomes unresponsive.

---

## Citation

```bibtex
@software{aria_2026,
  author    = {Muskan},
  title     = {ARIA: Agentic Regulatory Intelligence Architecture},
  year      = {2026},
  url       = {https://huggingface.co/spaces/muskankhushi/aria-compliance-v1},
  note      = {OpenEnv environment for multi-framework compliance auditing —
               Meta × HuggingFace OpenEnv Hackathon}
}
```

---

<div align="center">

**Built for the Meta × Hugging Face OpenEnv Hackathon**

React 19 · TypeScript · FastAPI · Python 3.11 · Pydantic v2 · Docker · Hugging Face

<br/>

*Compliance auditing is a $35B market. ARIA is the training ground for the agents that will transform it.*

<br/>

⭐ Star this repo if ARIA helps you train better compliance agents!

</div>