from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# Add parent directory to path so local execution can find "sandbox" module directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, engine
import models
from authentications.router import router as auth_router
from sandbox import judge_api

# ── 1. Create tables ──────────────────────────────────────────────────
Base.metadata.create_all(engine)

# ── 2. FastAPI app ────────────────────────────────────────────────────
app = FastAPI(
    title="Campus404 Backend API",
    description="Consolidated backend for handling Authentication, Database logic, and Sandbox proxying.",
    version="1.0.0"
)

# Configure CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 3. Include Routers ────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(judge_api.router, prefix="/api/judge", tags=["sandbox"])

@app.get("/")
def read_root():
    return {"message": "Campus404 Backend API is running natively."}
