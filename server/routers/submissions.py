"""
routers/submissions.py — Campus404
Admin submissions route (read-only view).
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Submission
from templates_config import templates

router = APIRouter()


@router.get("/admin/submissions", response_class=HTMLResponse)
async def admin_submissions(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/submissions.html", {
        "request": request, "active": "submissions",
        "submissions": db.query(Submission).order_by(
            Submission.timestamp.desc()
        ).all(),
    })
