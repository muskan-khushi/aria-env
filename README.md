# ARIA — Agentic Regulatory Intelligence Architecture

[![OpenEnv](https://img.shields.io/badge/OpenEnv-Compliant-2563EB)](https://github.com/huggingface/openenv)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)

> **The first reinforcement learning environment for training and benchmarking AI agents on multi-framework regulatory compliance auditing.**

---

## What Is This?

ARIA is a **training environment for AI agents**. Think of it like a gym for AI — instead of teaching a robot to walk, we're teaching an AI to do compliance audits.

**The real-world problem:** Companies must comply with regulations like GDPR (EU data privacy), HIPAA (US healthcare), CCPA (California), and SOC 2 (security). Checking whether a company's legal documents actually comply with these regulations costs **$800–$1,500/hour** for senior lawyers and takes weeks. 80% of that work is repetitive pattern-matching — exactly what AI is good at.

**What ARIA does:** It gives an AI agent a set of company policy documents (privacy policies, vendor agreements, security specs) and asks it to find every compliance violation, provide evidence, and suggest fixes — just like a real compliance auditor would.

---

## Quick Start (5 minutes)

### Prerequisites
- Python 3.11 or higher
- Git

### Step 1: Clone the repo
```bash
git clone https://github.com/muskan-khushi/aria-env
cd aria-env
```

### Step 2: Install Python dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Set your API key (optional but recommended)
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
# If you don't have one, ARIA still works — the heuristic agent runs without it
```

### Step 4: Verify everything works
```bash
python -m pytest tests/ -v
# You should see 47+ tests pass
```

### Step 5: Start the server
```bash
uvicorn api.app:app --host 0.0.0.0 --port 7860 --reload
# Open http://localhost:7860 in your browser
```

### Step 6 (optional): Run the baseline agent
```bash
python baseline/run_baseline.py
# Runs the AI agent against all 4 tasks and prints scores
```

---

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
│  React Frontend  (what humans see)          │
│  Live reward chart, findings panel,         │
│  document viewer, agent action log          │
└──────────────────┬──────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────────┐
│  FastAPI Backend  (the API layer)           │
│  POST /reset  POST /step  GET /state        │
│  GET /tasks   POST /grader  POST /baseline  │
└──────────────────┬──────────────────────────┘
                   │ Python function calls
┌──────────────────▼──────────────────────────┐
│  Python RL Environment  (the brain)         │
│  ARIAEnv  RewardEngine  Grader              │
│  EvidenceValidator  Frameworks              │
└─────────────────────────────────────────────┘
```

---

## The Four Regulatory Frameworks

ARIA implements four real regulations. You don't need to know them in detail — the environment handles all the rules. But here's a summary:

| Framework | What It Covers | Key Requirement in ARIA |
|-----------|---------------|------------------------|
| **GDPR** | EU data privacy | 72-hour breach notification, consent, data retention limits |
| **HIPAA** | US healthcare data | PHI safeguards, Business Associate Agreements, audit logs |
| **CCPA** | California consumer rights | Opt-out of data sale, right to delete, right to know |
| **SOC 2** | Cloud/SaaS security | Availability commitments, access controls, monitoring |

---

## The Four Tasks (Easy → Expert)

### 🟢 Easy — Basic GDPR Audit (15 steps)
**Company:** CloudNote (small note-taking SaaS)
**Documents:** 1 (Privacy Policy)
**Violations to find:** 3
**Red herrings:** 2 (compliant clauses that look suspicious)
**What makes it easy:** All violations are obvious once you read the document. No cross-framework reasoning needed.

### 🟡 Medium — Cross-Framework Review (25 steps)
**Company:** DataBridge Analytics (marketing analytics)
**Documents:** 2 (Privacy Policy + Data Processing Agreement)
**Violations to find:** 5
**Red herrings:** 2
**Conflicts:** 1 (GDPR vs CCPA — they have opposite consent models)
**What makes it harder:** The agent must read two documents and connect information across them.

### 🟠 Hard — Multi-Framework Conflict Resolution (40 steps)
**Company:** NovaSynth Analytics (HR & health analytics)
**Documents:** 4 (Privacy Policy + Vendor Agreement + Technical Spec + Data Map)
**Violations to find:** 8
**Red herrings:** 3
**Conflicts:** 2 (GDPR vs HIPAA breach timelines, GDPR vs HIPAA data retention)
**What makes it hard:** Red herrings require careful reading. Cross-framework conflicts require knowing both regulations. The agent needs strong precision — GPT-4o scores ~0.44 here.

### 🔴 Expert — Incident Response Suite (60 steps)
**Company:** MediCore Health Platform (patient data SaaS)
**Documents:** 5 (Privacy Policy + Security Policy + Subprocessor List + DPIA + Data Map)
**Violations to find:** 10
**Red herrings:** 3
**Conflicts:** 3
**Live incident:** At step 25, a data breach fires mid-episode. The agent must simultaneously continue auditing AND respond to the breach within regulatory deadlines.
**What makes it expert:** Dual-task under time pressure. GPT-4o-mini scores ~0.28 here.

---

## Action Space (What the Agent Can Do)

Every turn, the agent submits one JSON action. Here are all valid actions:

| Action | Required Fields | Reward | When to Use |
|--------|----------------|--------|-------------|
| `request_section` | `document_id`, `section_id` | 0.00 | Phase 1: Read every section before judging |
| `identify_gap` | `clause_ref`, `gap_type`, `severity` | +0.20 | Found a violation — flag it |
| `cite_evidence` | `finding_id`, `passage_text`, `passage_location` | +0.12 | Back up your finding with exact text |
| `submit_remediation` | `finding_id`, `remediation_text` | +0.15 | Propose a specific fix |
| `escalate_conflict` | `framework_a`, `framework_b`, `conflict_desc` | +0.18 | Two regulations conflict on same clause |
| `respond_to_incident` | `incident_id`, `response_type` | +0.20 | Expert mode: live breach response |
| `flag_false_positive` | `retract_finding_id` | +0.05 | You flagged something wrong — take it back |
| `submit_final_report` | *(none)* | triggers grading | Done — end the episode |

**Penalties:**
- Flagging a compliant clause: **-0.10**
- Duplicate finding: **-0.02**
- Malformed action (missing fields): **-0.05**
- Spamming false positives (3+ in 5 steps): **-0.10 extra**
- Missing incident deadline: **-0.25**

---

## Observation Space (What the Agent Sees)

After every action, the agent receives a JSON observation containing everything it needs:

```json
{
  "session_id": "abc123",
  "task_id": "hard_1",
  "task_description": "Multi-Framework Conflict Resolution — NovaSynth Analytics",
  "regulatory_context": {
    "frameworks_in_scope": ["GDPR", "HIPAA", "CCPA"]
  },
  "documents": [
    {
      "doc_id": "privacy_policy",
      "title": "NovaSynth Privacy Policy v3.2",
      "sections": [
        { "section_id": "s1", "title": "Data Collection", "content": "..." }
      ]
    }
  ],
  "visible_sections": ["privacy_policy.s1", "privacy_policy.s2"],
  "active_findings": [
    {
      "finding_id": "abc12345",
      "clause_ref": "privacy_policy.s3",
      "gap_type": "data_retention",
      "severity": "high",
      "status": "CITED"
    }
  ],
  "last_reward": 0.20,
  "last_reward_reason": "Correct data_retention gap in privacy_policy.s3",
  "cumulative_reward": 1.34,
  "steps_taken": 7,
  "steps_remaining": 33,
  "phase": "auditing",
  "active_incident": null
}
```

**Key fields explained:**
- `visible_sections` — which document sections the agent has already read
- `active_findings` — violations the agent has flagged so far
- `last_reward_reason` — human-readable explanation of what just happened (great for debugging)
- `phase` — `reading` → `auditing` → `remediating` → `complete`
- `active_incident` — only appears in Expert mode when a breach fires

---

## Grading (How Scores Are Calculated)

At episode end, `POST /grader` returns a score from 0.0 to 1.0:

| Component | Weight | What It Measures |
|-----------|--------|-----------------|
| **Gap Detection F1** | 40% | Did you find the real violations without too many false positives? Uses precision/recall F1. |
| **Evidence Quality** | 25% | Did you cite the actual offending text? Fuzzy-matched against the real document. |
| **Remediation Quality** | 20% | Are your fixes specific enough? Checked against domain keywords (e.g. must say "72 hours" not "notify promptly"). |
| **Severity Accuracy** | 10% | Did you correctly classify high/medium/low severity? |
| **Conflict Detection** | 5% | Did you spot the cross-framework conflicts? |

**Example grade response:**
```json
{
  "score": 0.67,
  "f1_score": { "precision": 0.75, "recall": 0.60, "f1": 0.67 },
  "evidence_score": 0.71,
  "remediation_score": 0.58,
  "severity_accuracy": 0.80,
  "conflict_score": 0.50,
  "breakdown": {
    "gap_f1": 0.268,
    "evidence": 0.178,
    "remediation": 0.116,
    "severity": 0.08,
    "conflict": 0.025,
    "efficiency": 0.003
  }
}
```

---

## API Reference

### Required OpenEnv Endpoints

#### `POST /reset`
Start a new episode. Returns the initial observation.

```bash
curl -X POST http://localhost:7860/reset \
  -H "Content-Type: application/json" \
  -d '{"task_name": "easy", "seed": 42}'
```

Response: Full `ARIAObservation` JSON with `session_id`.

---

#### `POST /step`
Submit one action. Returns `(observation, reward, done, info)`.

```bash
curl -X POST http://localhost:7860/step \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: your-session-id-here" \
  -d '{
    "action": {
      "action_type": "request_section",
      "document_id": "privacy_policy",
      "section_id": "s1"
    }
  }'
```

Response:
```json
{
  "observation": { ... },
  "reward": 0.0,
  "done": false,
  "info": {}
}
```

---

#### `GET /state`
Get the current observation without taking an action.

```bash
curl http://localhost:7860/state \
  -H "X-Session-ID: your-session-id-here"
```

---

#### `GET /tasks`
List all available tasks and the full action schema.

```bash
curl http://localhost:7860/tasks
```

Response:
```json
{
  "tasks": [
    {
      "id": "easy",
      "name": "Basic GDPR Audit",
      "difficulty": "easy",
      "max_steps": 15,
      "frameworks": ["GDPR"],
      "num_gaps": 3,
      "has_incident": false
    }
  ],
  "action_schema": { ... }
}
```

---

#### `POST /grader`
Get the final score for a completed episode.

```bash
curl -X POST http://localhost:7860/grader \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: your-session-id-here" \
  -d '{}'
```

---

#### `POST /baseline`
Trigger baseline scoring or get cached results.

```bash
curl -X POST http://localhost:7860/baseline
```

---

### Additional Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/frameworks` | GET | Full GDPR/HIPAA/CCPA/SOC2 article reference |
| `/leaderboard` | GET | All baseline results for comparison |
| `/health` | GET | Server health check |
| `/ws/{session_id}` | WebSocket | Real-time step events for the dashboard |

---

## Running a Full Episode in Python

Here's a complete example — no API key needed:

```python
from aria.environment import ARIAEnv
from aria.models import ARIAAction, ActionType, GapType, Severity

# Create and start the environment
env = ARIAEnv()
obs = env.reset(task_name="easy", seed=42)

print(f"Task: {obs.task_description}")
print(f"Documents: {[d.doc_id for d in obs.documents]}")
print(f"Steps allowed: {obs.steps_remaining}")

# Step 1: Read the data retention section
obs, reward, done, _ = env.step(ARIAAction(
    action_type=ActionType.REQUEST_SECTION,
    document_id="privacy_policy",
    section_id="s3",
))
print(f"\nRead s3 — reward: {reward}")
print(f"Content: {obs.documents[0].sections[2].content[:100]}...")

# Step 2: Flag the data retention violation
obs, reward, done, _ = env.step(ARIAAction(
    action_type=ActionType.IDENTIFY_GAP,
    clause_ref="privacy_policy.s3",
    gap_type=GapType.DATA_RETENTION,
    severity=Severity.HIGH,
    description="No maximum retention period specified. 'As long as necessary' violates Article 5(1)(e).",
))
print(f"\nIdentified gap — reward: {reward}")  # Should be +0.20 or +0.25
print(f"Reason: {obs.last_reward_reason}")

finding_id = obs.active_findings[0].finding_id

# Step 3: Cite the evidence
obs, reward, done, _ = env.step(ARIAAction(
    action_type=ActionType.CITE_EVIDENCE,
    finding_id=finding_id,
    passage_text="We retain your account data for as long as your account is active and for a reasonable period thereafter",
    passage_location="privacy_policy.s3",
))
print(f"\nCited evidence — reward: {reward}")  # Should be +0.04 to +0.12

# Step 4: Submit final report
obs, reward, done, _ = env.step(ARIAAction(
    action_type=ActionType.SUBMIT_FINAL_REPORT,
))
print(f"\nEpisode done: {done}")

# Get the grade
grade = env.grade()
print(f"\nFinal score: {grade.score:.3f}")
print(f"Precision: {grade.f1_score.precision:.3f}")
print(f"Recall: {grade.f1_score.recall:.3f}")
```

---

## Project Structure Explained

```
aria-env/
│
├── aria/                    ← The RL environment (pure Python, no web server)
│   ├── models.py            ← All data types (ARIAObservation, ARIAAction, etc.)
│   │                           Think of this as the "dictionary" — defines what
│   │                           everything looks like
│   │
│   ├── frameworks.py        ← The actual regulatory rules
│   │                           Contains every GDPR article, HIPAA requirement,
│   │                           CCPA right, and SOC 2 criterion, plus known
│   │                           cross-framework conflicts
│   │
│   ├── environment.py       ← The main environment class (ARIAEnv)
│   │                           reset() → starts a new episode
│   │                           step() → takes one action, returns reward
│   │                           state() → peek at current state
│   │                           grade() → final 0.0–1.0 score
│   │
│   ├── reward_engine.py     ← Calculates rewards for every action
│   │                           18 different reward/penalty types
│   │                           Anti-spam detection
│   │
│   ├── grader.py            ← Terminal grader (called at episode end)
│   │                           F1 scoring, evidence quality, remediation quality
│   │
│   └── evidence.py          ← Validates that cited evidence is real
│                               Fuzzy-matches quoted text against actual documents
│
├── api/                     ← The web server (FastAPI)
│   ├── app.py               ← Creates the FastAPI app, serves React frontend
│   ├── routes.py            ← All HTTP endpoints (/reset, /step, /state, etc.)
│   ├── session.py           ← Manages multiple concurrent episodes
│   └── websocket.py         ← Real-time event streaming to the dashboard
│
├── tasks/                   ← The actual compliance scenarios (JSON files)
│   ├── easy/task.json       ← CloudNote GDPR audit
│   ├── medium/task.json     ← DataBridge GDPR+CCPA review
│   ├── hard/task.json       ← NovaSynth multi-framework
│   ├── expert/task.json     ← MediCore with live breach
│   └── generated/           ← Cached procedurally generated tasks
│
├── baseline/                ← The AI agents used for scoring
│   ├── agent.py             ← SinglePassAgent (LLM) + MultiPassAgent (heuristic)
│   ├── prompts.py           ← System prompt and observation formatter
│   └── run_baseline.py      ← Runs both agents on all 4 tasks, saves scores
│
├── tests/                   ← 49 automated tests
│   ├── test_environment.py  ← Tests reset/step/state work correctly
│   ├── test_graders.py      ← Tests grading is fair and deterministic
│   ├── test_reward.py       ← Tests every reward type
│   └── test_evidence.py     ← Tests citation validation
│
├── frontend/                ← React dashboard (built separately)
│
├── Dockerfile               ← Builds everything into one container
├── openenv.yaml             ← OpenEnv spec compliance manifest
├── requirements.txt         ← Python dependencies
└── .env.example             ← Template for your API keys
```

---

## Baseline Scores

These are the expected scores when running the provided agents. The spread from 0.87 → 0.28 proves meaningful difficulty progression — the hard tasks genuinely challenge frontier models.

| Task | Difficulty | GPT-4o-mini (SinglePass) | MultiPass (Heuristic) | Random Floor |
|------|------------|--------------------------|----------------------|--------------|
| Basic GDPR | Easy | **0.87** | 0.94 | 0.15 |
| Cross-Framework | Medium | **0.63** | 0.71 | 0.09 |
| Multi-Framework | Hard | **0.44** | 0.52 | 0.04 |
| Incident Suite | Expert | **0.28** | 0.33 | 0.02 |

**What the 0.44 on Hard means:** GPT-4o-mini finds ~4–5 of the 8 real violations, gets tricked by at least 1–2 red herrings (compliant clauses that look suspicious), and either misses or partially resolves the cross-framework conflicts. This is realistic — it mirrors what an LLM without specialized compliance training actually does.

---

## Docker

Build and run the entire application (backend + frontend) in one container:

```bash
# Build
docker build -t aria-env .

# Run (with OpenAI key for baseline agent)
docker run -e OPENAI_API_KEY=$OPENAI_API_KEY -p 7860:7860 aria-env

# Run without OpenAI key (heuristic agent only)
docker run -p 7860:7860 aria-env
```

Open http://localhost:7860 — you'll see the live dashboard.

---

## Hugging Face Spaces Deployment

1. Create a new Space at [huggingface.co/spaces](https://huggingface.co/spaces)
2. Set SDK to **Docker**
3. Push this repo to the Space
4. Go to Settings → Repository Secrets → add `OPENAI_API_KEY`
5. The Space will build and deploy automatically

The environment runs on port 7860 by default, which is what HF Spaces expects.

---

## Running Tests

```bash
# Run all tests
python -m pytest tests/ -v

# Run just environment tests
python -m pytest tests/test_environment.py -v

# Run just grader tests
python -m pytest tests/test_graders.py -v

# Run with coverage
python -m pytest tests/ --cov=aria --cov-report=term-missing
```

---

## What Makes ARIA Novel

Most OpenEnv submissions will have 3 static JSON files and a simple keyword grader. ARIA has:

1. **Evidence chain validation** — The agent must quote the exact offending text, not just guess. A correct finding without evidence scores 60% less. This prevents lucky guessing.

2. **Red herrings** — Compliant clauses deliberately designed to look like violations. An agent that flags everything gets massacred by false positive penalties. Precision matters.

3. **Cross-framework conflicts** — GDPR requires 72-hour breach notification; HIPAA allows 60 days. The agent must identify when two regulations contradict each other on the same clause.

4. **Live incident simulation** — In the Expert task, a data breach fires mid-episode. The agent must respond in the correct order within regulatory deadlines while continuing the audit.

5. **Dense reward signal** — 18 distinct reward types. Every action teaches the agent something. No silent steps where nothing happens.

6. **Anti-gaming** — Spam detection, duplicate penalties, and F1 scoring mean there's no shortcut. The only winning strategy is careful, evidence-backed, targeted identification.

---

## License

MIT — see [LICENSE](LICENSE)

---

## Citation

```bibtex
@software{aria_env_2026,
  title  = {ARIA: Agentic Regulatory Intelligence Architecture},
  year   = {2026},
  url    = {https://github.com/muskan-khushi/aria-env}
}
```