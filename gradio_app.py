"""
ARIA — Gradio App (HuggingFace Spaces entry point)
Optional interactive UI wrapper for running inference.py evaluations.
Formal evaluations always run inference.py directly.
"""
import gradio as gr
import os
import subprocess
import json
from pathlib import Path


def run_evaluation(task_name: str) -> str:
    """Run a single-task evaluation via inference.py."""
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

        # Try to extract score summary from output
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


def run_all_evaluations() -> str:
    """Run the full baseline across all tasks."""
    return run_evaluation("all")


def get_baseline_scores() -> str:
    """Return cached baseline scores if available."""
    for path in ["baseline_results.json", "baseline/baseline_results.json"]:
        p = Path(path)
        if p.exists():
            try:
                with open(p) as f:
                    data = json.load(f)
                results = data.get("results", [])
                lines = [f"Model: {data.get('model', 'unknown')}", ""]
                for r in results:
                    icon = "✅" if r.get("success") else "❌"
                    lines.append(
                        f"{icon} {r['task'].upper()}: "
                        f"score={r['score']:.3f} | "
                        f"f1={r.get('f1', 0):.3f} | "
                        f"steps={r.get('steps', 0)}"
                    )
                avg = sum(r["score"] for r in results) / max(1, len(results))
                lines.append(f"\nAverage: {avg:.3f}")
                return "\n".join(lines)
            except Exception as e:
                return f"Error reading results: {e}"
    return "No cached results found. Run an evaluation first."


# Gradio Interface
with gr.Blocks(
    title="ARIA — Compliance Audit Agent",
    theme=gr.themes.Soft(primary_hue="violet"),
) as demo:
    gr.Markdown("""
# ⚖️ ARIA — Agentic Regulatory Intelligence Architecture

**The first RL environment for multi-framework compliance auditing.**

This Gradio interface provides an interactive way to run the baseline evaluation pipeline.
Formal judge evaluations execute `inference.py` directly from the command line.

> **Live Dashboard →** Open the main app at the Space URL for the full React UI with real-time agent visualization.
    """)

    with gr.Tabs():
        with gr.Tab("🚀 Run Evaluation"):
            with gr.Row():
                with gr.Column(scale=1):
                    task_choice = gr.Dropdown(
                        choices=["easy", "medium", "hard", "expert", "blind"],
                        value="hard",
                        label="Select Task Tier",
                        info="easy→medium→hard→expert (difficulty progression). 'blind' tests generalisation."
                    )
                    gr.Markdown("""
**Task descriptions:**
- 🟢 **easy** — Single-document GDPR audit (3 gaps)
- 🟡 **medium** — Cross-document DPA + Privacy Policy (5 gaps)
- 🟠 **hard** — Multi-framework conflict resolution (8 gaps, 2 conflicts)  
- 🔴 **expert** — Live breach response mid-audit (10 gaps, 3 conflicts)
- 🟣 **blind** — Paraphrased language, tests genuine reasoning
                    """)
                    run_btn = gr.Button("▶ Run Single Task", variant="primary")
                    all_btn = gr.Button("▶▶ Run All Tasks (Full Baseline)", variant="secondary")

                with gr.Column(scale=2):
                    output_display = gr.Textbox(
                        label="Agent Output (Judge-Evaluated [START]/[STEP]/[END] Format)",
                        lines=30,
                        max_lines=60,
                    )

            run_btn.click(fn=run_evaluation, inputs=[task_choice], outputs=[output_display])
            all_btn.click(fn=run_all_evaluations, inputs=[], outputs=[output_display])

        with gr.Tab("📊 Cached Results"):
            gr.Markdown("View the most recent baseline scores from `baseline_results.json`.")
            results_display = gr.Textbox(label="Baseline Scores", lines=15)
            refresh_btn = gr.Button("🔄 Refresh Scores")
            refresh_btn.click(fn=get_baseline_scores, inputs=[], outputs=[results_display])
            # Auto-load on tab creation
            demo.load(fn=get_baseline_scores, inputs=[], outputs=[results_display])

        with gr.Tab("📖 About ARIA"):
            gr.Markdown("""
## Environment Overview

ARIA models a **real-world compliance audit workflow** across four regulatory frameworks:

| Framework | Jurisdiction | Key Gap Types |
|:---|:---|:---|
| GDPR | EU / EEA | data_retention, consent_mechanism, breach_notification, data_subject_rights, cross_border_transfer |
| HIPAA | United States | phi_safeguard, baa_requirement, breach_notification, audit_log_requirement |
| CCPA/CPRA | California | opt_out_mechanism, data_subject_rights, purpose_limitation |
| SOC 2 | Global | availability_control, audit_log_requirement |

## OpenEnv API Endpoints

- `POST /reset` — Initialize a new episode
- `POST /step` — Submit an action, receive reward + observation
- `GET /state` — Current observation (no step advance)
- `GET /tasks` — List all tasks with metadata
- `POST /grader` — Grade a completed episode
- `POST /baseline` — Retrieve cached baseline scores

## Key Features

- **Dense reward function** — 18 distinct reward triggers with anti-gaming v2
- **Evidence chain validation** — Windowed fuzzy matching prevents copy-paste gaming
- **Cross-framework conflict detection** — Models genuine legal paradoxes
- **Live incident simulation** — Expert tier fires data breach mid-audit
- **Blind generalisation task** — Paraphrased language tests first-principles reasoning
            """)


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)