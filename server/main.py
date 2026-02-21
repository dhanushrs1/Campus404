from typing import List, Optional
import os
import time
from fastapi import FastAPI, Request, Depends, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy import (
    Column, Integer, String, Text, ForeignKey,
    create_engine, Boolean, DateTime, text
)
from sqlalchemy.orm import declarative_base, relationship, Session, sessionmaker
from datetime import datetime, timezone

# ==========================================
# 1. DATABASE CONNECTION (with retry)
# ==========================================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://campus_dev:dev_password@db:3306/campus404"
)

def create_engine_with_retry(url: str, retries: int = 10, delay: int = 3):
    """Retry DB connection — permanent fix for Docker race condition."""
    for attempt in range(1, retries + 1):
        try:
            eng = create_engine(url, pool_pre_ping=True)
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[Campus404] ✅ Database connected on attempt {attempt}")
            return eng
        except Exception as e:
            print(f"[Campus404] ⏳ DB not ready (attempt {attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(delay)
    raise RuntimeError("[Campus404] ❌ Could not connect to database after retries.")

engine = create_engine_with_retry(DATABASE_URL)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ==========================================
# 2. MODELS
# ==========================================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True)
    total_xp = Column(Integer, default=0)
    is_admin = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    progress = relationship("UserProgress", back_populates="user")
    submissions = relationship("Submission", back_populates="user")

class Lab(Base):
    __tablename__ = "labs"
    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    description = Column(Text)
    levels = relationship("Level", back_populates="lab")

class Level(Base):
    __tablename__ = "levels"
    id = Column(Integer, primary_key=True)
    lab_id = Column(Integer, ForeignKey("labs.id"))
    order_number = Column(Integer)
    title = Column(String(100))
    broken_code = Column(Text)
    expected_output = Column(String(200))
    hint_text = Column(Text)
    official_solution = Column(Text)
    is_published = Column(Boolean, default=False)
    repo_link = Column(String(500), nullable=True)  # optional GitHub/resource URL
    lab = relationship("Lab", back_populates="levels")
    user_progress = relationship("UserProgress", back_populates="level")
    submissions = relationship("Submission", back_populates="level")

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    level_id = Column(Integer, ForeignKey("levels.id"))
    submitted_code = Column(Text)
    status = Column(String(50))
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user = relationship("User", back_populates="submissions")
    level = relationship("Level", back_populates="submissions")

class Badge(Base):
    __tablename__ = "badges"
    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    image_url = Column(String(255))
    required_xp = Column(Integer)

class UserProgress(Base):
    __tablename__ = "user_progress"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    level_id = Column(Integer, ForeignKey("levels.id"))
    is_completed = Column(Boolean, default=False)
    failed_attempts = Column(Integer, default=0)
    user = relationship("User", back_populates="progress")
    level = relationship("Level", back_populates="user_progress")

class PlatformSetting(Base):
    """Key-value store for all platform-wide settings."""
    __tablename__ = "platform_settings"
    key         = Column(String(100), primary_key=True)
    value       = Column(Text, nullable=False)
    label       = Column(String(200))   # human-readable label for admin UI
    description = Column(Text)          # helper text shown in the form
    tab         = Column(String(50))    # which settings tab: gameplay|platform|access

Base.metadata.create_all(engine)

# ── Incremental schema migrations (safe for existing DBs) ────────────
def apply_migrations():
    """
    Add new columns to existing tables without dropping data.
    SQLAlchemy's create_all() only creates NEW tables — it never
    alters existing ones. This runs raw SQL for each new column.
    """
    migrations = [
        # (table, column, definition)
        ("levels", "repo_link", "VARCHAR(500) NULL"),
    ]
    with engine.connect() as conn:
        # Read the database name from the URL
        db_name = engine.url.database
        for table, column, definition in migrations:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl AND COLUMN_NAME = :col"
            ), {"db": db_name, "tbl": table, "col": column})
            exists = result.scalar()
            if not exists:
                conn.execute(text(
                    f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}"
                ))
                conn.commit()
                print(f"[Campus404] ✅ Migration: added `{column}` to `{table}`")
            else:
                print(f"[Campus404] ⏭  Migration: `{table}.{column}` already exists")

apply_migrations()

# ── Seed default settings (skips if they already exist) ─────────────
DEFAULT_SETTINGS = [
    # key                    value    label                                   description                                           tab
    ("max_fail_unlock",      "5",     "Failed Attempts to Unlock Repo Link",  "How many failed attempts before the repo link is revealed to the student.", "gameplay"),
    ("xp_per_level",         "100",   "XP Awarded per Level Completion",      "XP given to a user when they pass a level.",                              "gameplay"),
    ("xp_per_first_try",     "50",    "Bonus XP for First-Try Pass",          "Extra XP awarded if the student passes on their very first attempt.",      "gameplay"),
    ("platform_name",        "Campus404", "Platform Name",                   "Shown in the browser title and student-facing pages.",                     "platform"),
    ("platform_tagline",     "Learn by fixing bugs", "Platform Tagline",     "Short description shown on the login / landing screen.",                   "platform"),
    ("maintenance_mode",     "false",  "Maintenance Mode",                    "When enabled, students see a maintenance page instead of the platform.",   "platform"),
    ("allow_registrations",  "true",   "Allow New Registrations",             "Disable to prevent new users from creating accounts.",                     "access"),
    ("ban_duration_days",    "0",      "Ban Duration (days)",                  "How long a ban lasts. Set to 0 for permanent bans.",                       "access"),
]

def _seed_settings(db_session):
    for key, value, label, description, tab in DEFAULT_SETTINGS:
        exists = db_session.query(PlatformSetting).filter_by(key=key).first()
        if not exists:
            db_session.add(PlatformSetting(
                key=key, value=value, label=label,
                description=description, tab=tab,
            ))
    db_session.commit()

# Run seed once on startup
_seed_db = SessionLocal()
try:
    _seed_settings(_seed_db)
finally:
    _seed_db.close()

def get_setting(db: Session, key: str, default: str = "") -> str:
    """Convenience helper — read a single setting value."""
    row = db.query(PlatformSetting).filter_by(key=key).first()
    return row.value if row else default

# ==========================================
# 3. FASTAPI SETUP
# ==========================================
app = FastAPI(title="Campus404 API")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 4. ADMIN ROUTES — DASHBOARD
# ==========================================
@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/dashboard.html", {
        "request": request,
        "active": "dashboard",
        "user_count": db.query(User).count(),
        "lab_count": db.query(Lab).count(),
        "level_count": db.query(Level).count(),
        "submission_count": db.query(Submission).count(),
        "badge_count": db.query(Badge).count(),
        "recent_submissions": db.query(Submission).order_by(
            Submission.timestamp.desc()
        ).limit(8).all(),
    })

# ==========================================
# 5. ADMIN ROUTES — USERS
# ==========================================
@app.get("/admin/users", response_class=HTMLResponse)
async def admin_users(request: Request, db: Session = Depends(get_db),
                       msg: str = None, msg_type: str = "success"):
    return templates.TemplateResponse("admin/users.html", {
        "request": request, "active": "users",
        "users": db.query(User).all(),
        "msg": msg, "msg_type": msg_type,
    })

@app.post("/admin/users/{user_id}/toggle-admin")
async def toggle_admin(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_admin = not user.is_admin
        db.commit()
    return RedirectResponse("/admin/users", status_code=303)

@app.post("/admin/users/{user_id}/toggle-ban")
async def toggle_ban(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_banned = not user.is_banned
        db.commit()
    return RedirectResponse("/admin/users", status_code=303)

# ==========================================
# 6. ADMIN ROUTES — LABS
# ==========================================
@app.get("/admin/labs", response_class=HTMLResponse)
async def admin_labs(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/labs.html", {
        "request": request, "active": "labs",
        "labs": db.query(Lab).all(),
    })

@app.get("/admin/labs/new", response_class=HTMLResponse)
async def admin_labs_new(request: Request):
    return templates.TemplateResponse("admin/lab_form.html", {
        "request": request, "active": "labs",
        "lab": None, "action": "/admin/labs/create",
    })

@app.post("/admin/labs/create")
async def admin_labs_create(
    name: str = Form(...), description: str = Form(""),
    db: Session = Depends(get_db)
):
    db.add(Lab(name=name, description=description))
    db.commit()
    return RedirectResponse("/admin/labs", status_code=303)

@app.get("/admin/labs/{lab_id}/edit", response_class=HTMLResponse)
async def admin_labs_edit(lab_id: int, request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/lab_form.html", {
        "request": request, "active": "labs",
        "lab": db.query(Lab).filter(Lab.id == lab_id).first(),
        "action": f"/admin/labs/{lab_id}/update",
    })

@app.post("/admin/labs/{lab_id}/update")
async def admin_labs_update(lab_id: int,
    name: str = Form(...), description: str = Form(""),
    db: Session = Depends(get_db)
):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if lab:
        lab.name = name
        lab.description = description
        db.commit()
    return RedirectResponse("/admin/labs", status_code=303)

@app.post("/admin/labs/{lab_id}/delete")
async def admin_labs_delete(lab_id: int, db: Session = Depends(get_db)):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if lab:
        db.delete(lab)
        db.commit()
    return RedirectResponse("/admin/labs", status_code=303)

# ==========================================
# 7. ADMIN ROUTES — LEVELS
# ==========================================
@app.get("/admin/levels", response_class=HTMLResponse)
async def admin_levels(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/levels.html", {
        "request": request, "active": "levels",
        "levels": db.query(Level).order_by(Level.lab_id, Level.order_number).all(),
    })

@app.get("/admin/levels/new", response_class=HTMLResponse)
async def admin_levels_new(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/level_form.html", {
        "request": request, "active": "levels",
        "level": None, "labs": db.query(Lab).all(),
        "action": "/admin/levels/create",
    })

@app.post("/admin/levels/create")
async def admin_levels_create(
    lab_id: int = Form(...), order_number: int = Form(...),
    title: str = Form(...), broken_code: str = Form(""),
    expected_output: str = Form(""), hint_text: str = Form(""),
    official_solution: str = Form(""), is_published: str = Form(None),
    repo_link: str = Form(""),
    db: Session = Depends(get_db)
):
    db.add(Level(
        lab_id=lab_id, order_number=order_number, title=title,
        broken_code=broken_code, expected_output=expected_output,
        hint_text=hint_text, official_solution=official_solution,
        is_published=(is_published == "on"),
        repo_link=repo_link or None,
    ))
    db.commit()
    return RedirectResponse("/admin/levels", status_code=303)

@app.get("/admin/levels/{level_id}/edit", response_class=HTMLResponse)
async def admin_levels_edit(level_id: int, request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/level_form.html", {
        "request": request, "active": "levels",
        "level": db.query(Level).filter(Level.id == level_id).first(),
        "labs": db.query(Lab).all(),
        "action": f"/admin/levels/{level_id}/update",
    })

@app.post("/admin/levels/{level_id}/update")
async def admin_levels_update(level_id: int,
    lab_id: int = Form(...), order_number: int = Form(...),
    title: str = Form(...), broken_code: str = Form(""),
    expected_output: str = Form(""), hint_text: str = Form(""),
    official_solution: str = Form(""), is_published: str = Form(None),
    repo_link: str = Form(""),
    db: Session = Depends(get_db)
):
    level = db.query(Level).filter(Level.id == level_id).first()
    if level:
        level.lab_id = lab_id
        level.order_number = order_number
        level.title = title
        level.broken_code = broken_code
        level.expected_output = expected_output
        level.hint_text = hint_text
        level.official_solution = official_solution
        level.is_published = (is_published == "on")
        level.repo_link = repo_link or None
        db.commit()
    return RedirectResponse("/admin/levels", status_code=303)

@app.post("/admin/levels/{level_id}/delete")
async def admin_levels_delete(level_id: int, db: Session = Depends(get_db)):
    level = db.query(Level).filter(Level.id == level_id).first()
    if level:
        db.delete(level)
        db.commit()
    return RedirectResponse("/admin/levels", status_code=303)

# ==========================================
# 8. ADMIN ROUTES — SUBMISSIONS (read-only)
# ==========================================
@app.get("/admin/submissions", response_class=HTMLResponse)
async def admin_submissions(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/submissions.html", {
        "request": request, "active": "submissions",
        "submissions": db.query(Submission).order_by(
            Submission.timestamp.desc()
        ).all(),
    })

# ==========================================
# 9. ADMIN ROUTES — BADGES
# ==========================================
@app.get("/admin/badges", response_class=HTMLResponse)
async def admin_badges(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/badges.html", {
        "request": request, "active": "badges",
        "badges": db.query(Badge).all(),
    })

@app.get("/admin/badges/new", response_class=HTMLResponse)
async def admin_badges_new(request: Request):
    return templates.TemplateResponse("admin/badge_form.html", {
        "request": request, "active": "badges",
        "badge": None, "action": "/admin/badges/create",
    })

@app.post("/admin/badges/create")
async def admin_badges_create(
    name: str = Form(...), image_url: str = Form(""),
    required_xp: int = Form(0), db: Session = Depends(get_db)
):
    db.add(Badge(name=name, image_url=image_url, required_xp=required_xp))
    db.commit()
    return RedirectResponse("/admin/badges", status_code=303)

@app.post("/admin/badges/{badge_id}/delete")
async def admin_badges_delete(badge_id: int, db: Session = Depends(get_db)):
    badge = db.query(Badge).filter(Badge.id == badge_id).first()
    if badge:
        db.delete(badge)
        db.commit()
    return RedirectResponse("/admin/badges", status_code=303)

# ==========================================
# 10. ADMIN ROUTES — SETTINGS
# ==========================================
@app.get("/admin/settings", response_class=HTMLResponse)
async def admin_settings(request: Request, db: Session = Depends(get_db),
                          msg: str = None, msg_type: str = "success",
                          tab: str = "gameplay"):
    settings_list = db.query(PlatformSetting).all()
    # Group by tab for the template
    by_tab = {}
    for s in settings_list:
        by_tab.setdefault(s.tab, []).append(s)
    return templates.TemplateResponse("admin/settings.html", {
        "request": request, "active": "settings",
        "by_tab": by_tab,
        "active_tab": tab,
        "msg": msg, "msg_type": msg_type,
    })

@app.post("/admin/settings")
async def admin_settings_save(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    # Only update fields that are actual setting keys (exclude _tab)
    active_tab = form.get("_tab", "gameplay")
    for key, value in form.items():
        if key.startswith("_"):  # skip meta fields like _tab
            continue
        setting = db.query(PlatformSetting).filter_by(key=key).first()
        if setting:
            setting.value = value
    db.commit()
    return RedirectResponse(
        f"/admin/settings?msg=Settings+saved&msg_type=success&tab={active_tab}",
        status_code=303,
    )

# ==========================================
# 11. API ROOT
# ==========================================
@app.get("/")
def read_root():
    return {"message": "Campus404 Backend is Running!"}


# ==========================================
# 12. PUBLIC API — LEVEL DATA
# ==========================================
class LevelPublicResponse(BaseModel):
    """
    Safe public schema for Level data sent to the React frontend.
    CRITICAL: expected_output and official_solution are intentionally
    excluded to prevent students from cheating via the network tab.
    """
    id:           int
    title:        str
    lab_id:       int
    order_number: int
    broken_code:  Optional[str] = None
    hint_text:    Optional[str] = None
    repo_link:    Optional[str] = None

    class Config:
        from_attributes = True  # enables ORM mode (SQLAlchemy → Pydantic)


@app.get("/levels", response_model=List[LevelPublicResponse])
def api_levels(db: Session = Depends(get_db)):
    """
    Public endpoint — returns published levels only.
    Browser calls /api/levels → Nginx strips /api/ → FastAPI receives /levels.
    Safe: expected_output + official_solution are excluded by the Pydantic schema.
    """
    levels = (
        db.query(Level)
        .filter(Level.is_published == True)
        .order_by(Level.lab_id, Level.order_number)
        .all()
    )
    return levels