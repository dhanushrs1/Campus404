"""
admin/users.py — Campus404
User management API with self-protection rules.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from jose import jwt, JWTError
from authentications.security import SECRET_KEY, ALGORITHM
import models

router = APIRouter()

# ── Helper: get current user ID from JWT ──────────────────────────────
def _current_user_id(request: Request) -> Optional[int]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("id")
    except JWTError:
        return None

def get_role(user: models.User) -> str:
    if user.is_admin:  return "admin"
    if user.is_editor: return "editor"
    return "student"

# ── GET /users — paginated with search + role filter ──────────────────
@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.User)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (models.User.username.ilike(like)) |
            (models.User.email.ilike(like)) |
            (models.User.first_name.ilike(like)) |
            (models.User.last_name.ilike(like))
        )
    if role == "admin":   q = q.filter(models.User.is_admin == True)
    elif role == "editor": q = q.filter(models.User.is_editor == True, models.User.is_admin == False)
    elif role == "student": q = q.filter(models.User.is_admin == False, models.User.is_editor == False, models.User.is_banned == False)
    elif role == "banned": q = q.filter(models.User.is_banned == True)

    total = q.count()
    users = q.order_by(models.User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "avatar_url": u.avatar_url,
                "role": get_role(u),
                "is_banned": u.is_banned,
                "is_verified": u.is_verified,
                "total_xp": u.total_xp,
                "current_streak": u.current_streak,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            }
            for u in users
        ],
    }

# ── PATCH /{id}/role — promote / demote ───────────────────────────────
@router.patch("/{user_id}/role")
async def update_role(
    user_id: int,
    request: Request,
    role: str = Query(..., enum=["admin", "editor", "student"]),
    db: Session = Depends(get_db),
):
    caller_id = _current_user_id(request)
    if caller_id and caller_id == user_id:
        raise HTTPException(status_code=403, detail="You cannot change your own role.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_admin  = (role == "admin")
    user.is_editor = (role == "editor")
    db.commit()
    return {"message": f"Role updated to {role}", "user_id": user_id, "role": role}

# ── PATCH /{id}/ban — ban / unban ─────────────────────────────────────
@router.patch("/{user_id}/ban")
async def toggle_ban(
    user_id: int,
    request: Request,
    banned: bool = Query(...),
    db: Session = Depends(get_db),
):
    caller_id = _current_user_id(request)
    if caller_id and caller_id == user_id:
        raise HTTPException(status_code=403, detail="You cannot ban yourself.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_banned = banned
    db.commit()
    action = "banned" if banned else "unbanned"
    return {"message": f"User {action} successfully", "user_id": user_id, "is_banned": banned}

# ── DELETE /{id} — permanently delete ────────────────────────────────
@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    caller_id = _current_user_id(request)
    if caller_id and caller_id == user_id:
        raise HTTPException(status_code=403, detail="You cannot delete your own account.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": "User permanently deleted", "user_id": user_id}
