"""ARIA — FastAPI Routes (OpenEnv required endpoints) v2"""
from __future__ import annotations
import json
import asyncio
from pathlib import Path
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from aria.models import ARIAAction
from server.session import session_manager
from server.websocket import ws_manager

router = APIRouter()
TASKS_DIR = Path(__file__).parent.parent / "tasks"
BASELINE_CACHE = Path(__file__).parent.parent / "baseline" / "baseline_results.json"
BASELINE_CACHE_ROOT = Path(__file__).parent.parent / "baseline_results.json"

# ─── Request/Response schemas ─────────────────────────────────────────────────

class ResetRequest(BaseModel):
    task_name: str = "easy"
    seed: int = 42
    session_id: str | None = None

class StepRequest(BaseModel):
    action: ARIAAction

class GraderRequest(BaseModel):
    session_id: str | None = None

# ─── POST /reset ──────────────────────────────────────────────────────────────

@router.post("/reset")
async def reset(
    req: ResetRequest = None, 
    x_session_id: str = Header(None, alias="X-Session-ID")
):
    if req is None:
        req = ResetRequest()
    try:
        sid, env = session_manager.create(
            task_name=req.task_name, 
            seed=req.seed, 
            forced_session_id=x_session_id or req.session_id
        )
        
        obs = env.state()
        obs_dict = obs.model_dump()
        obs_dict["session_id"] = sid
        
        return obs_dict
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── POST /step ───────────────────────────────────────────────────────────────

@router.post("/step")
async def step(req: StepRequest, x_session_id: str = Header(..., alias="X-Session-ID")):
    env = session_manager.get(x_session_id)
    if not env:
        raise HTTPException(status_code=404, detail=f"Session {x_session_id} not found. Call /reset first.")
    try:
        obs, reward, done, info = env.step(req.action)
        payload = {
            "observation": obs.model_dump(),
            "reward": reward,
            "done": done,
            "info": info,
        }
        # Broadcast to WebSocket subscribers
        asyncio.create_task(ws_manager.broadcast(x_session_id, {
            "type": "step",
            "step_number": obs.steps_taken,
            "action": req.action.model_dump(),
            "reward": reward,
            "reward_reason": getattr(obs, 'last_reward_reason', ''),
            "observation": obs.model_dump(),
        }))
        # Broadcast incident alert if fired this step
        if (getattr(obs, 'active_incident', None) 
                and len(getattr(obs, 'incident_timeline', [])) == 1):
            asyncio.create_task(ws_manager.broadcast(x_session_id, {
                "type": "incident_alert",
                "incident": obs.active_incident.model_dump(),
                "message": obs.active_incident.description,
            }))
        if done:
            asyncio.create_task(ws_manager.broadcast(x_session_id, {
                "type": "episode_complete",
                "session_id": x_session_id,
            }))
        return payload
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── GET /state ───────────────────────────────────────────────────────────────

@router.get("/state")
async def state(x_session_id: str = Header(..., alias="X-Session-ID")):
    env = session_manager.get(x_session_id)
    if not env:
        raise HTTPException(status_code=404, detail=f"Session {x_session_id} not found.")
    return env.state().model_dump()

# ─── GET /tasks ───────────────────────────────────────────────────────────────

@router.get("/tasks")
async def list_tasks():
    tasks = []
    action_schema = ARIAAction.model_json_schema()

    for difficulty in ["easy", "medium", "hard", "expert", "blind"]:
        task_file = TASKS_DIR / difficulty / "task.json"
        if task_file.exists():
            with open(task_file) as f:
                t = json.load(f)
            tasks.append({
                "id": t.get("task_id", difficulty),
                "name": t.get("title", f"{difficulty} Task"),
                "difficulty": t.get("difficulty", difficulty),
                "max_steps": t.get("max_steps", 15),
                "frameworks": t.get("frameworks_in_scope", []),
                "num_gaps": len(t.get("ground_truth", {}).get("gaps", [])),
                "has_incident": t.get("incident") is not None,
                "description": t.get("description", ""),
            })

    return {
        "tasks": tasks,
        "total": len(tasks),
        "action_schema": action_schema,
    }

# ─── POST /grader ─────────────────────────────────────────────────────────────

@router.post("/grader")
async def grader(
    req: GraderRequest = None, 
    x_session_id: str = Header(None, alias="X-Session-ID")
):
    sid = (req.session_id if req and req.session_id else None) or x_session_id
    if not sid:
        raise HTTPException(
            status_code=400, 
            detail="Provide session_id in body or X-Session-ID header"
        )
    env = session_manager.get(sid)
    if not env:
        raise HTTPException(status_code=404, detail=f"Session {sid} not found.")
    result = env.grade()
    return result.model_dump()

# ─── POST /baseline ───────────────────────────────────────────────────────────

@router.post("/baseline")
async def baseline():
    """Return cached baseline scores, or trigger fresh run if cache missing."""
    # Check both possible locations
    for cache_path in [BASELINE_CACHE_ROOT, BASELINE_CACHE]:
        if cache_path.exists():
            try:
                with open(cache_path) as f:
                    return json.load(f)
            except Exception:
                continue
    return {
        "status": "pending",
        "message": "Run `python inference.py` to generate baseline scores.",
        "tasks": ["easy", "medium", "hard", "expert", "blind"],
    }

# ─── GET /baseline ────────────────────────────────────────────────────────────

@router.get("/baseline")
async def get_baseline():
    """GET endpoint — same as POST for compatibility."""
    return await baseline()