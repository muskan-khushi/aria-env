"""ARIA — FastAPI Application Factory"""
from __future__ import annotations
import os
import uvicorn
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
# Logic: routes_aria handles /frameworks, /leaderboard, and /demo/start
app.include_router(openenv_router)
app.include_router(aria_router, prefix="/aria")

# Serve built React assets
if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

# Health endpoint (required for HF Spaces)
@app.get("/health")
async def health(): 
    return {"status": "ok"}

# API path prefixes — ensuring the React SPA doesn't "swallow" API calls
API_PREFIXES = (
    "reset", "step", "state", "tasks", "grader", "baseline",
    "frameworks", "leaderboard", "ws", "health", "assets", "openapi",
    "docs", "redoc", "aria"
)

@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    index = STATIC_DIR / "index.html"
    # If the path doesn't start with our API prefixes, let React handle it
    if not any(full_path.startswith(prefix) for prefix in API_PREFIXES) and index.exists():
        return FileResponse(str(index))
    
    raise HTTPException(status_code=404, detail="Not found")

def main():
    """Entry point for OpenEnv validation and HF Space launch."""
    PORT = int(os.environ.get("PORT", 7860))
    uvicorn.run("server.app:app", host="0.0.0.0", port=PORT, reload=False)

if __name__ == "__main__":
    main()