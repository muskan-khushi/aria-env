"""ARIA — Extended Frontend Routes"""
from __future__ import annotations
import json
import os
import asyncio
import httpx
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from openai import OpenAI

# Internal imports
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

router = APIRouter()
BASELINE_CACHE = Path(__file__).parent.parent / "baseline" / "baseline_results.json"
SESSION_STEERING = {}

# ─── Internal Background Agent Loop ──────────────────────────────────────────

async def run_internal_audit(task_id: str, session_id: str):
    """
    Background worker that runs the MultiPassAgent loop internally.
    Matches your log's session_id: hackathon_demo_001
    """
    PORT = os.environ.get("PORT", "7860")
    api_base = f"http://127.0.0.1:{PORT}"
    
    # 1. Initialize Agent
    api_key = os.environ.get("HF_TOKEN") or os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("API_BASE_URL", "https://api-inference.huggingface.co/v1/")
    client = OpenAI(api_key=api_key, base_url=base_url) if api_key else None
    agent = MultiPassAgent(client)
    
    async with httpx.AsyncClient(timeout=30.0) as http_client:
        # 2. Reset Env (Self-pinging the /reset endpoint)
        headers = {"X-Session-ID": session_id}
        reset_payload = {"task_name": task_id, "seed": 42, "session_id": session_id}
        
        try:
            resp = await http_client.post(f"{api_base}/reset", json=reset_payload, headers=headers)
            if resp.status_code != 200:
                return

            obs_data = resp.json()
            done = False
            
            # 3. Step Loop
            while not done:
                obs = ARIAObservation(**obs_data)
                
                steer = SESSION_STEERING.get(session_id)
                if steer:
                    obs.task_description += f"\n\nIMPORTANT USER OVERRIDE: {steer}"
                    
                action = agent.act(obs)
                
                # Self-ping /step to trigger the standard logic + WS broadcast
                step_resp = await http_client.post(
                    f"{api_base}/step", 
                    json={"action": action.model_dump()}, 
                    headers=headers
                )
                
                if step_resp.status_code != 200:
                    break
                    
                result = step_resp.json()
                obs_data = result["observation"]
                done = result["done"]
                
                # Smooth delay for UI animation
                await asyncio.sleep(1.5)
        except Exception as e:
            print(f"Internal Loop Error: {e}")

# ─── POST /demo/start/{task_id} ───────────────────────────────────────────────

@router.post("/demo/start/{task_id}")
async def trigger_demo(task_id: str, background_tasks: BackgroundTasks):
    """Triggers the agent from the UI. Matches the path /aria/demo/start/{task_id}"""
    # Matches your logs where the WS is listening to hackathon_demo_001
    session_id = "hackathon_demo_001" 
    background_tasks.add_task(run_internal_audit, task_id, session_id)
    return {"message": "Audit triggered", "session_id": session_id}

@router.post("/upload/custom")
async def upload_custom_audit(payload: UploadPayload):
    """Generates a custom audit task from raw text and saves it as 'custom'"""
    try:
        task_data = create_task_from_text(payload.content, payload.filename)
        return {"message": "Custom task created", "task_id": task_data["task_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/steer")
async def steer_agent(payload: SteerPayload):
    """Overrides the agent's focus dynamically mid-run."""
    SESSION_STEERING[payload.session_id] = payload.steer_text
    return {"message": "Agent steered."}

# ─── Existing Routes (Untouched) ─────────────────────────────────────────────

@router.get("/frameworks")
async def frameworks():
    return FRAMEWORK_REGISTRY

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
                # Ensure unique identifier for each variant
                display_agent = f"{model_name} ({agent_name})"
                
                # Clone to avoid mutations
                r_copy = dict(r)
                r_copy["agent"] = display_agent
                
                # Simple dedup strategy if same run exists
                sig = f"{r_copy['task']}::{display_agent}"
                if sig not in seen:
                    seen.add(sig)
                    all_results.append(r_copy)
        except Exception as e:
            print(f"Error reading {filepath}: {e}")

    # Read the main baseline file
    if BASELINE_CACHE.exists():
        _process_file(BASELINE_CACHE)
        
    # Read any extra files in baseline/results/ if it exists
    results_dir = BASELINE_CACHE.parent / "results"
    if results_dir.exists():
        for p in results_dir.glob("*.json"):
            _process_file(p)
            
    return {"results": all_results}

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await ws_manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(session_id, websocket)