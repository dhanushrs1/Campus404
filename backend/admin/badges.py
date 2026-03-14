"""admin/badges.py — Campus404
Admin CRUD for Badges (linked to Modules, with image upload support).
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import uuid
from pathlib import Path
from jose import jwt, JWTError

from database import get_db
from authentications.security import SECRET_KEY, ALGORITHM
import models
import curriculum.models as cm

router = APIRouter()
UPLOADS_ROOT = Path("/app/uploads")


# ── Auth helper ────────────────────────────────────────────────────────────────
def _require_admin(request: Request, db: Session) -> models.User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or (not user.is_admin and not user.is_editor):
        raise HTTPException(status_code=403, detail="Admin or editor access required.")
    return user


# ── Schemas ────────────────────────────────────────────────────────────────────
class BadgeOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    image_path: Optional[str]
    image_url: Optional[str]
    module_id: Optional[int]
    module_title: Optional[str]
    created_at: datetime
    earned_count: int

    model_config = {"from_attributes": True}


def _build_badge_out(badge: cm.Badge, request: Request) -> BadgeOut:
    base = str(request.base_url).rstrip("/")
    img = badge.image_url or (f"{base}/uploads/{badge.image_path}" if badge.image_path else None)
    earned = len(badge.earned_by)
    mod_title = badge.module.title if badge.module else None
    return BadgeOut(
        id=badge.id, name=badge.name, description=badge.description,
        image_path=badge.image_path, image_url=img,
        module_id=badge.module_id, module_title=mod_title,
        created_at=badge.created_at, earned_count=earned,
    )


# ── CRUD ───────────────────────────────────────────────────────────────────────
@router.get("/badges", response_model=List[BadgeOut])
def list_badges(request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    badges = db.query(cm.Badge).order_by(cm.Badge.created_at.desc()).all()
    return [_build_badge_out(b, request) for b in badges]


@router.post("/badges", response_model=BadgeOut, status_code=201)
async def create_badge(
    request: Request,
    name: str = Form(...),
    description: str = Form(None),
    module_id: int = Form(None),
    image_url: str = Form(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    _require_admin(request, db)

    if module_id:
        existing = db.query(cm.Badge).filter(cm.Badge.module_id == module_id).first()
        if existing:
            raise HTTPException(400, f"Module already has a badge: '{existing.name}'.")

    img_path = None
    if image and image.filename:
        ext = Path(image.filename).suffix.lower()
        safe_name = f"{uuid.uuid4().hex}{ext}"
        dest_dir = UPLOADS_ROOT / "badges"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / safe_name
        content = await image.read()
        dest.write_bytes(content)
        img_path = f"badges/{safe_name}"

    badge = cm.Badge(name=name, description=description, module_id=module_id,
                      image_path=img_path, image_url=image_url if not img_path else None)
    db.add(badge)
    db.commit()
    db.refresh(badge)
    return _build_badge_out(badge, request)


@router.patch("/badges/{badge_id}", response_model=BadgeOut)
async def update_badge(
    badge_id: int,
    request: Request,
    name: str = Form(None),
    description: str = Form(None),
    module_id: int = Form(None),
    image_url: str = Form(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    _require_admin(request, db)
    badge = db.query(cm.Badge).filter(cm.Badge.id == badge_id).first()
    if not badge:
        raise HTTPException(404, "Badge not found.")

    if name: badge.name = name
    if description is not None: badge.description = description
    if module_id is not None: badge.module_id = module_id

    if image and image.filename:
        ext = Path(image.filename).suffix.lower()
        safe_name = f"{uuid.uuid4().hex}{ext}"
        dest_dir = UPLOADS_ROOT / "badges"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / safe_name
        content = await image.read()
        dest.write_bytes(content)
        badge.image_path = f"badges/{safe_name}"
        badge.image_url = None
    elif image_url is not None:
        badge.image_url = image_url
        badge.image_path = None

    db.commit()
    db.refresh(badge)
    return _build_badge_out(badge, request)


@router.delete("/badges/{badge_id}")
def delete_badge(badge_id: int, request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    badge = db.query(cm.Badge).filter(cm.Badge.id == badge_id).first()
    if not badge:
        raise HTTPException(404, "Badge not found.")
    db.delete(badge)
    db.commit()
    return {"message": "Badge deleted.", "id": badge_id}
