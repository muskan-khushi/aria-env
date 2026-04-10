"""
ARIA — Baseline Inference Script  (v9 — blind-task + proxy-compliant + bug-fixed)
==========================================================
inference.py  (root of repo)

MANDATORY environment variables:
  API_BASE_URL   LLM endpoint  (default: https://router.huggingface.co/v1/)
  MODEL_NAME     Model id      (default: Qwen/Qwen2.5-7B-Instruct)
  API_KEY        API key       (injected by judges' LiteLLM proxy)
  HF_TOKEN       Fallback API key (if API_KEY not set)

STDOUT FORMAT (evaluated by judges — do not alter):
  [START] task=<n> env=<benchmark> model=<model>
  [STEP]  step=<n> action=<json> reward=<0.00> done=<true|false> error=<msg|null>
  [END]   success=<true|false> steps=<n> score=<0.00> rewards=<r1,r2,...>

Tasks:
  easy, medium, hard, expert — heuristic-primary, deterministic
  blind                      — paraphrased language, tests genuine regulatory
                               reasoning. LLM fallback required; no hardcoded triggers.

Expected scores (v2 — with exploit-hardened grader):
  easy:   ~0.73
  medium: ~0.62
  hard:   ~0.63
  expert: ~0.63
  blind:  ~0.36 (LLM-dependent; lower by design — tests real generalisation)
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

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY      = (
    os.getenv("API_KEY")
    or os.getenv("HF_TOKEN")
    or os.getenv("OPENAI_API_KEY")
)
API_BASE_URL = os.getenv("API_BASE_URL", "https://router.huggingface.co/v1/")
MODEL_NAME   = os.getenv("MODEL_NAME",   "Qwen/Qwen2.5-7B-Instruct")
BENCHMARK    = "aria-compliance-v1"
SEED         = 42

# blind task is intentionally last — it forces LLM fallback and proves generalisation
TASKS_TO_RUN = ["easy", "medium", "hard", "expert", "blind"]

MAX_STEPS = {
    "easy":   15,
    "medium": 25,
    "hard":   40,
    "expert": 60,
    "blind":  25,   # same budget as medium — same number of gaps
}

SUCCESS_THRESHOLD = 0.50

# ── Import ARIA ───────────────────────────────────────────────────────────────
try:
    from aria.models import ARIAAction, ActionType
    from aria.environment import ARIAEnv
except ImportError as e:
    print(f"[ERROR] Cannot import ARIA: {e}", file=sys.stderr)
    sys.exit(1)

# ── Import agent ──────────────────────────────────────────────────────────────
try:
    from baseline.agent import MultiPassAgent
    import baseline.agent as _agent_mod
    _agent_mod.MODEL_NAME = MODEL_NAME
except ImportError as e:
    print(f"[ERROR] Cannot import baseline agent: {e}", file=sys.stderr)
    sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# Structured log helpers  (judges parse these — do NOT change format)
# ══════════════════════════════════════════════════════════════════════════════

def log_start(task: str, env: str, model: str) -> None:
    print(f"[START] task={task} env={env} model={model}", flush=True)


def log_step(step: int, action: str, reward: float, done: bool, error) -> None:
    err_str = str(error) if error else "null"
    print(
        f"[STEP] step={step} action={action} "
        f"reward={reward:.2f} done={'true' if done else 'false'} "
        f"error={err_str}",
        flush=True,
    )


def log_end(success: bool, steps: int, score: float, rewards: List[float]) -> None:
    rewards_str = ",".join(f"{r:.2f}" for r in rewards)
    print(
        f"[END] success={'true' if success else 'false'} steps={steps} "
        f"score={score:.2f} rewards={rewards_str}",
        flush=True,
    )


# ══════════════════════════════════════════════════════════════════════════════
# Episode runner
# ══════════════════════════════════════════════════════════════════════════════

def run_episode(task_name: str, client: OpenAI) -> dict:
    env       = ARIAEnv()
    max_steps = MAX_STEPS.get(task_name, 25)
    agent     = MultiPassAgent(client=client, task_name=task_name)

    log_start(task=task_name, env=BENCHMARK, model=MODEL_NAME)

    try:
        obs = env.reset(task_name=task_name, seed=SEED)
    except TypeError:
        obs = env.reset(task_name=task_name)

    rewards: List[float] = []
    step_n   = 0
    done     = False
    last_err = None

    for _ in range(max_steps):
        if done:
            break

        try:
            action = agent.act(obs)
        except Exception as exc:
            action   = ARIAAction(action_type=ActionType.SUBMIT_FINAL_REPORT)
            last_err = str(exc)

        step_n    += 1
        action_str = action.model_dump_json(exclude_none=True)

        try:
            result = env.step(action)
            if isinstance(result, tuple):
                obs, reward, done, info = result
            else:
                obs    = result.observation
                reward = result.reward
                done   = result.done
                info   = result.info
            last_err = info.get("error") if isinstance(info, dict) else None
        except Exception as exc:
            reward, done = 0.0, True
            last_err     = str(exc)

        rewards.append(reward)

        log_step(
            step=step_n,
            action=action_str,
            reward=reward,
            done=done,
            error=last_err,
        )

        if done:
            break

    # ── Grade ─────────────────────────────────────────────────────────────────
    f1_val = precision = recall = evidence_score = remediation_score = 0.0
    breakdown: dict = {}
    score = 0.0
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
    success = score >= SUCCESS_THRESHOLD

    log_end(success=success, steps=step_n, score=score, rewards=rewards)

    return {
        "task":               task_name,
        "agent":              "MultiPass",
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
        print(
            "[WARN] No API key found. Set API_KEY (judges' proxy) or HF_TOKEN.",
            file=sys.stderr,
        )

    client = OpenAI(api_key=API_KEY or "no-key", base_url=API_BASE_URL)

    # ── Warmup call ───────────────────────────────────────────────────────────
    print("[INFO] Connecting to LLM proxy at API_BASE_URL...", file=sys.stderr)
    try:
        warmup = client.chat.completions.create(
            model=MODEL_NAME,
            max_tokens=10,
            messages=[
                {"role": "system", "content": "You are a compliance auditing assistant."},
                {"role": "user",   "content": "Reply with one word: READY"},
            ],
        )
        reply = warmup.choices[0].message.content.strip()
        print(f"[INFO] LLM proxy connected. Model response: {reply}", file=sys.stderr)
    except Exception as exc:
        print(f"[WARN] LLM warmup call failed: {exc}", file=sys.stderr)
        print("[INFO] Continuing — heuristics handle known tasks; LLM handles blind task.", file=sys.stderr)

    print(
        f"\n ARIA Baseline v2 | model={MODEL_NAME} | tasks={TASKS_TO_RUN}\n",
        file=sys.stderr, flush=True,
    )

    all_results = []
    run_start   = time.time()

    for task_name in TASKS_TO_RUN:
        is_blind = task_name == "blind"
        tier_label = "BLIND (LLM-driven)" if is_blind else task_name.upper()
        print(
            f"\n{'─'*52}\n  Task: {tier_label}\n{'─'*52}",
            file=sys.stderr, flush=True,
        )
        if is_blind:
            print(
                "  [INFO] Blind task uses paraphrased language — LLM fallback active.",
                file=sys.stderr, flush=True,
            )

        task_start = time.time()
        result     = run_episode(task_name, client)
        elapsed    = time.time() - task_start

        icon = "✅" if result["success"] else "❌"
        print(
            f"  {icon} score={result['score']:.3f} | f1={result['f1']:.3f} "
            f"| steps={result['steps']} | time={elapsed:.1f}s",
            file=sys.stderr, flush=True,
        )
        all_results.append(result)

    total_elapsed = time.time() - run_start
    known_results  = [r for r in all_results if r["task"] != "blind"]
    blind_results  = [r for r in all_results if r["task"] == "blind"]

    avg_known = sum(r["score"] for r in known_results) / max(1, len(known_results))
    avg_all   = sum(r["score"] for r in all_results)   / max(1, len(all_results))

    # FIX: properly compute blind_score_str before using it
    if blind_results:
        blind_score_str = f"{blind_results[0]['score']:.3f}"
    else:
        blind_score_str = "N/A"

    print(
        f"\n{'═'*52}\n"
        f"  KNOWN TASKS avg_score={avg_known:.3f}\n"
        f"  BLIND TASK  score={blind_score_str}\n"
        f"  OVERALL     avg_score={avg_all:.3f} | "
        f"time={total_elapsed:.1f}s ({total_elapsed/60:.1f}min)",
        file=sys.stderr, flush=True,
    )

    # ── Persist results ───────────────────────────────────────────────────────
    from pathlib import Path
    wrapped = {"results": all_results, "model": MODEL_NAME, "seed": SEED}
    for path_str in [
        str(Path(__file__).parent / "baseline_results.json"),
        str(Path(__file__).parent / "baseline" / "baseline_results.json"),
    ]:
        p = Path(path_str)
        p.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(p, "w") as fh:
                json.dump(wrapped, fh, indent=2)
            print(f"[OK] Results saved → {p}", file=sys.stderr)
        except Exception as e:
            print(f"[WARN] Could not save results to {p}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()