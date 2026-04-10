"""ARIA — Extended Frontend Routes v2
FIX: Use model_dump(mode='json') throughout to ensure proper enum serialization.
"""
from __future__ import annotations
import json
import os
import asyncio
import httpx
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from openai import OpenAI

from aria.frameworks import FRAMEWORK_REGISTRY
from server.websocket import ws_manager
from aria.models import ARIAObservation
from aria.generator import create_task_from_text
from baseline.agent import MultiPassAgent

from pydantic import BaseModel

class UploadPayload(BaseModel):
    filename: str
    content: str

class SteerPayload(BaseModel):
    session_id: str
    steer_text: str

class GeneratePayload(BaseModel):
    difficulty: str = "medium"
    seed: int = 42
    frameworks: str = "GDPR,CCPA"

router = APIRouter()
BASELINE_CACHE = Path(__file__).parent.parent / "baseline" / "baseline_results.json"
SESSION_STEERING = {}

# In-memory episode replay store
_EPISODE_REPLAYS: dict[str, list[dict]] = {}


# ─── Internal Background Agent Loop ──────────────────────────────────────────

async def run_internal_audit(task_id: str, session_id: str):
    """Background worker that runs the MultiPassAgent loop internally."""
    PORT = os.environ.get("PORT", "7860")
    api_base = f"http://127.0.0.1:{PORT}"

    api_key = os.environ.get("HF_TOKEN") or os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("API_BASE_URL", "https://router.huggingface.co/v1/")
    client = OpenAI(api_key=api_key, base_url=base_url) if api_key else None
    agent = MultiPassAgent(client)

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        headers = {"X-Session-ID": session_id}
        reset_payload = {"task_name": task_id, "seed": 42, "session_id": session_id}

        try:
            resp = await http_client.post(f"{api_base}/reset", json=reset_payload, headers=headers)
            if resp.status_code != 200:
                print(f"[ARIA] Reset failed: {resp.status_code} {resp.text}")
                return

            obs_data = resp.json()
            done = False
            _EPISODE_REPLAYS[session_id] = []

            while not done:
                # FIX: Parse observation - handle serialized enum strings
                try:
                    obs = ARIAObservation(**obs_data)
                except Exception as e:
                    print(f"[ARIA] Obs parse error: {e}")
                    break

                steer = SESSION_STEERING.get(session_id)
                if steer:
                    obs.task_description += f"\n\nIMPORTANT USER OVERRIDE: {steer}"

                action = agent.act(obs)

                # FIX: Use mode='json' for action serialization
                action_dict = action.model_dump(mode='json', exclude_none=True)

                step_resp = await http_client.post(
                    f"{api_base}/step",
                    json={"action": action_dict},
                    headers=headers
                )

                if step_resp.status_code != 200:
                    print(f"[ARIA] Step failed: {step_resp.status_code}")
                    break

                result = step_resp.json()

                # Store step for replay
                _EPISODE_REPLAYS.setdefault(session_id, []).append({
                    "step": result["observation"].get("steps_taken", 0),
                    "action": action_dict,
                    "reward": result["reward"],
                    "reward_reason": result["observation"].get("last_reward_reason", ""),
                    "observation": result["observation"],
                    "done": result["done"],
                })

                obs_data = result["observation"]
                done = result["done"]

                await asyncio.sleep(1.5)
        except Exception as e:
            print(f"[ARIA] Internal Loop Error: {e}")
            import traceback
            traceback.print_exc()


# ─── POST /demo/start/{task_id} ───────────────────────────────────────────────

@router.post("/demo/start/{task_id}")
async def trigger_demo(task_id: str, background_tasks: BackgroundTasks):
    session_id = "hackathon_demo_001"
    background_tasks.add_task(run_internal_audit, task_id, session_id)
    return {"message": "Audit triggered", "session_id": session_id}


# ─── POST /upload/custom ─────────────────────────────────────────────────────

@router.post("/upload/custom")
async def upload_custom_audit(payload: UploadPayload):
    """Generates a custom audit task from raw text and saves it as 'custom'"""
    try:
        task_data = create_task_from_text(payload.content, payload.filename)
        return {"message": "Custom task created", "task_id": task_data["task_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── POST /generate ──────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_task(payload: GeneratePayload):
    import hashlib
    TASKS_DIR = Path(__file__).parent.parent / "tasks" / "generated"
    TASKS_DIR.mkdir(parents=True, exist_ok=True)

    cache_key = hashlib.md5(
        f"{payload.difficulty}:{payload.seed}:{payload.frameworks}".encode()
    ).hexdigest()[:8]
    cache_file = TASKS_DIR / f"task_{cache_key}.json"

    if cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)

    import uuid
    framework_list = [fw.strip() for fw in payload.frameworks.split(",") if fw.strip()]

    industry_templates = [
        {"name": "FinTrack Analytics", "industry": "FinTech SaaS", "data_types": ["financial_records", "consumer_pii"]},
        {"name": "HealthBridge Platform", "industry": "HealthTech SaaS", "data_types": ["phi", "patient_records"]},
        {"name": "RetailIQ Solutions", "industry": "E-commerce Analytics", "data_types": ["consumer_pii", "purchase_history"]},
        {"name": "HRConnect Pro", "industry": "HR Analytics SaaS", "data_types": ["employee_data", "payroll_records"]},
    ]
    import random
    rng = random.Random(payload.seed)
    company = rng.choice(industry_templates)

    difficulty_steps = {"easy": 15, "medium": 25, "hard": 40, "expert": 60}
    max_steps = difficulty_steps.get(payload.difficulty, 25)

    task_id = f"gen_{cache_key}"
    task_data = {
        "task_id": task_id,
        "difficulty": payload.difficulty,
        "title": f"Procedurally Generated — {company['name']} (seed={payload.seed})",
        "company_profile": {
            "name": company["name"],
            "industry": company["industry"],
            "size": rng.choice(["50 employees", "200 employees", "500 employees"]),
            "data_types": company["data_types"],
            "operates_in": ["EU", "California", "US"],
        },
        "frameworks_in_scope": framework_list,
        "documents": [
            {
                "doc_id": "privacy_policy",
                "title": f"{company['name']} Privacy Policy",
                "sections": [
                    {
                        "section_id": "s1",
                        "title": "Data Collection",
                        "content": f"{company['name']} collects personal information to provide services. We collect all available data to optimize our platform.",
                        "subsections": []
                    },
                    {
                        "section_id": "s2",
                        "title": "Data Retention",
                        "content": "We retain personal data for as long as necessary. Data may be archived indefinitely for analytics purposes.",
                        "subsections": []
                    },
                    {
                        "section_id": "s3",
                        "title": "User Rights",
                        "content": "Users may request data access. We process requests within 90 days. We may decline requests at our sole discretion.",
                        "subsections": []
                    }
                ]
            }
        ],
        "ground_truth": {"gaps": [], "conflicts": []},
        "max_steps": max_steps,
        "seed": payload.seed,
        "is_generated": True,
    }

    with open(cache_file, "w") as f:
        json.dump(task_data, f, indent=2)

    return task_data


# ─── GET /replay/{session_id} ────────────────────────────────────────────────

@router.get("/replay/{session_id}")
async def get_replay(session_id: str):
    steps = _EPISODE_REPLAYS.get(session_id)
    if steps is None:
        raise HTTPException(
            status_code=404,
            detail=f"No replay found for session {session_id}."
        )
    return {
        "session_id": session_id,
        "total_steps": len(steps),
        "steps": steps,
    }


# ─── POST /steer ─────────────────────────────────────────────────────────────

@router.post("/steer")
async def steer_agent(payload: SteerPayload):
    """Overrides the agent's focus dynamically mid-run."""
    SESSION_STEERING[payload.session_id] = payload.steer_text
    return {"message": "Agent steered."}


# ─── GET /frameworks ─────────────────────────────────────────────────────────

@router.get("/frameworks")
async def frameworks():
    return FRAMEWORK_REGISTRY


# ─── GET /leaderboard ────────────────────────────────────────────────────────

@router.get("/leaderboard")
async def get_leaderboard():
    all_results = []
    seen = set()

    def _process_file(filepath: Path):
        try:
            with open(filepath) as f:
                data = json.load(f)
            model_name = data.get("model", "Local Model")
            fallback_agent = data.get("agent", "Unknown Agent")
            for r in data.get("results", []):
                agent_name = r.get("agent", fallback_agent)
                display_agent = f"{model_name} ({agent_name})"
                r_copy = dict(r)
                r_copy["agent"] = display_agent
                sig = f"{r_copy['task']}::{display_agent}"
                if sig not in seen:
                    seen.add(sig)
                    all_results.append(r_copy)
        except Exception as e:
            print(f"Error reading {filepath}: {e}")

    if BASELINE_CACHE.exists():
        _process_file(BASELINE_CACHE)

    results_dir = BASELINE_CACHE.parent / "results"
    if results_dir.exists():
        for p in results_dir.glob("*.json"):
            _process_file(p)

    return {"results": all_results}


# ─── WebSocket ───────────────────────────────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await ws_manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(session_id, websocket)