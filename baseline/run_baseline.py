"""
ARIA -- Baseline Inference Script
Reproducible baseline scoring using any OpenAI-compatible endpoint.
Supports HuggingFace Inference Endpoints (recommended), and OpenAI.

SETUP:
  1. Have your Hugging Face API key ready
  2. Set your .env file:
       HF_TOKEN=your_token_here
       API_BASE_URL=https://router.huggingface.co/v1/
       MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
  3. Run: python baseline/run_baseline.py
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# --- Windows cp1252 safety: force UTF-8 for stdout/stderr ---
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass  # older Python without reconfigure

from dotenv import load_dotenv
load_dotenv()

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from aria.environment import ARIAEnv

# Import the refined v2 agents from baseline/agent.py
from baseline.agent import SinglePassAgent, MultiPassAgent

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

RESULTS_FILE = Path(__file__).parent.parent / "baseline_results.json"
TASKS = ["easy", "medium", "hard", "expert"]
SEED = 42

# Dynamically fetch the model name
MODEL_NAME = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")

# Override agent.py's MODEL_NAME to match .env config
import baseline.agent as _agent_mod
_agent_mod.MODEL_NAME = MODEL_NAME


# --- Run Baseline -----------------------------------------------------------

def run_baseline():
    """
    Priority order for API keys:
      1. HF_TOKEN           (HuggingFace)
      2. OPENAI_API_KEY
    """
    hf_key = os.environ.get("HF_TOKEN")
    openai_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("API_BASE_URL", "https://router.huggingface.co/v1/")

    api_key = hf_key or openai_key

    if not api_key or not OPENAI_AVAILABLE:
        print("[!!] No API key found. Running MultiPass heuristic agent only.")
        print("     Set HF_TOKEN in your .env for LLM-powered agents")
        client = None
    else:
        client = OpenAI(api_key=api_key, base_url=base_url)
        key_source = "HuggingFace" if hf_key else "OpenAI"
        print(f"[OK] Connected to {key_source} | Model: {MODEL_NAME}")
        if base_url:
            print(f"     Base URL: {base_url}")

    results = {"results": [], "model": MODEL_NAME, "seed": SEED}
    run_start = time.time()

    for task_name in TASKS:
        print(f"\n{'=' * 55}")
        print(f"Task: {task_name.upper()}")
        task_start = time.time()

        for agent_name, AgentClass in [("SinglePass", SinglePassAgent),
                                        ("MultiPass", MultiPassAgent)]:
            if agent_name == "SinglePass" and client is None:
                print(f"  Skipping {agent_name} (no API key)")
                continue

            print(f"  Running {agent_name}...")
            env = ARIAEnv()
            obs = env.reset(task_name=task_name, seed=SEED)

            # Both agents require task_name for task-aware read caps
            if agent_name == "MultiPass":
                agent = MultiPassAgent(client=client, task_name=task_name)
            else:
                agent = SinglePassAgent(client=client, task_name=task_name)

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
                        print("    Too many consecutive errors -- stopping episode early.")
                        break
                    # Try a safe fallback action to unstick the agent
                    try:
                        from baseline.agent import _fallback_action
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

        task_elapsed = time.time() - task_start
        print(f"  Task time: {task_elapsed:.1f}s")

    total_elapsed = time.time() - run_start
    print(f"\n[TIMING] Total run time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")

    # Save results
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_FILE, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n[OK] Results saved to {RESULTS_FILE}")

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