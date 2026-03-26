"""ARIA — FastAPI Application Factory"""
from __future__ import annotations
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router

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

# Mount API routes
app.include_router(router)

# Serve built React assets
if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

# API path prefixes — anything else → React SPA
API_PREFIXES = (
    "reset", "step", "state", "tasks", "grader", "baseline",
    "frameworks", "leaderboard", "ws", "health", "assets", "openapi",
    "docs", "redoc",
)

@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    index = STATIC_DIR / "index.html"
    if not full_path.startswith(API_PREFIXES) and index.exists():
        return FileResponse(str(index))
    raise HTTPException(status_code=404, detail="Not found")