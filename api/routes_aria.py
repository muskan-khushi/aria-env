"""ARIA — Extended Frontend Routes"""
from __future__ import annotations
import json
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from aria.frameworks import FRAMEWORK_REGISTRY
from api.websocket import ws_manager

router = APIRouter()
BASELINE_CACHE = Path(__file__).parent.parent / "baseline" / "baseline_results.json"

# ─── GET /frameworks ──────────────────────────────────────────────────────────

@router.get("/frameworks")
async def frameworks():
    return FRAMEWORK_REGISTRY

# ─── GET /leaderboard ─────────────────────────────────────────────────────────

@router.get("/leaderboard")
async def get_leaderboard():
    path = Path(__file__).parent.parent / "baseline" / "baseline_results.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {"results": []}

# ─── WebSocket /ws/{session_id} ───────────────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await ws_manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        ws_manager.disconnect(session_id, websocket)