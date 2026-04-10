"""
ARIA -- Baseline Runner v2
Reproducible baseline scoring across all 5 tasks.
Supports HuggingFace Inference Endpoints and OpenAI-compatible APIs.

SETUP:
  1. Set your .env file:
       HF_TOKEN=your_token_here
       API_BASE_URL=https://router.huggingface.co/v1/
       MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
  2. Run: python baseline/run_baseline.py

OUTPUT: baseline/baseline_results.json + baseline_results.json (root)
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, str(Path(__file__).parent.parent))

from aria.environment import ARIAEnv
from baseline.agent import SinglePassAgent, MultiPassAgent

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

RESULTS_FILE = Path(__file__).parent.parent / "baseline" / "baseline_results.json"
RESULTS_ROOT = Path(__file__).parent.parent / "baseline_results.json"

# All tasks including blind
TASKS = ["easy", "medium", "hard", "expert", "blind"]
SEED = 42

MODEL_NAME = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")

import baseline.agent as _agent_mod
_agent_mod.MODEL_NAME = MODEL_NAME


def run_baseline():
    hf_key = os.environ.get("HF_TOKEN")
    openai_key = os.environ.get("OPENAI_API_KEY")
    api_key = os.environ.get("API_KEY") or hf_key or openai_key
    base_url = os.environ.get("API_BASE_URL", "https://router.huggingface.co/v1/")

    if not api_key or not OPENAI_AVAILABLE:
        print("[!!] No API key found. Running MultiPass heuristic agent only.")
        print("     Set HF_TOKEN in your .env for LLM-powered agents")
        client = None
    else:
        client = OpenAI(api_key=api_key, base_url=base_url)
        key_source = "HuggingFace/Proxy" if (hf_key or os.environ.get("API_KEY")) else "OpenAI"
        print(f"[OK] Connected to {key_source} | Model: {MODEL_NAME}")
        if base_url:
            print(f"     Base URL: {base_url}")

    results = {"results": [], "model": MODEL_NAME, "seed": SEED}
    run_start = time.time()

    for task_name in TASKS:
        print(f"\n{'=' * 55}")
        is_blind = task_name == "blind"
        label = f"{task_name.upper()} {'(LLM-driven blind task)' if is_blind else ''}"
        print(f"Task: {label}")
        task_start = time.time()

        agents_to_run = [("MultiPass", MultiPassAgent)]
        # Only run SinglePass for non-blind tasks if API is available
        if client is not None and not is_blind:
            agents_to_run.insert(0, ("SinglePass", SinglePassAgent))

        for agent_name, AgentClass in agents_to_run:
            if agent_name == "SinglePass" and client is None:
                print(f"  Skipping {agent_name} (no API key)")
                continue

            print(f"  Running {agent_name}...")
            env = ARIAEnv()

            try:
                obs = env.reset(task_name=task_name, seed=SEED)
            except FileNotFoundError:
                print(f"  [SKIP] Task '{task_name}' not found — skipping.")
                continue

            agent = AgentClass(client=client, task_name=task_name)

            step_count = 0
            total_reward = 0.0
            consecutive_errors = 0
            all_rewards = []

            while not obs.done and step_count < (obs.steps_remaining + obs.steps_taken + 1):
                try:
                    action = agent.act(obs)
                    obs, reward, done, _ = env.step(action)
                    total_reward += reward
                    all_rewards.append(reward)
                    step_count += 1
                    consecutive_errors = 0
                    if done:
                        break
                except Exception as e:
                    consecutive_errors += 1
                    print(f"    Step error ({consecutive_errors}): {e}")
                    if consecutive_errors >= 5:
                        print("    Too many consecutive errors -- stopping early.")
                        break
                    try:
                        from baseline.agent import _fallback_action
                        fallback = _fallback_action(obs)
                        obs, reward, done, _ = env.step(fallback)
                        total_reward += reward
                        all_rewards.append(reward)
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
            score = float(grade.score) if hasattr(grade, "score") else 0.0

            result = {
                "task": task_name,
                "agent": agent_name,
                "score": score,
                "f1": f1_val,
                "precision": precision,
                "recall": recall,
                "evidence_score": getattr(grade, "evidence_score", 0.0),
                "remediation_score": getattr(grade, "remediation_score", 0.0),
                "steps_taken": step_count,
                "steps": step_count,
                "cumulative_reward": total_reward,
                "breakdown": getattr(grade, "breakdown", {}),
                "success": score >= 0.50,
                "rewards": all_rewards,
            }
            results["results"].append(result)
            icon = "✅" if result["success"] else "❌"
            print(
                f"    {icon} Score: {score:.3f} | F1: {f1_val:.3f} | "
                f"P: {precision:.3f} | R: {recall:.3f} | Steps: {step_count}"
            )

        task_elapsed = time.time() - task_start
        print(f"  Task time: {task_elapsed:.1f}s")

    total_elapsed = time.time() - run_start
    print(f"\n[TIMING] Total run time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")

    # Save results to both locations
    for save_path in [RESULTS_FILE, RESULTS_ROOT]:
        save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, "w") as f:
            json.dump(results, f, indent=2)
    print(f"\n[OK] Results saved to {RESULTS_FILE}")
    print(f"[OK] Results saved to {RESULTS_ROOT}")

    # Summary table
    print("\n" + "=" * 75)
    print(f"{'Task':<10} {'Agent':<12} {'Score':<8} {'F1':<8} {'Prec':<8} {'Recall':<8} {'Steps'}")
    print("-" * 75)
    for r in results["results"]:
        print(
            f"{r['task']:<10} {r['agent']:<12} {r['score']:.3f}    "
            f"{r['f1']:.3f}    {r['precision']:.3f}    {r['recall']:.3f}    {r['steps_taken']}"
        )

    all_scores = [r["score"] for r in results["results"]]
    known_scores = [r["score"] for r in results["results"] if r["task"] != "blind"]
    avg_all = sum(all_scores) / max(len(all_scores), 1)
    avg_known = sum(known_scores) / max(len(known_scores), 1)
    print("-" * 75)
    print(f"{'KNOWN AVG':<10} {'':<12} {avg_known:.3f}")
    print(f"{'OVERALL AVG':<10} {'':<12} {avg_all:.3f}")

    return results


if __name__ == "__main__":
    run_baseline()