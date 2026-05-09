"""
campus404 Judge — FastAPI entrypoint.
Runs as a standalone container accessible only on the internal Docker network.
"""

from __future__ import annotations

import os

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
    return {"status": "ok", "service": "campus404-judge"}


app.include_router(judge_router)
