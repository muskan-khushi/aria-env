"""
ARIA — Agentic Regulatory Intelligence Architecture
==========================================
"""

import json
import os
import sys
import traceback
import time
from pathlib import Path
from typing import List, Optional
from openai import OpenAI

# ─── ENHANCEMENT: Path Resilience ─────────────────────────────────────────────
# Ensures the script can find 'aria' and 'baseline' modules regardless of 
# where it's executed from.
ROOT_DIR = Path(__file__).parent.absolute()
sys.path.insert(0, str(ROOT_DIR))

# ─── Mandatory Env Vars ───────────────────────────────────────────────────────
API_BASE_URL = os.getenv("API_BASE_URL", "https://router.huggingface.co/v1")
MODEL_NAME   = os.getenv("MODEL_NAME",   "Qwen/Qwen2.5-72B-Instruct")
API_KEY      = os.getenv("HF_TOKEN") or os.getenv("API_KEY")
BENCHMARK    = "aria-compliance-v1"

# ─── Task Configuration ───────────────────────────────────────────────────────
# Difficulty tiers per Bible §4.2
TASKS = ["easy", "medium", "hard", "expert"]
SEED = 42

# ─── Client Initialization ───────────────────────────────────────────────────
if not API_KEY:
    print("⚠️ WARNING: HF_TOKEN not set. Inference will fail on LLM calls.", file=sys.stderr)

client = OpenAI(api_key=API_KEY, base_url=API_BASE_URL)

def run_episode(task_name: str) -> dict:
    """
    Executes a full audit episode.
    Emits mandatory [START], [STEP], and [END] tags to stdout.
    """
    from aria.environment import ARIAEnv
    from baseline.agent import MultiPassAgent

    env = ARIAEnv()
    agent = MultiPassAgent(client=client)

    rewards = []
    score = 0.0
    success = False
    
    # ── [START] ───────────────────────────────────────────────────────────────
    print(f"[START] task={task_name} env={BENCHMARK} model={MODEL_NAME}", flush=True)

    try:
        # Pinned seed for reproducibility (Evaluation Criterion §3.2)
        obs = env.reset(task_name=task_name, seed=SEED)
        
        # Pull dynamic step limit from task metadata if available
        max_steps = getattr(obs, 'steps_remaining', 20) + obs.steps_taken

        for step_num in range(1, max_steps + 1):
            if obs.done:
                break

            error_val = "null"
            start_time = time.time()

            # 1. Agent Action Logic
            try:
                action = agent.act(obs)
                # Ensure enums are stringified correctly for the log parser
                action_dict = action.model_dump(exclude_none=True)
                clean_dict = {k: (v.value if hasattr(v, "value") else v) for k, v in action_dict.items()}
                action_str = json.dumps(clean_dict, separators=(",", ":"))
                
                # ENHANCEMENT: Log reasoning to stderr for Human Reviewers
                print(f"  → Agent Thought: {clean_dict.get('action_type')} on {clean_dict.get('clause_ref', 'N/A')}", file=sys.stderr)

            except Exception as e:
                from aria.models import ARIAAction, ActionType
                action = ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)
                action_str = '{"action_type":"submit_final_report"}'
                error_val = str(e).replace("\n", " ").replace("=", ":")[:120]

            # 2. Environment Step
            obs, reward, done, info = env.step(action)
            rewards.append(reward)

            # 3. Error Surface (REJECTED actions)
            if obs.last_action_result.value == "REJECTED" and error_val == "null":
                error_val = obs.last_reward_reason.replace("\n", " ").replace("=", ":")[:120]

            # ── [STEP] ────────────────────────────────────────────────────────
            # Formatting floats to 2 decimal places as per mandatory requirement
            print(
                f"[STEP] step={step_num} action={action_str} "
                f"reward={reward:.2f} done={'true' if done else 'false'} error={error_val}",
                flush=True,
            )

            if done:
                break

        # 4. Final Grading
        grade = env.grade()
        score = grade.score
        success = score >= 0.5 # Threshold for 'success' metric

    except Exception:
        traceback.print_exc(file=sys.stderr)
        score = 0.0

    # ── [END] ─────────────────────────────────────────────────────────────────
    # rewards list must be comma-separated strings
    rewards_str = ",".join(f"{r:.2f}" for r in rewards)
    print(
        f"[END] success={'true' if success else 'false'} "
        f"steps={len(rewards)} score={score:.2f} rewards={rewards_str}",
        flush=True,
    )

    return {"task": task_name, "score": score, "success": success}

def main():
    print(f"🚀 Starting ARIA Baseline on {MODEL_NAME}", file=sys.stderr)
    results = []
    
    for task in TASKS:
        try:
            res = run_episode(task)
            results.append(res)
        except Exception as e:
            # Emergency fallback to ensure [END] tag is ALWAYS emitted
            print(f"[END] success=false steps=0 score=0.00 rewards=", flush=True)
            print(f"❌ Critical Failure on {task}: {e}", file=sys.stderr)

    # Final summary for human review
    print("\n" + "="*30, file=sys.stderr)
    print("      FINAL SUMMARY", file=sys.stderr)
    print("="*30, file=sys.stderr)
    avg_score = sum(r['score'] for r in results) / len(results) if results else 0
    for r in results:
        status = "✅" if r['success'] else "❌"
        print(f"{status} {r['task']:<10} | Score: {r['score']:.2f}", file=sys.stderr)
    print(f"\n🏆 Average Benchmark Score: {avg_score:.2f}", file=sys.stderr)

if __name__ == "__main__":
    main()