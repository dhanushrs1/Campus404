"""
main.py — Campus404 Backend Entry Point
========================================
This file wires all feature modules together.
Feature-specific logic lives in the routers/ directory.

Structure:
  database.py        — Engine, Base, SessionLocal, migrations
  models.py          — SQLAlchemy ORM models
  settings_seed.py   — DEFAULT_SETTINGS + seeder + get_setting()
  templates_config.py — Single Jinja2 instance with all global helpers
  routers/
    dashboard.py     — /admin
    users.py         — /admin/users
    labs.py          — /admin/labs
    levels.py        — /admin/levels
    submissions.py   — /admin/submissions
    badges.py        — /admin/badges
    settings.py      — /admin/settings
    media.py         — /admin/media (Pillow-powered uploads)
    api.py           — / and /levels (public JSON for React)
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from database import Base, engine, apply_migrations, SessionLocal
from models import *  # registers all ORM models with Base.metadata
from settings_seed import seed_settings
from templates_config import templates  # shared Jinja2 instance (helpers registered inside)

# Import routers
from routers import dashboard, users, labs, levels, submissions, badges, settings, media, api

# ── 1. Create tables + run safe column migrations ─────────────────────
Base.metadata.create_all(engine)
apply_migrations()

# ── 2. Seed default settings once on startup ─────────────────────────
_seed_db = SessionLocal()
try:
    seed_settings(_seed_db)
finally:
    _seed_db.close()

# ── 3. FastAPI app ────────────────────────────────────────────────────
app = FastAPI(title="Campus404 API")
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── 4. Register routers ───────────────────────────────────────────────
app.include_router(dashboard.router)
app.include_router(users.router)
app.include_router(labs.router)
app.include_router(levels.router)
app.include_router(submissions.router)
app.include_router(badges.router)
app.include_router(settings.router)
app.include_router(media.router)
app.include_router(api.router)