"""
routers/leaderboard.py — Campus404
Admin leaderboard: users ranked by total_xp (read-only).
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from database import get_db
from models import User
from templates_config import templates

router = APIRouter()


@router.get("/admin/leaderboard", response_class=HTMLResponse)
async def admin_leaderboard(request: Request, db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .order_by(User.total_xp.desc(), User.username)
        .all()
    )
    return templates.TemplateResponse("admin/leaderboard.html", {
        "request": request,
        "active":  "leaderboard",
        "users":   users,
    })
