"""ARIA — FastAPI Application Factory"""
from __future__ import annotations
import os
import uvicorn  # Added for the main() entry point
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# 1. Import the split routers
from server.routes_openenv import router as openenv_router
from server.routes_aria import router as aria_router

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

# 2. Mount API routes
app.include_router(openenv_router)
app.include_router(aria_router, prefix="/aria")

# Serve built React assets
if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

# Health endpoint (required for HF Spaces)
@app.get("/health")
async def health(): 
    return {"status": "ok"}

# API path prefixes
API_PREFIXES = (
    "reset", "step", "state", "tasks", "grader", "baseline",
    "frameworks", "leaderboard", "ws", "health", "assets", "openapi",
    "docs", "redoc", "aria"
)

@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    index = STATIC_DIR / "index.html"
    # Ensure we don't intercept API calls
    if not any(full_path.startswith(prefix) for prefix in API_PREFIXES) and index.exists():
        return FileResponse(str(index))
    
    # If it's an API route that doesn't exist, FastAPI's router 
    # would have caught it before this catch-all. 
    # If we are here and it's not a React route, it's a 404.
    raise HTTPException(status_code=404, detail="Not found")

# --- OPENENV MANDATORY ENTRY POINTS ---

def main():
    """
    The explicit entry point that OpenEnv uses to launch your server.
    Matches the [project.scripts] 'server = "server.app:main"' entry in pyproject.toml.
    """
    # Use the string import path so uvicorn can find the app instance
    uvicorn.run("server.app:app", host="0.0.0.0", port=7860, reload=False)

if __name__ == "__main__":
    main()