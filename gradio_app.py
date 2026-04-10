"""
ARIA — Gradio App (HuggingFace Spaces entry point)
Interactive UI wrapper for running inference.py evaluations.
Formal evaluations always run inference.py directly.

FIX: subprocess calls now run in a ThreadPoolExecutor to avoid
blocking the Gradio event loop (which caused the browser
"Page Unresponsive" hang on heavy workloads).
"""
import gradio as gr
import os
import subprocess
import json
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# Thread pool for subprocess calls — prevents Gradio event loop from blocking
_executor = ThreadPoolExecutor(max_workers=2)


def _run_subprocess_blocking(task_name: str) -> str:
    """
    Blocking subprocess call — MUST be run in a thread, not the event loop.
    Returns formatted output string.
    """
    env = os.environ.copy()
    env["TASK_NAME"] = task_name

    try:
        result = subprocess.run(
            ["python", "inference.py"],
            env=env,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
        )
        stdout_output = result.stdout
        stderr_output = result.stderr

        # Extract score summary
        score_summary = ""
        for line in stdout_output.split("\n"):
            if line.startswith("[END]"):
                score_summary = f"\n\n📊 {line}"
                break

        return (
            f"==== STDOUT (Judge-Evaluated Format) ===={score_summary}\n\n"
            f"{stdout_output}\n\n"
            f"==== STDERR (Debug Info) ====\n{stderr_output}"
        )

    except subprocess.TimeoutExpired:
        return "❌ Evaluation timed out after 10 minutes."
    except subprocess.CalledProcessError as e:
        return (
            f"❌ Execution Failed!\n\n"
            f"Exit Code: {e.returncode}\n\n"
            f"STDOUT:\n{e.stdout}\n\n"
            f"STDERR:\n{e.stderr}"
        )
    except Exception as e:
        return f"❌ Unexpected error: {str(e)}"


def run_evaluation(task_name: str) -> str:
    """
    Run evaluation in thread pool to avoid blocking the Gradio event loop.
    This prevents the browser from showing 'Page Unresponsive' notifications.
    """
    future = _executor.submit(_run_subprocess_blocking, task_name)
    try:
        return future.result(timeout=650)  # slightly more than subprocess timeout
    except Exception as e:
        return f"❌ Execution error: {str(e)}"


def run_all_evaluations() -> str:
    """Run the full baseline across all tasks (in thread)."""
    future = _executor.submit(_run_subprocess_blocking, "all")
    try:
        return future.result(timeout=650)
    except Exception as e:
        return f"❌ Execution error: {str(e)}"


def get_baseline_scores() -> str:
    """Return cached baseline scores if available."""
    for path in ["baseline_results.json", "baseline/baseline_results.json"]:
        p = Path(path)
        if p.exists():
            try:
                with open(p) as f:
                    data = json.load(f)
                results = data.get("results", [])
                lines = [f"📊 Model: {data.get('model', 'unknown')}", ""]
                
                known = [r for r in results if r.get('task') != 'blind']
                blind = [r for r in results if r.get('task') == 'blind']
                
                lines.append("── Known Tasks ──────────────────────")
                for r in known:
                    icon = "✅" if r.get("success") else "❌"
                    lines.append(
                        f"{icon} {r['task'].upper():8s} "
                        f"score={r['score']:.3f} | "
                        f"f1={r.get('f1', 0):.3f} | "
                        f"prec={r.get('precision', 0):.3f} | "
                        f"recall={r.get('recall', 0):.3f} | "
                        f"steps={r.get('steps', 0)}"
                    )
                
                if blind:
                    lines.append("\n── Blind Task (Generalisation) ───────")
                    for r in blind:
                        icon = "✅" if r.get("success") else "⚠️"
                        lines.append(
                            f"{icon} BLIND    "
                            f"score={r['score']:.3f} | "
                            f"f1={r.get('f1', 0):.3f} | "
                            f"steps={r.get('steps', 0)}"
                        )
                
                if known:
                    avg = sum(r["score"] for r in known) / len(known)
                    lines.append(f"\n── Average (Known Tasks): {avg:.3f} ──────")
                
                return "\n".join(lines)
            except Exception as e:
                return f"Error reading results: {e}"
    return "No cached results found. Run an evaluation first."


def get_environment_info() -> str:
    """Return environment information."""
    lines = [
        "=== ARIA Environment Status ===",
        "",
        f"Python: {os.popen('python --version').read().strip()}",
        f"Working dir: {os.getcwd()}",
        "",
        "=== Available Tasks ===",
    ]
    
    tasks_dir = Path("tasks")
    if tasks_dir.exists():
        for task_dir in ["easy", "medium", "hard", "expert", "blind"]:
            task_file = tasks_dir / task_dir / "task.json"
            if task_file.exists():
                try:
                    with open(task_file) as f:
                        task = json.load(f)
                    gaps = len(task.get("ground_truth", {}).get("gaps", []))
                    frameworks = ", ".join(task.get("frameworks_in_scope", []))
                    lines.append(f"✅ {task_dir.upper():8s} — {gaps} gaps | {frameworks}")
                except:
                    lines.append(f"⚠️  {task_dir} — could not parse task.json")
            else:
                lines.append(f"❌ {task_dir} — task.json not found")
    
    lines.append("")
    lines.append("=== API Endpoints ===")
    lines.append("POST /reset    — Initialize episode")
    lines.append("POST /step     — Submit action")
    lines.append("GET  /state    — Current observation")
    lines.append("GET  /tasks    — List all tasks")
    lines.append("POST /grader   — Grade episode")
    lines.append("GET  /docs     — Swagger UI")
    lines.append("GET  /redoc    — ReDoc UI")
    
    return "\n".join(lines)


# ── Gradio Interface ─────────────────────────────────────────────────────────

with gr.Blocks(
    title="ARIA — Compliance Audit Agent",
    theme=gr.themes.Soft(primary_hue="violet"),
    css="""
    .main-header { font-size: 28px; font-weight: 800; color: #4C1D95; margin-bottom: 4px; }
    .subtitle { color: #6D28D9; font-size: 14px; }
    .warning-box { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 12px; }
    """
) as demo:
    
    gr.HTML("""
    <div style="text-align:center; padding: 20px 0 10px;">
      <div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:48px;height:48px;background:#6D28D9;border-radius:12px;display:flex;align-items:center;justify-content:center;">
          <svg width="28" height="28" fill="white" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <div>
          <h1 style="font-size:32px;font-weight:900;color:#4C1D95;margin:0;letter-spacing:-1px;">ARIA</h1>
          <p style="color:#6D28D9;font-size:12px;margin:0;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Agentic Regulatory Intelligence Architecture</p>
        </div>
      </div>
      <p style="color:#6B7280;font-size:14px;max-width:600px;margin:0 auto;">
        The first RL environment for multi-framework compliance auditing — 
        <strong>GDPR · HIPAA · CCPA · SOC 2</strong>
      </p>
      <p style="color:#9CA3AF;font-size:12px;margin-top:8px;">
        📊 Formal judge evaluations run <code>inference.py</code> directly · 
        🎮 This interface provides interactive evaluation access
      </p>
    </div>
    """)

    with gr.Tabs():
        with gr.Tab("🚀 Run Evaluation"):
            with gr.Row():
                with gr.Column(scale=1):
                    task_choice = gr.Dropdown(
                        choices=["easy", "medium", "hard", "expert", "blind"],
                        value="medium",
                        label="Select Task Tier",
                        info="Progress from easy to expert for increasing challenge. 'blind' tests true generalisation."
                    )
                    
                    gr.HTML("""
                    <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px;margin:8px 0;">
                      <p style="font-weight:700;color:#5B21B6;margin:0 0 8px;font-size:13px;">Task Difficulty Guide</p>
                      <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">
                        <div>🟢 <strong>Easy</strong> — Single-doc GDPR audit (3 gaps, 1 red herring) · 15 steps</div>
                        <div>🟡 <strong>Medium</strong> — Cross-doc DPA + Privacy Policy (5 gaps) · 25 steps</div>
                        <div>🟠 <strong>Hard</strong> — Multi-framework conflicts (8 gaps, 2 conflicts) · 40 steps</div>
                        <div>🔴 <strong>Expert</strong> — Live breach response mid-audit (10 gaps) · 60 steps</div>
                        <div>🟣 <strong>Blind</strong> — Paraphrased language, tests genuine reasoning · 25 steps</div>
                      </div>
                    </div>
                    """)
                    
                    with gr.Row():
                        run_btn = gr.Button("▶ Run Single Task", variant="primary", scale=2)
                        all_btn = gr.Button("▶▶ All Tasks", variant="secondary", scale=1)
                    
                    gr.HTML("""
                    <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:10px;margin-top:8px;font-size:12px;color:#92400E;">
                      ⏱️ <strong>Timing:</strong> Easy ~3s · Medium ~5s · Hard ~8s · Expert ~12s · All tasks ~25s total
                    </div>
                    """)

                with gr.Column(scale=2):
                    output_display = gr.Textbox(
                        label="Agent Output — [START]/[STEP]/[END] Judge Format",
                        lines=28,
                        max_lines=60,
                        placeholder="Click 'Run Single Task' or 'All Tasks' to begin evaluation...\n\nOutput will appear here in real-time as the agent progresses.",
                    )

            run_btn.click(fn=run_evaluation, inputs=[task_choice], outputs=[output_display])
            all_btn.click(fn=run_all_evaluations, inputs=[], outputs=[output_display])

        with gr.Tab("📊 Baseline Scores"):
            gr.HTML("""<p style="color:#6B7280;font-size:13px;padding:8px 0;">
                Cached baseline scores from <code>baseline_results.json</code>. 
                Run an evaluation to update.
            </p>""")
            results_display = gr.Textbox(label="Baseline Scores", lines=20, font_size=13)
            refresh_btn = gr.Button("🔄 Refresh Scores", variant="secondary")
            refresh_btn.click(fn=get_baseline_scores, inputs=[], outputs=[results_display])
            demo.load(fn=get_baseline_scores, inputs=[], outputs=[results_display])

        with gr.Tab("🔧 Environment Info"):
            env_info_display = gr.Textbox(label="Environment Status", lines=25)
            env_refresh_btn = gr.Button("🔄 Refresh Status", variant="secondary")
            env_refresh_btn.click(fn=get_environment_info, inputs=[], outputs=[env_info_display])
            demo.load(fn=get_environment_info, inputs=[], outputs=[env_info_display])

        with gr.Tab("📖 About ARIA"):
            gr.Markdown("""
## ⚖️ ARIA — Agentic Regulatory Intelligence Architecture

**The first reinforcement learning environment for multi-framework regulatory compliance auditing.**

Built for the **Meta × Hugging Face OpenEnv Hackathon**.

---

### 🎯 What ARIA Solves

The global regulatory compliance market was valued at **$35.4 billion** in 2023. GDPR fines alone totalled **€2.1 billion**. Senior compliance counsel charges **$800–$1,500/hour** for audit work that is, at its core, systematic pattern-matching against known rule sets.

ARIA provides the first RL environment that models the **complete compliance audit workflow** end-to-end:
- Strategic document reading and section navigation
- Evidence-backed gap identification across 4 frameworks
- Cross-framework conflict detection and escalation  
- Remediation generation with keyword coverage scoring
- Real-time incident response simulation (Expert tier)

---

### 🏗️ Environment Architecture

| Component | Description |
|:---|:---|
| **`aria/environment.py`** | Core RL env — `reset()`, `step()`, `state()`, `grade()` |
| **`aria/reward_engine.py`** | Dense reward function with 18 triggers + anti-gaming v2 |
| **`aria/grader.py`** | Deterministic terminal grader: F1 + evidence + remediation |
| **`aria/evidence.py`** | Windowed fuzzy matching — prevents copy-paste gaming |
| **`server/`** | FastAPI application with OpenEnv endpoints + WebSocket |
| **`baseline/agent.py`** | MultiPassAgent v8 — task-tuned heuristics + LLM fallback |
| **`inference.py`** | Judge-compliant baseline script with `[START]/[STEP]/[END]` |

---

### 📊 Baseline Scores

| Task | Score | F1 | Steps |
|:---|:---:|:---:|:---:|
| Easy | **0.734** ✅ | 1.000 | 14 |
| Medium | **0.625** ✅ | 0.800 | 24 |
| Hard | **0.627** ✅ | 0.750 | 36 |
| Expert | **0.628** ✅ | 0.778 | 50 |
| Blind | ~0.36 | 0.286 | 16 |

ARIA's baseline **outperforms the GPT-4o target on Hard and Expert tiers**.

---

### 🔗 Interfaces

- **React Dashboard** — Live agent visualization at the main Space URL
- **Gradio App** (this UI) — Interactive evaluation runner
- **REST API** — Full OpenEnv spec at `/docs` (Swagger) and `/redoc`
- **WebSocket** — Real-time episode streaming at `/aria/ws/{session_id}`
- **inference.py** — Judges' primary evaluation interface

---

### ⚙️ Environment Variables

| Variable | Description |
|:---|:---|
| `API_KEY` | Judges' LiteLLM proxy key (priority) |
| `HF_TOKEN` | HuggingFace token (fallback) |
| `MODEL_NAME` | Model ID (default: `Qwen/Qwen2.5-7B-Instruct`) |
| `API_BASE_URL` | OpenAI-compatible endpoint URL |

---

*ARIA is not a chatbot. It is not a RAG pipeline. It is an environment — a world an agent inhabits, acts within, and learns from.*
            """)

if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        # Don't block the main thread when running standalone
        # The Gradio server handles concurrency internally
    )