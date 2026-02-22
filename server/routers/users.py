"""
routers/users.py — Campus404
Admin user management: list, toggle admin/ban, detail, XP adjust, password reset.
"""
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from passlib.context import CryptContext
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import User, UserProgress, Challenge
from templates_config import templates

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.get("/admin/users", response_class=HTMLResponse)
async def admin_users(
    request: Request,
    db: Session = Depends(get_db),
    msg: str = None,
    msg_type: str = "success",
):
    return templates.TemplateResponse("admin/users.html", {
        "request": request, "active": "users",
        "users":   db.query(User).order_by(User.id).all(),
        "msg": msg, "msg_type": msg_type,
    })


@router.get("/admin/users/{user_id}", response_class=HTMLResponse)
async def admin_user_detail(
    user_id: int, request: Request, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    progress = (
        db.query(UserProgress)
        .options(joinedload(UserProgress.challenge))
        .filter(UserProgress.user_id == user_id)
        .all()
    )
    # Find challenge the student is currently stuck on (lowest incomplete)
    incomplete = [p for p in progress if not p.is_completed]
    current_challenge = None
    if incomplete:
        # sort by challenge order_number
        incomplete_sorted = sorted(incomplete, key=lambda p: p.challenge.order_number if p.challenge else 0)
        current_challenge = incomplete_sorted[0].challenge if incomplete_sorted else None

    return templates.TemplateResponse("admin/user_detail.html", {
        "request":      request,
        "active":       "users",
        "user":         user,
        "progress":     progress,
        "current_challenge": current_challenge,
    })


@router.post("/admin/users/{user_id}/toggle-admin")
async def toggle_admin(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_admin = not user.is_admin
        db.commit()
    return RedirectResponse("/admin/users", status_code=303)


@router.post("/admin/users/{user_id}/toggle-ban")
async def toggle_ban(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_banned = not user.is_banned
        db.commit()
    return RedirectResponse("/admin/users", status_code=303)


@router.post("/admin/users/{user_id}/adjust-xp")
async def adjust_xp(
    user_id: int,
    xp_delta: int = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.total_xp = max(0, (user.total_xp or 0) + xp_delta)
        db.commit()
    return RedirectResponse(
        f"/admin/users/{user_id}?msg=XP+updated&msg_type=success",
        status_code=303,
    )


@router.post("/admin/users/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    new_password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user and hasattr(user, "password"):
        hashed_password = pwd_context.hash(new_password)
        user.password = hashed_password
        db.commit()
    return RedirectResponse(
        f"/admin/users/{user_id}?msg=Password+reset&msg_type=success",
        status_code=303,
    )
