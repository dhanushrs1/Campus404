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

from diagnostics_client import report_operational_error
from schemas import CodeSubmission

router = APIRouter()

# ── Redis connection ──────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://campus404-redis:6379/0")
_redis: redis.Redis = redis.from_url(REDIS_URL, decode_responses=True)

JOB_TTL = 3600          # seconds — 1 hour
QUEUE_KEY = "execution_queue"


def _redis_unavailable(operation: str, message: str, exc: redis.RedisError) -> None:
    report_operational_error(
        source_service="judge-api",
        error_kind="redis_error",
        message=message,
        operation=operation,
        exc=exc,
    )
    raise HTTPException(status_code=503, detail="Judge queue is unavailable.") from exc


def _set_pending_state(job_id: str, state: str) -> None:
    try:
        _redis.set(f"job:{job_id}", state, ex=JOB_TTL)
    except redis.RedisError as exc:
        _redis_unavailable("POST /submissions", f"Redis failed while queueing judge job {job_id}.", exc)


def _push_job(job_id: str, payload: str) -> None:
    try:
        _redis.lpush(QUEUE_KEY, payload)
    except redis.RedisError as exc:
        _redis_unavailable("POST /submissions", f"Redis failed while queueing judge job {job_id}.", exc)


def _get_job_state(job_id: str) -> str | None:
    try:
        return _redis.get(f"job:{job_id}")
    except redis.RedisError as exc:
        _redis_unavailable("GET /submissions/{job_id}", f"Redis failed while polling judge job {job_id}.", exc)
    return None


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
    _set_pending_state(job_id, state)

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
    _push_job(job_id, job_payload)

    return {"job_id": job_id, "status": "pending"}


# ── GET /submissions/{job_id} ─────────────────────────────────────────────────

@router.get("/submissions/{job_id}")
def get_submission(job_id: str) -> dict:
    """Poll the execution result for a given job."""
    raw = _get_job_state(job_id)
    if raw is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return json.loads(raw)
