"""
routers/dashboard.py — Campus404
Admin dashboard: metrics, system health, recent activity.
"""
import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from database import get_db, engine
from models import Badge, Lab, Challenge, Submission, User
from models import PlatformSetting
from templates_config import templates

router = APIRouter()


def _check_judge0(db: Session) -> bool:
    """Ping Judge0 using the URL from platform settings. Returns True if online."""
    try:
        row = db.query(PlatformSetting).filter_by(key="judge0_api_url").first()
        url = (row.value if row else None) or "http://judge0:2358"
        resp = httpx.get(f"{url}/about", timeout=2.0)
        return resp.status_code < 500
    except Exception:
        return False


def _check_db() -> bool:
    """Simple SELECT 1 to confirm the DB is up."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@router.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    recent = (
        db.query(Submission)
        .options(joinedload(Submission.user), joinedload(Submission.challenge))
        .order_by(Submission.timestamp.desc())
        .limit(8)
        .all()
    )
    return templates.TemplateResponse("admin/dashboard.html", {
        "request":            request,
        "active":             "dashboard",
        "user_count":         db.query(User).count(),
        "admin_count":        db.query(User).filter(User.is_admin == True).count(),
        "lab_count":          db.query(Lab).count(),
        "challenge_count":    db.query(Challenge).count(),
        "submission_count":   db.query(Submission).count(),
        "badge_count":        db.query(Badge).count(),
        "recent_submissions": recent,
        "judge0_ok":          _check_judge0(db),
        "db_ok":              _check_db(),
    })
