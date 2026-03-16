from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sys
import os
from pathlib import Path

# Add the repo root to sys.path so 'sandbox' module is always resolvable
# This must happen BEFORE any imports that depend on it
_repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from database import Base, engine
import models                              # User model
import curriculum.models                   # Lab, Module, Challenge, Badge, UserBadge, ChallengeCompletion
from authentications.router import router as auth_router
from admin.users    import router as admin_users_router
from admin.stats    import router as admin_stats_router
from admin.uploads  import router as upload_router
from admin.badges   import router as badges_router
from admin.logs     import router as logs_router
from admin.site_settings import public_router as site_settings_public_router
from admin.site_settings import admin_router as site_settings_admin_router
from curriculum.router import router as curriculum_router
from progress.router import router as progress_router

# Ensure uploads directory exists at startup
UPLOADS_DIR = Path("/app/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Sandbox import is optional — gracefully skip if unavailable
try:
    from sandbox import judge_api
    _sandbox_available = True
except ModuleNotFoundError:
    judge_api = None
    _sandbox_available = False

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

# ── 3. Mount static uploads directory ─────────────────────────────────
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# ── 4. Include Routers ────────────────────────────────────────────────
app.include_router(auth_router,        prefix="/api/auth",         tags=["Authentication"])
app.include_router(admin_users_router, prefix="/api/admin/users",  tags=["Admin – Users"])
app.include_router(admin_stats_router, prefix="/api/admin/stats",  tags=["Admin – Stats"])
app.include_router(upload_router,      prefix="/api/admin",        tags=["Admin – Media"])
app.include_router(upload_router,      prefix="/api",              tags=["Media – Public"])
app.include_router(badges_router,      prefix="/api/admin",        tags=["Admin – Badges"])
app.include_router(logs_router,        prefix="/api/admin/system-logs", tags=["Admin – Logs"])
app.include_router(site_settings_public_router, prefix="/api", tags=["Site Settings"])
app.include_router(site_settings_admin_router,  prefix="/api/admin", tags=["Admin – Site Settings"])
app.include_router(curriculum_router,  prefix="/api",              tags=["Curriculum"])
app.include_router(progress_router,    prefix="/api",              tags=["Progress"])
if _sandbox_available:
    app.include_router(judge_api.router, prefix="/api/judge", tags=["Sandbox"])

@app.get("/")
def read_root():
    return {"message": "Campus404 Backend API is running.", "sandbox": _sandbox_available}
