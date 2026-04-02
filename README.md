````markdown
# ARIA — Agentic Regulatory Intelligence Architecture

[![OpenEnv](https://img.shields.io/badge/OpenEnv-Compliant-2563EB)](https://github.com/huggingface/openenv)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![Model: Llama 3 Ready](https://img.shields.io/badge/Model-Llama_3_Ready-0466c8.svg)](#)

> **The first reinforcement learning environment for training and benchmarking AI agents on multi-framework regulatory compliance auditing.**

---

## What Is This?

ARIA is a **training environment for AI agents**. Think of it like a gym for AI — instead of teaching a robot to walk, we're teaching an AI to do complex compliance audits.

**The real-world problem:** Companies must comply with regulations like GDPR (EU data privacy), HIPAA (US healthcare), CCPA (California), and SOC 2 (security). Checking whether a company's legal documents actually comply with these regulations costs **$800–$1,500/hour** for senior lawyers and takes weeks. 80% of that work is repetitive pattern-matching — exactly what AI is good at.

**What ARIA does:** It gives an AI agent a set of company policy documents (privacy policies, vendor agreements, security specs) and asks it to find every compliance violation, provide evidence, and suggest fixes — just like a real compliance auditor would.

---

## Quick Start (5 minutes)

### Prerequisites
- Python 3.11 or higher
- Git

### Step 1: Clone the repo
```bash
git clone [https://github.com/muskan-khushi/aria-env](https://github.com/muskan-khushi/aria-env)
cd aria-env
````

### Step 2: Install dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Set your API variables (Provider Agnostic)

ARIA supports OpenAI, Groq, and Hugging Face Serverless endpoints out of the box. For ultra-fast Llama 3 inference via Groq:

```bash
export GROQ_API_KEY="gsk_your_key_here"
export API_BASE_URL="[https://api.groq.com/openai/v1](https://api.groq.com/openai/v1)"
export MODEL_NAME="llama3-70b-8192"
```

### Step 4: Verify everything works

```bash
python -m pytest tests/ -v
# You should see 49 tests pass perfectly
```

### Step 5: Start the Server & React Dashboard

```bash
uvicorn api.app:app --host 0.0.0.0 --port 7860
# Open http://localhost:7860 in your browser to view the ARIA Live Monitor
```

### Step 6: Run the Baseline Live Demo

In a separate terminal, trigger the live demo to watch the agent play the environment in real-time on your dashboard:

```bash
python run_live_demo.py
```

-----

## How ARIA Works (Beginner Explanation)

### The Basic Loop

ARIA works like a game with turns:

```
1. You call /reset  →  ARIA gives the agent a set of documents to audit
2. Agent reads a document section  →  ARIA says "OK, here's the content"
3. Agent finds a violation  →  ARIA says "+0.20 reward, correct!"
4. Agent cites the evidence  →  ARIA says "+0.12 reward, good evidence"
5. Agent proposes a fix  →  ARIA says "+0.15 reward, solid remediation"
6. Agent submits final report  →  ARIA grades the whole episode (0.0–1.0)
```

This is called a **step/reset loop** and is the standard interface for RL environments.

### The Three-Layer Architecture

```
┌─────────────────────────────────────────────┐
│  React Frontend  (Dashboard UI)             │
│  Live Recharts reward curve, findings       │
│  panel, auto-scrolling reasoning log        │
└──────────────────┬──────────────────────────┘
                   │ REST + WebSockets
┌──────────────────▼──────────────────────────┐
│  FastAPI Backend  (The API Layer)           │
│  POST /reset  POST /step  GET /state        │
│  GET /tasks   POST /grader  POST /baseline  │
└──────────────────┬──────────────────────────┘
                   │ Python function calls
┌──────────────────▼──────────────────────────┐
│  Python RL Environment  (The Physics Engine)│
│  ARIAEnv  RewardEngine  Grader              │
│  Curriculum Agent  Framework Registry       │
└─────────────────────────────────────────────┘
```

-----

## The Four Regulatory Frameworks

ARIA implements four real regulations. The environment handles all the rules:

| Framework | What It Covers | Key Requirement in ARIA |
|-----------|---------------|------------------------|
| **GDPR** | EU data privacy | 72-hour breach notification, consent, data retention limits |
| **HIPAA** | US healthcare data | PHI safeguards, Business Associate Agreements, audit logs |
| **CCPA** | California consumer rights | Opt-out of data sale, right to delete, right to know |
| **SOC 2** | Cloud/SaaS security | Availability commitments, access controls, monitoring |

-----

## The Four Tasks (Easy → Expert)

### 🟢 Easy — Basic GDPR Audit (15 steps)

**Documents:** 1 (Privacy Policy)
**Violations to find:** 3  |  **Red herrings:** 2
**What makes it easy:** Violations are obvious. No cross-framework reasoning needed.

### 🟡 Medium — Cross-Framework Review (25 steps)

**Documents:** 2 (Privacy Policy + Data Processing Agreement)
**Violations to find:** 5  |  **Red herrings:** 2
**Conflicts:** 1 (GDPR vs CCPA opposite consent models)
**What makes it harder:** The agent must connect information across multiple documents.

### 🟠 Hard — Multi-Framework Conflict Resolution (40 steps)

**Documents:** 4 (Privacy Policy + Vendor Agreement + Technical Spec + Data Map)
**Violations to find:** 8  |  **Red herrings:** 3
**Conflicts:** 2 (GDPR vs HIPAA timelines)
**What makes it hard:** Red herrings require careful reading. The agent needs strong precision.

### 🔴 Expert — Incident Response Suite (60 steps)

**Documents:** 5 complex policies
**Violations to find:** 10  |  **Red herrings:** 3  |  **Conflicts:** 3
**Live incident:** At exactly 50% step budget, a data breach fires mid-episode. The agent must simultaneously continue auditing AND respond to the breach within regulatory deadlines.

-----

## Action Space (What the Agent Can Do)

| Action | Required Fields | Reward | When to Use |
|--------|----------------|--------|-------------|
| `request_section` | `document_id`, `section_id` | 0.00 | Phase 1: Read every section before judging |
| `identify_gap` | `clause_ref`, `gap_type`, `severity` | +0.20 | Found a violation — flag it |
| `cite_evidence` | `finding_id`, `passage_text`, `passage_location` | +0.12 | Back up your finding with exact text |
| `submit_remediation` | `finding_id`, `remediation_text` | +0.15 | Propose a specific fix |
| `escalate_conflict` | `framework_a`, `framework_b`, `conflict_desc` | +0.18 | Two regulations conflict on same clause |
| `respond_to_incident` | `incident_id`, `response_type` | +0.20 | Expert mode: live breach response |
| `flag_false_positive` | `retract_finding_id` | +0.10 | Self-correction: Retract a false positive |
| `submit_final_report` | *(none)* | triggers grading | Done — end the episode |

**Penalties:**

  - Flagging a compliant clause: **-0.10**
  - Redundant action (e.g., reading a section twice): **-0.05**
  - Malformed action (missing fields): **-0.05**
  - Phase Violation (Remediating before finding gaps): **-0.05**

-----

## Grading & Baseline Scores

At episode end, `POST /grader` calculates a deterministic score from 0.0 to 1.0 based on Gap Detection F1, Evidence Quality, Remediation Quality, and Severity Accuracy.

These are the baseline scores using the included `MultiPassAgent` curriculum heuristic.

| Task | Difficulty | Llama 3 70B / GPT-4o-mini | Random Floor |
|------|------------|---------------------------|--------------|
| Basic GDPR | Easy | **0.87 - 0.94** | 0.15 |
| Cross-Framework | Medium | **0.63 - 0.71** | 0.09 |
| Multi-Framework | Hard | **0.44 - 0.52** | 0.04 |
| Incident Suite | Expert | **0.28 - 0.33** | 0.02 |

-----

## Hugging Face Spaces & Docker Deployment

Deploy the entire stack (React UI + FastAPI + RL Environment) instantly:

```bash
# Build
docker build -t aria-env .

# Run with custom LLM Provider
docker run -e HF_TOKEN=$HF_TOKEN -e API_BASE_URL=$API_BASE_URL -e MODEL_NAME=$MODEL_NAME -p 7860:7860 aria-env
```

For **Hugging Face Spaces**: Set the SDK to **Docker**, push the repo, and add your API keys to the Repository Secrets. It will automatically bind to port 7860.

-----

## What Makes ARIA Novel

1.  **Provider-Agnostic Engine** — Runs flawlessly on OpenAI, Hugging Face Serverless, or Groq LPUs.
2.  **Evidence Chain Validation** — The agent must quote the exact offending text, fuzzy-matched against the real document. No lucky guessing allowed.
3.  **Red Herrings** — Compliant clauses deliberately designed to look like violations to punish trigger-happy LLMs. Precision matters.
4.  **Live Incident Simulation** — The environment dynamically injects a data breach mid-audit in the Expert tier, forcing the agent to handle real-time regulatory deadlines.
5.  **Dense Reward Signal** — 18 distinct reward and penalty types. Every single action teaches the agent something. No sparse, silent steps.

-----

## License

MIT — see [LICENSE](https://www.google.com/search?q=LICENSE)

-----

## Citation

```bibtex
@software{aria_env_2026,
  title  = {ARIA: Agentic Regulatory Intelligence Architecture},
  author = {Muskan},
  year   = {2026},
  url    = {[https://github.com/muskan-khushi/aria-env](https://github.com/muskan-khushi/aria-env)}
}
```

```
```