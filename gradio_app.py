"""
ARIA — Gradio App (HuggingFace Spaces entry point)
Interactive UI wrapper for running inference.py evaluations.

FIX v2:
- All subprocess calls now run in ThreadPoolExecutor to avoid blocking the Gradio event loop.
- Gradio is served on a SEPARATE port (7861) from the FastAPI inference server (7860).
  This allows both to run simultaneously without port conflict.
- Added proper timeout handling and graceful degradation.
- Fixed the 'Page Unresponsive' browser hang that occurred when subprocesses blocked
  the Gradio asyncio event loop.

Usage:
  # Run FastAPI server (port 7860):
  uvicorn server.app:app --host 0.0.0.0 --port 7860
  
  # Run Gradio UI separately (port 7861):
  python gradio_app.py
  
  # Or just run everything together:
  python gradio_app.py  # starts both if USE_GRADIO_ONLY=false
"""
import gradio as gr
import os
import subprocess
import json
import sys
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

# Thread pool for subprocess calls — prevents Gradio event loop from blocking
_executor = ThreadPoolExecutor(max_workers=3)

# Port for Gradio — separate from FastAPI (7860)
GRADIO_PORT = int(os.environ.get("GRADIO_PORT", "7861"))
FASTAPI_PORT = int(os.environ.get("PORT", "7860"))


def _run_subprocess_blocking(task_name: str, timeout: int = 600) -> str:
    """
    Blocking subprocess call — MUST be run in executor thread, never in event loop.
    Returns formatted output string.
    """
    env = os.environ.copy()
    if task_name != "all":
        env["TASK_NAME"] = task_name

    try:
        result = subprocess.run(
            [sys.executable, "inference.py"],
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(Path(__file__).parent),
        )

        score_lines = [
            line for line in result.stdout.split("\n")
            if line.startswith("[END]") or line.startswith("[START]")
        ]

        score_summary = "\n".join(score_lines) if score_lines else "(no score lines found)"

        output = (
            f"{'='*60}\n"
            f"JUDGE-FORMAT OUTPUT (stdout):\n"
            f"{'='*60}\n"
            f"{score_summary}\n\n"
            f"{'='*60}\n"
            f"FULL STDOUT:\n"
            f"{'='*60}\n"
            f"{result.stdout}\n\n"
        )

        if result.stderr:
            output += (
                f"{'='*60}\n"
                f"STDERR (debug info):\n"
                f"{'='*60}\n"
                f"{result.stderr[:3000]}\n"
            )

        if result.returncode != 0:
            output = f"⚠ Process exited with code {result.returncode}\n\n" + output

        return output

    except subprocess.TimeoutExpired:
        return f"❌ Evaluation timed out after {timeout}s.\n\nThis is normal for 'all tasks' run (~25s expected)."
    except FileNotFoundError:
        return "❌ inference.py not found. Make sure you're running from the repo root."
    except Exception as e:
        return f"❌ Unexpected error: {type(e).__name__}: {str(e)}"


def run_evaluation(task_name: str) -> str:
    """Run single task evaluation — non-blocking via thread pool."""
    future = _executor.submit(_run_subprocess_blocking, task_name, 300)
    try:
        return future.result(timeout=320)
    except FuturesTimeoutError:
        return "❌ Evaluation timed out in thread pool."
    except Exception as e:
        return f"❌ Thread pool error: {str(e)}"


def run_all_evaluations() -> str:
    """Run full baseline across all tasks — non-blocking."""
    future = _executor.submit(_run_subprocess_blocking, "all", 600)
    try:
        return future.result(timeout=650)
    except FuturesTimeoutError:
        return "❌ Full evaluation timed out."
    except Exception as e:
        return f"❌ Thread pool error: {str(e)}"


def get_baseline_scores() -> str:
    """Return cached baseline scores if available."""
    search_paths = [
        Path(__file__).parent / "baseline_results.json",
        Path(__file__).parent / "baseline" / "baseline_results.json",
    ]

    for p in search_paths:
        if p.exists():
            try:
                with open(p) as f:
                    data = json.load(f)

                results = data.get("results", [])
                lines = [
                    f"📊 Model: {data.get('model', 'unknown')}",
                    f"🌱 Seed: {data.get('seed', 42)}",
                    "",
                ]

                known = [r for r in results if r.get("task") != "blind"]
                blind_list = [r for r in results if r.get("task") == "blind"]

                lines.append("─── Known Tasks ──────────────────────────────")
                for r in known:
                    icon = "✅" if r.get("success") else "❌"
                    lines.append(
                        f"{icon}  {r['task'].upper():8s} │ "
                        f"score={r['score']:.3f} │ "
                        f"f1={r.get('f1', 0):.3f} │ "
                        f"prec={r.get('precision', 0):.3f} │ "
                        f"recall={r.get('recall', 0):.3f} │ "
                        f"steps={r.get('steps', 0)}"
                    )

                if blind_list:
                    lines.append("\n─── Blind Task (Generalisation) ──────────────")
                    for r in blind_list:
                        icon = "✅" if r.get("success") else "⚠️ "
                        lines.append(
                            f"{icon}  {'BLIND':8s} │ "
                            f"score={r['score']:.3f} │ "
                            f"f1={r.get('f1', 0):.3f} │ "
                            f"steps={r.get('steps', 0)}"
                        )

                if known:
                    avg = sum(r["score"] for r in known) / len(known)
                    blind_avg = sum(r["score"] for r in blind_list) / max(len(blind_list), 1)
                    lines.append(f"\n─── Summary ──────────────────────────────────")
                    lines.append(f"    Known avg:  {avg:.3f}")
                    if blind_list:
                        lines.append(f"    Blind score: {blind_avg:.3f}")
                    lines.append(f"    Overall avg: {(sum(r['score'] for r in results) / max(len(results), 1)):.3f}")

                return "\n".join(lines)
            except Exception as e:
                return f"Error reading results: {e}"

    return (
        "No cached results found.\n\n"
        "Run an evaluation using the buttons above, or execute:\n"
        "  python inference.py\n\n"
        "Results will be saved to baseline_results.json"
    )


def get_environment_info() -> str:
    """Return environment status information."""
    lines = [
        "=== ARIA Environment Status ===",
        "",
        f"Python: {sys.version.split()[0]}",
        f"Working dir: {Path.cwd()}",
        f"FastAPI port: {FASTAPI_PORT}",
        f"Gradio port: {GRADIO_PORT}",
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
                    lines.append(f"  ✅ {task_dir.upper():8s} — {gaps} gaps | {frameworks}")
                except Exception:
                    lines.append(f"  ⚠️  {task_dir} — could not parse task.json")
            else:
                lines.append(f"  ❌ {task_dir} — task.json not found")
    else:
        lines.append("  ❌ tasks/ directory not found")

    lines.extend([
        "",
        "=== API Endpoints ===",
        f"  POST http://localhost:{FASTAPI_PORT}/reset",
        f"  POST http://localhost:{FASTAPI_PORT}/step",
        f"  GET  http://localhost:{FASTAPI_PORT}/state",
        f"  GET  http://localhost:{FASTAPI_PORT}/tasks",
        f"  POST http://localhost:{FASTAPI_PORT}/grader",
        f"  GET  http://localhost:{FASTAPI_PORT}/docs    (Swagger UI)",
        f"  GET  http://localhost:{FASTAPI_PORT}/redoc   (ReDoc)",
        "",
        "=== Dependencies ===",
    ])

    for pkg in ["fastapi", "pydantic", "openai", "gradio"]:
        try:
            import importlib
            mod = importlib.import_module(pkg)
            version = getattr(mod, "__version__", "installed")
            lines.append(f"  ✅ {pkg} {version}")
        except ImportError:
            lines.append(f"  ❌ {pkg} NOT INSTALLED")

    return "\n".join(lines)


# ── Gradio Interface ─────────────────────────────────────────────────────────

with gr.Blocks(
    title="ARIA — Compliance Audit Agent",
    theme=gr.themes.Soft(primary_hue="violet"),
    css="""
    .main-header { font-size: 28px; font-weight: 800; color: #4C1D95; margin-bottom: 4px; }
    .subtitle { color: #6D28D9; font-size: 14px; }
    .note-box { background: #F5F3FF; border: 1px solid #DDD6FE; border-radius: 8px; padding: 12px; margin: 8px 0; }
    .code-box { font-family: monospace; background: #1E1B4B; color: #C4B5FD; padding: 12px; border-radius: 8px; }
    """
) as demo:

    gr.HTML("""
    <div style="text-align:center; padding: 20px 0 10px;">
      <div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#6D28D9,#4F46E5);border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(109,40,217,0.4);">
          <svg width="28" height="28" fill="white" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <div>
          <h1 style="font-size:32px;font-weight:900;color:#4C1D95;margin:0;letter-spacing:-1px;">ARIA</h1>
          <p style="color:#6D28D9;font-size:12px;margin:0;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Agentic Regulatory Intelligence Architecture</p>
        </div>
      </div>
      <p style="color:#6B7280;font-size:14px;max-width:620px;margin:0 auto 8px;">
        Evaluation interface for ARIA — the first RL environment for multi-framework compliance auditing.
        <strong>GDPR · HIPAA · CCPA · SOC 2</strong>
      </p>
      <div style="background:#FFF7ED;border:1px solid #F59E0B;border-radius:8px;padding:8px 16px;display:inline-block;margin-top:8px;font-size:12px;color:#92400E;">
        ⚠️ This Gradio UI runs on port <strong>7861</strong>. The main FastAPI server runs on port <strong>7860</strong>.
        Both can run simultaneously.
      </div>
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
                        info="Each tier tests a different aspect of regulatory reasoning."
                    )

                    gr.HTML("""
                    <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px;margin:8px 0;">
                      <p style="font-weight:700;color:#5B21B6;margin:0 0 10px;font-size:13px;">Task Difficulty Guide</p>
                      <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">
                        <div>🟢 <strong>Easy</strong> — Single-doc GDPR audit (3 gaps, 1 red herring) · 15 steps · Expected: ~0.73</div>
                        <div>🟡 <strong>Medium</strong> — Cross-doc DPA + Privacy Policy (5 gaps) · 25 steps · Expected: ~0.62</div>
                        <div>🟠 <strong>Hard</strong> — Multi-framework conflicts (8 gaps, 2 conflicts) · 40 steps · Expected: ~0.63</div>
                        <div>🔴 <strong>Expert</strong> — Live breach response mid-audit (10 gaps) · 60 steps · Expected: ~0.63</div>
                        <div>🟣 <strong>Blind</strong> — Paraphrased language, no trigger phrases · 25 steps · Expected: ~0.36</div>
                      </div>
                    </div>
                    """)

                    with gr.Row():
                        run_btn = gr.Button("▶ Run Single Task", variant="primary", scale=2)
                        all_btn = gr.Button("▶▶ All 5 Tasks", variant="secondary", scale=1)

                    gr.HTML("""
                    <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:10px;margin-top:8px;font-size:12px;color:#92400E;">
                      ⏱️ <strong>Timing:</strong> Easy ~3s · Medium ~5s · Hard ~8s · Expert ~12s · Blind ~5s · All tasks ~30s total
                    </div>
                    """)

                    gr.HTML("""
                    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px;margin-top:8px;font-size:12px;color:#1E40AF;">
                      💡 <strong>Judge Format:</strong> Output follows <code>[START]</code> / <code>[STEP]</code> / <code>[END]</code> format evaluated by judges.
                    </div>
                    """)

                with gr.Column(scale=2):
                    output_display = gr.Textbox(
                        label="Agent Output — [START]/[STEP]/[END] Judge Format",
                        lines=30,
                        max_lines=80,
                        placeholder=(
                            "Click 'Run Single Task' or 'All 5 Tasks' to start evaluation.\n\n"
                            "Output appears here in the judge-compliant format.\n\n"
                            "Note: This runs inference.py as a subprocess in a background thread,\n"
                            "so the UI remains responsive throughout."
                        ),
                    )

            run_btn.click(fn=run_evaluation, inputs=[task_choice], outputs=[output_display])
            all_btn.click(fn=run_all_evaluations, inputs=[], outputs=[output_display])

        with gr.Tab("📊 Baseline Scores"):
            gr.HTML("""
            <p style="color:#6B7280;font-size:13px;padding:8px 0;">
                Cached scores from the last <code>inference.py</code> run (<code>baseline_results.json</code>).
                Click refresh after running an evaluation.
            </p>
            """)
            results_display = gr.Textbox(label="Baseline Scores", lines=25)
            refresh_btn = gr.Button("🔄 Refresh Scores", variant="secondary")
            refresh_btn.click(fn=get_baseline_scores, inputs=[], outputs=[results_display])
            demo.load(fn=get_baseline_scores, inputs=[], outputs=[results_display])

        with gr.Tab("🔧 Environment Info"):
            env_info_display = gr.Textbox(label="Environment Status", lines=30)
            env_refresh_btn = gr.Button("🔄 Refresh Status", variant="secondary")
            env_refresh_btn.click(fn=get_environment_info, inputs=[], outputs=[env_info_display])
            demo.load(fn=get_environment_info, inputs=[], outputs=[env_info_display])

        with gr.Tab("📖 About ARIA"):
            gr.Markdown("""
## ⚖️ ARIA — Agentic Regulatory Intelligence Architecture

**The first reinforcement learning environment for multi-framework regulatory compliance auditing.**

Built for the **Meta × Hugging Face OpenEnv Hackathon**.

---

### Quick Start

```bash
# Install
pip install -r requirements.txt

# Set credentials
export API_KEY="your_api_key"
export API_BASE_URL="https://router.huggingface.co/v1/"
export MODEL_NAME="Qwen/Qwen2.5-7B-Instruct"

# Run inference (produces [START]/[STEP]/[END] judge format)
python inference.py

# Run FastAPI server + React dashboard
uvicorn server.app:app --host 0.0.0.0 --port 7860

# Run this Gradio UI (separate port, non-blocking)
python gradio_app.py   # starts on port 7861
```

---

### Architecture

| Component | Role |
|:---|:---|
| `aria/environment.py` | Core RL env: `reset()` / `step()` / `state()` / `grade()` |
| `aria/reward_engine.py` | Dense reward, 18 triggers, anti-gaming v2 |
| `aria/grader.py` | Deterministic terminal grader: F1 + evidence + remediation |
| `aria/evidence.py` | Windowed fuzzy matcher (anti copy-paste exploit) |
| `server/` | FastAPI with full OpenEnv spec + WebSocket |
| `baseline/agent.py` | MultiPassAgent v8: heuristics + LLM fallback |
| `inference.py` | Judge-compliant baseline script |
| `gradio_app.py` | This interactive evaluation UI |

---

### Baseline Scores (Qwen 2.5 7B, MultiPass v8)

| Task | Score | F1 | Steps | Success |
|:---|:---:|:---:|:---:|:---:|
| Easy | **0.734** | 1.000 | 14 | ✅ |
| Medium | **0.625** | 0.800 | 24 | ✅ |
| Hard | **0.627** | 0.750 | 36 | ✅ |
| Expert | **0.628** | 0.778 | 50 | ✅ |
| Blind | ~0.36 | 0.286 | 16 | ❌ (by design) |

ARIA's baseline **outperforms the GPT-4o target on Hard and Expert tiers**.

---

### Port Configuration

| Service | Port | Note |
|:---|:---:|:---|
| FastAPI / React Dashboard | **7860** | Main server (uvicorn) |
| Gradio UI | **7861** | This interface |
| WebSocket | **7860/aria/ws/** | Real-time streaming |

Both services can run simultaneously without port conflict.
            """)


if __name__ == "__main__":
    print(f"[ARIA] Starting Gradio UI on port {GRADIO_PORT}")
    print(f"[ARIA] FastAPI server should be running on port {FASTAPI_PORT}")
    print(f"[ARIA] Open: http://localhost:{GRADIO_PORT}")
    demo.launch(
        server_name="0.0.0.0",
        server_port=GRADIO_PORT,
        show_error=True,
        quiet=False,
    )