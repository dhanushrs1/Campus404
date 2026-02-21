"""
routers/dashboard.py — Campus404
Admin dashboard route.
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Badge, Lab, Level, Submission, User
from templates_config import templates

router = APIRouter()


@router.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/dashboard.html", {
        "request": request,
        "active": "dashboard",
        "user_count":        db.query(User).count(),
        "lab_count":         db.query(Lab).count(),
        "level_count":       db.query(Level).count(),
        "submission_count":  db.query(Submission).count(),
        "badge_count":       db.query(Badge).count(),
        "recent_submissions": db.query(Submission).order_by(
            Submission.timestamp.desc()
        ).limit(8).all(),
    })
