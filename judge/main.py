"""
campus404 Judge — FastAPI entrypoint.
Runs as a standalone container accessible only on the internal Docker network.
"""

from __future__ import annotations

import os

import redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import router using absolute name (module lives in same directory)
from judge_api import router as judge_router

app = FastAPI(
    title="campus404 Judge",
    version="2.0.0",
    description="Isolated code execution microservice with Redis task queue.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Container is not public — NGINX blocks external access
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    redis_url = os.getenv("REDIS_URL", "redis://campus404-redis:6379/0")
    redis_health = {"status": "ok", "detail": "Redis ping succeeded."}
    service_status = "ok"
    try:
        redis.from_url(redis_url, decode_responses=True).ping()
    except redis.RedisError as exc:
        service_status = "degraded"
        redis_health = {"status": "degraded", "detail": str(exc)[:240]}
    return {"status": service_status, "service": "campus404-judge", "redis": redis_health}


app.include_router(judge_router)
