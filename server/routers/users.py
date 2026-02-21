"""
routers/users.py — Campus404
Admin user management routes: list users, toggle admin, toggle ban.
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import User
from templates_config import templates

router = APIRouter()


@router.get("/admin/users", response_class=HTMLResponse)
async def admin_users(
    request: Request,
    db: Session = Depends(get_db),
    msg: str = None,
    msg_type: str = "success",
):
    return templates.TemplateResponse("admin/users.html", {
        "request": request, "active": "users",
        "users": db.query(User).all(),
        "msg": msg, "msg_type": msg_type,
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
