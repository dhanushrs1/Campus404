"""
routers/submissions.py — Campus404
Admin submissions view — read-only with filtering and code playback.
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Submission, User, Level
from templates_config import templates

router = APIRouter()


@router.get("/admin/submissions", response_class=HTMLResponse)
async def admin_submissions(
    request: Request,
    db: Session = Depends(get_db),
    user_id: int = None,
    level_id: int = None,
    status: str = None,
):
    query = (
        db.query(Submission)
        .options(joinedload(Submission.user), joinedload(Submission.level))
        .order_by(Submission.timestamp.desc())
    )
    if user_id:
        query = query.filter(Submission.user_id == user_id)
    if level_id:
        query = query.filter(Submission.level_id == level_id)
    if status:
        query = query.filter(Submission.status == status)

    return templates.TemplateResponse("admin/submissions.html", {
        "request":     request,
        "active":      "submissions",
        "submissions": query.all(),
        "users":       db.query(User).order_by(User.username).all(),
        "levels":      db.query(Level).order_by(Level.title).all(),
        "filter_user_id":  user_id,
        "filter_level_id": level_id,
        "filter_status":   status,
    })


@router.get("/admin/submissions/{submission_id}/playback", response_class=HTMLResponse)
async def admin_submission_playback(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    sub = (
        db.query(Submission)
        .options(joinedload(Submission.user), joinedload(Submission.level))
        .filter(Submission.id == submission_id)
        .first()
    )
    return templates.TemplateResponse("admin/submission_playback.html", {
        "request": request,
        "active":  "submissions",
        "sub":     sub,
    })
