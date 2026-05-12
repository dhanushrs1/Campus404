"""
campus404 Judge — API Router (Task Queue Version)

Endpoints:
  POST /submissions          → enqueue a job, return job_id immediately
  GET  /submissions/{job_id} → poll job status from Redis
"""

from __future__ import annotations

import json
import os
import uuid

import redis
from fastapi import APIRouter, HTTPException

from schemas import CodeSubmission

router = APIRouter()

# ── Redis connection ──────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://campus404-redis:6379/0")
_redis: redis.Redis = redis.from_url(REDIS_URL, decode_responses=True)

JOB_TTL = 3600          # seconds — 1 hour
QUEUE_KEY = "execution_queue"


# ── POST /submissions ─────────────────────────────────────────────────────────

@router.post("/submissions", status_code=202)
def create_submission(payload: CodeSubmission) -> dict:
    """
    Enqueue a code execution job.
    Returns job_id immediately — client polls GET /submissions/{job_id} for result.
    """
    job_id = str(uuid.uuid4())

    # Store initial pending state in Redis with TTL
    state = json.dumps({"status": "pending", "output": None, "error": None})
    _redis.set(f"job:{job_id}", state, ex=JOB_TTL)

    # Push job onto the execution queue (worker consumes from the right)
    job_payload = json.dumps({
        "job_id": job_id,
        "source_code": payload.source_code,
        "language_id": payload.language_id,
        # Evaluation fields — all optional
        "stdin": payload.stdin,
        "expected_output": payload.expected_output,           # legacy
        "expected_outputs": payload.expected_outputs or [],   # new multi-value
        "match_mode": payload.match_mode or "normalize",
        "files": [item.model_dump() for item in (payload.files or [])],
        "entrypoint": payload.entrypoint,
        "validation_kind": payload.validation_kind or "code",
        "validation_config": payload.validation_config or {},
        "timeout_ms": payload.timeout_ms,
        "memory_limit_mb": payload.memory_limit_mb,
        "custom_judge_options": payload.custom_judge_options or {},
    })
    _redis.lpush(QUEUE_KEY, job_payload)

    return {"job_id": job_id, "status": "pending"}


# ── GET /submissions/{job_id} ─────────────────────────────────────────────────

@router.get("/submissions/{job_id}")
def get_submission(job_id: str) -> dict:
    """Poll the execution result for a given job."""
    raw = _redis.get(f"job:{job_id}")
    if raw is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return json.loads(raw)
