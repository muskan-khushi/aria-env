"""
ARIA — Baseline Inference Script  (token-optimised v4)
=======================================================
inference.py  (root of repo)

MANDATORY environment variables:
  API_BASE_URL   LLM endpoint  (default: https://openrouter.ai/api/v1)
  MODEL_NAME     Model id      (default: nvidia/nemotron-3-super-120b-a12b:free)
  HF_TOKEN       API key       (also checks OPENROUTER_API_KEY, GROQ_API_KEY, API_KEY)

STDOUT FORMAT (evaluated by judges — do not alter):
  [START] task=<name> env=<benchmark> model=<model>
  [STEP]  step=<n> action=<json> reward=<0.00> done=<true|false> error=<msg|null>
  [END]   success=<true|false> steps=<n> score=<0.00> rewards=<r1,r2,...>

Token optimisations vs previous version:
  - Both agents use LLM ONLY for gap identification (≤8 LLM calls per episode).
  - All other actions (read, cite, remediate, escalate, finalise) are heuristic.
  - LLM prompt is small + stateless — no conversation history, no growing dumps.
  - max_tokens=256 (gap JSON fits in ~40 tokens).
  - Total LLM calls across all 8 episodes (2 agents × 4 tasks): ≤64.
  - Expected runtime: 3-8 min on free-tier OpenRouter (was 30+ min).
"""
from __future__ import annotations

import json
import os
import sys
import time
from typing import List

from dotenv import load_dotenv
load_dotenv(override=True)

from openai import OpenAI

# ── Env / model config ───────────────────────────────────────────────────────
API_KEY = (
    os.getenv("HF_TOKEN")
    or os.getenv("OPENROUTER_API_KEY")
    or os.getenv("GROQ_API_KEY")
    or os.getenv("API_KEY", "")
)
API_BASE_URL = os.getenv("API_BASE_URL", "https://openrouter.ai/api/v1")
MODEL_NAME   = os.getenv("MODEL_NAME",   "nvidia/nemotron-3-super-120b-a12b:free")
BENCHMARK    = "aria-compliance-v1"
TASKS        = ["easy", "medium", "hard", "expert"]
MAX_STEPS    = 50   # hard cap per episode (well within 20-min budget)
SEED         = 42

# ── Import ARIA ───────────────────────────────────────────────────────────────
try:
    from aria.models import ARIAAction, ActionType
    from aria.environment import ARIAEnv
except ImportError as e:
    print(f"[ERROR] Cannot import ARIA: {e}", file=sys.stderr)
    sys.exit(1)

# ── Import agents ─────────────────────────────────────────────────────────────
try:
    from baseline.agent import SinglePassAgent, MultiPassAgent
except ImportError as e:
    print(f"[ERROR] Cannot import baseline agents: {e}", file=sys.stderr)
    sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# Episode runner
# ══════════════════════════════════════════════════════════════════════════════

def run_episode(task_name: str, client: OpenAI, AgentClass, agent_name: str) -> dict:
    env   = ARIAEnv()
    agent = AgentClass(client=client, task_name=task_name)

    # ── [START] ───────────────────────────────────────────────────────────────
    print(
        f"[START] task={task_name} env={BENCHMARK} model={MODEL_NAME}",
        flush=True,
    )

    try:
        obs = env.reset(task_name=task_name, seed=SEED)
    except TypeError:
        obs = env.reset(task_name=task_name)

    rewards: List[float] = []
    step_n  = 0
    done    = False
    last_err: str | None = None

    for _ in range(MAX_STEPS):
        if done:
            break

        # Agent decides action
        try:
            action = agent.act(obs)
        except Exception as exc:
            action   = ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)
            last_err = str(exc)

        step_n    += 1
        action_str = action.model_dump_json(exclude_none=True)

        # Environment step
        try:
            step_result = env.step(action)
            if isinstance(step_result, tuple):
                obs, reward, done, info = step_result
            else:
                obs    = step_result.observation
                reward = step_result.reward
                done   = step_result.done
                info   = step_result.info
            last_err = info.get("error") if isinstance(info, dict) else None
        except Exception as exc:
            reward, done = 0.0, True
            last_err     = str(exc)

        rewards.append(reward)
        err_str = last_err if last_err else "null"

        # ── [STEP] ────────────────────────────────────────────────────────────
        print(
            f"[STEP] step={step_n} action={action_str} "
            f"reward={reward:.2f} done={'true' if done else 'false'} "
            f"error={err_str}",
            flush=True,
        )

        if done:
            break

    # ── Grade ─────────────────────────────────────────────────────────────────
    f1_val = precision = recall = evidence_score = remediation_score = 0.0
    breakdown: dict = {}
    try:
        grade = env.grade()
        if isinstance(grade, (int, float)):
            score = float(grade)
        elif isinstance(grade, dict):
            score = float(grade.get("score", 0.0))
        elif hasattr(grade, "score"):
            score = float(grade.score)
            if hasattr(grade, "f1_score"):
                f1_val    = getattr(grade.f1_score, "f1",        0.0)
                precision = getattr(grade.f1_score, "precision", 0.0)
                recall    = getattr(grade.f1_score, "recall",    0.0)
            evidence_score    = getattr(grade, "evidence_score",    0.0)
            remediation_score = getattr(grade, "remediation_score", 0.0)
            breakdown         = getattr(grade, "breakdown",         {})
        else:
            score = sum(r for r in rewards if r > 0)
    except Exception:
        score = sum(r for r in rewards if r > 0)

    score   = max(0.0, min(1.0, score))
    success = score >= 0.60

    rewards_str = ",".join(f"{r:.2f}" for r in rewards)

    # ── [END] ─────────────────────────────────────────────────────────────────
    print(
        f"[END] success={'true' if success else 'false'} steps={step_n} "
        f"score={score:.2f} rewards={rewards_str}",
        flush=True,
    )

    return {
        "task":               task_name,
        "agent":              agent_name,
        "score":              score,
        "f1":                 f1_val,
        "precision":          precision,
        "recall":             recall,
        "evidence_score":     evidence_score,
        "remediation_score":  remediation_score,
        "steps_taken":        step_n,
        "cumulative_reward":  sum(rewards),
        "breakdown":          breakdown,
        "steps":              step_n,
        "success":            success,
        "rewards":            rewards,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    if not API_KEY:
        print("[WARN] No API key found — LLM calls will fail; agents fall back to heuristic.", file=sys.stderr)

    client = OpenAI(api_key=API_KEY or "no-key", base_url=API_BASE_URL)

    print(
        f"\n ARIA Baseline | model={MODEL_NAME} | tasks={TASKS} | agents=SinglePass,MultiPass\n",
        file=sys.stderr, flush=True,
    )

    results    = []
    run_start  = time.time()

    for task in TASKS:
        print(f"\n{'─'*52}\n  Task: {task.upper()}\n{'─'*52}", file=sys.stderr, flush=True)

        for agent_name, AgentClass in [
            ("SinglePass", SinglePassAgent),
            ("MultiPass",  MultiPassAgent),
        ]:
            print(f"  [AGENT] {agent_name}...", file=sys.stderr, flush=True)
            t0     = time.time()
            result = run_episode(task, client, AgentClass, agent_name)
            results.append(result)
            elapsed = time.time() - t0
            icon    = "✅" if result["success"] else "❌"
            print(
                f"  {icon} score={result['score']:.3f} | f1={result['f1']:.3f} "
                f"| steps={result['steps']} | time={elapsed:.1f}s",
                file=sys.stderr, flush=True,
            )

    # ── Summary ───────────────────────────────────────────────────────────────
    avg         = sum(r["score"]   for r in results) / len(results)
    avg_f1      = sum(r["f1"]      for r in results) / len(results)
    total_pass  = sum(1            for r in results if r["success"])
    total_time  = time.time() - run_start

    print("\n" + "=" * 52, file=sys.stderr)
    print("          ARIA BASELINE SUMMARY", file=sys.stderr)
    print("=" * 52, file=sys.stderr)
    print(f"  {'Task':<10} {'Agent':<12} {'Score':<8} {'F1':<8} {'Steps'}", file=sys.stderr)
    print(f"  {'-'*50}", file=sys.stderr)
    for r in results:
        icon = "✅" if r["success"] else "❌"
        print(
            f"  {icon} {r['task']:<10} {r['agent']:<12} "
            f"{r['score']:.3f}    {r['f1']:.3f}    {r['steps']}",
            file=sys.stderr,
        )
    print(f"\n  Average score : {avg:.3f}", file=sys.stderr)
    print(f"  Average F1    : {avg_f1:.3f}", file=sys.stderr)
    print(f"  Passed        : {total_pass} / {len(results)}", file=sys.stderr)
    print(f"  Total time    : {total_time:.1f}s ({total_time/60:.1f} min)", file=sys.stderr)

    # ── Persist results ───────────────────────────────────────────────────────
    from pathlib import Path as _Path
    wrapped = {"results": results, "model": MODEL_NAME, "seed": SEED}

    for path_str in [
        str(_Path(__file__).parent / "baseline_results.json"),
        str(_Path(__file__).parent / "baseline" / "baseline_results.json"),
    ]:
        p = _Path(path_str)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w") as fh:
            json.dump(wrapped, fh, indent=2)
        print(f"[OK] Results saved → {p}", file=sys.stderr)


if __name__ == "__main__":
    main()