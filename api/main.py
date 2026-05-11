"""
campus404 Main API — auth + judge proxy.

Judge execution is fully delegated to the campus404-judge microservice.
This file contains NO execution logic — it only proxies through to the judge container.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

# Load .env — project root first, then api/ directory
_here = Path(__file__).parent
for _env_path in [_here.parent / ".env", _here / ".env"]:
    if _env_path.exists():
        load_dotenv(_env_path, override=False)
        break

from fastapi import APIRouter, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from auth.database import init_db
from auth.router import router as auth_router
from contact.router import router as contact_router
from curriculum.router import router as curriculum_router
from media.router import router as media_router

# ── Config ────────────────────────────────────────────────────────────────────

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost,http://localhost:5173").split(",")
    if o.strip()
]

# Judge microservice URL — only reachable inside Docker network
JUDGE_URL = os.getenv("JUDGE_URL", "http://campus404-judge:2358")
UPLOADS_PUBLIC_DIR = _here / "uploads" / "public"
PRIVATE_ASSETS_DIR = _here / "uploads" / "private_assets"

# Ensure public/private storage roots always exist.
UPLOADS_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
PRIVATE_ASSETS_DIR.mkdir(parents=True, exist_ok=True)


# ── App lifespan ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="campus404 API",
    version="1.0.0",
    description="Main platform API — authentication and judge proxy.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public file serving root for user-uploaded assets (URLs stored in DB).
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_PUBLIC_DIR)), name="uploads")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def healthcheck() -> dict:
    return {"status": "ok", "service": "campus404-api"}


# ── Judge proxy ───────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/v1", tags=["judge-proxy"])


class SubmissionRequest(BaseModel):
    source_code: str = Field(..., min_length=1, max_length=50_000)
    language_id: int = Field(..., examples=[71])
    stdin: str = ""
    expected_output: str | None = None


@router.post("/judge/submissions", status_code=202)
async def proxy_create_submission(payload: SubmissionRequest) -> Any:
    """
    Enqueue a code execution job in the judge microservice.
    Returns job_id immediately — client polls GET /judge/submissions/{job_id} for result.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{JUDGE_URL}/submissions",
                json={
                    "source_code": payload.source_code,
                    "language_id": payload.language_id,
                    "expected_output": payload.expected_output,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Judge service is unavailable.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Judge service timed out.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


@router.get("/judge/submissions/{job_id}")
async def proxy_get_submission(job_id: str) -> Any:
    """Poll execution result for a given job from the judge microservice."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{JUDGE_URL}/submissions/{job_id}")
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Judge service is unavailable.")


@router.get("/judge/health", tags=["meta"])
async def judge_health() -> Any:
    """Check if the judge container is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{JUDGE_URL}/health")
            return resp.json()
    except Exception:
        raise HTTPException(status_code=503, detail="Judge service unreachable.")


app.include_router(router)
app.include_router(auth_router)
app.include_router(contact_router)
app.include_router(curriculum_router)
app.include_router(media_router)
