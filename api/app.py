"""ARIA — FastAPI Application Factory"""
from __future__ import annotations
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# 1. Import the split routers according to the Bible [cite: 1061, 1062]
from api.routes_openenv import router as openenv_router
from api.routes_aria import router as aria_router

STATIC_DIR = Path(__file__).parent.parent / "static"

app = FastAPI(
    title="ARIA — Agentic Regulatory Intelligence Architecture",
    description="The first RL environment for multi-framework regulatory compliance auditing.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Mount API routes [cite: 1064, 1065]
app.include_router(openenv_router)
app.include_router(aria_router, prefix="/aria")

# Serve built React assets
if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

# Health endpoint (required for HF Spaces) [cite: 1069, 1070]
@app.get("/health")
async def health(): 
    return {"status": "ok"}

# API path prefixes — anything else → React SPA
# 3. Added "aria" to the prefixes so the React router doesn't intercept it [cite: 1074, 1075]
API_PREFIXES = (
    "reset", "step", "state", "tasks", "grader", "baseline",
    "frameworks", "leaderboard", "ws", "health", "assets", "openapi",
    "docs", "redoc", "aria"
)

@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    index = STATIC_DIR / "index.html"
    if not full_path.startswith(API_PREFIXES) and index.exists():
        return FileResponse(str(index))
    raise HTTPException(status_code=404, detail="Not found")