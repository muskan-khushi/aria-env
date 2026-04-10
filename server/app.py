"""ARIA — FastAPI Application Factory v2"""
from __future__ import annotations
import os
import uvicorn
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import yaml

from server.routes_openenv import router as openenv_router
from server.routes_aria import router as aria_router

STATIC_DIR = Path(__file__).parent.parent / "static"
OPENENV_YAML = Path(__file__).parent.parent / "openenv.yaml"

app = FastAPI(
    title="ARIA — Agentic Regulatory Intelligence Architecture",
    description=(
        "The first RL environment for multi-framework regulatory compliance auditing. "
        "Implements the full OpenEnv specification with dense reward shaping, "
        "evidence chain validation, and cross-framework conflict detection."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(openenv_router)
app.include_router(aria_router, prefix="/aria")

# Serve built React assets
if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

# Static files (favicon, icons, etc.)
if STATIC_DIR.exists():
    for static_file in ["favicon.svg", "icons.svg"]:
        static_path = STATIC_DIR / static_file
        if static_path.exists():
            pass  # These are served by the catch-all below


@app.get("/health")
async def health():
    """Health check endpoint required for HF Spaces ping."""
    return {"status": "ok", "service": "aria-compliance-v1", "version": "1.0.0"}


@app.get("/openenv.yaml")
async def get_openenv_yaml():
    """Serve the OpenEnv manifest for validator."""
    if OPENENV_YAML.exists():
        with open(OPENENV_YAML) as f:
            content = yaml.safe_load(f)
        return JSONResponse(content=content)
    raise HTTPException(status_code=404, detail="openenv.yaml not found")


# API path prefixes — ensuring the React SPA doesn't "swallow" API calls
API_PREFIXES = (
    "reset", "step", "state", "tasks", "grader", "baseline",
    "frameworks", "leaderboard", "ws", "health", "assets", "openapi",
    "docs", "redoc", "aria", "openenv",
)


@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    """Serve React SPA for all non-API routes."""
    # Skip API prefixes
    if any(full_path.startswith(prefix) for prefix in API_PREFIXES):
        raise HTTPException(status_code=404, detail="Not found")

    # Try to serve as static file first
    static_file = STATIC_DIR / full_path
    if static_file.exists() and static_file.is_file():
        return FileResponse(str(static_file))

    # Fall back to React index.html
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))

    raise HTTPException(status_code=404, detail="Not found")


def main():
    """Entry point for OpenEnv validation and HF Space launch."""
    PORT = int(os.environ.get("PORT", 7860))
    uvicorn.run(
        "server.app:app",
        host="0.0.0.0",
        port=PORT,
        reload=False,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()