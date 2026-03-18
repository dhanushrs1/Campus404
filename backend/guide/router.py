"""
guide/router.py — Campus404
Routes for Guide page content type.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models as user_models
from authentications.security import ALGORITHM, SECRET_KEY
from database import get_db
from . import schemas, services

router = APIRouter()


def _require_admin_or_editor(request: Request, db: Session) -> user_models.User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")

    try:
        payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token.")

    user = db.query(user_models.User).filter(user_models.User.id == user_id).first()
    if not user or (not user.is_admin and not user.is_editor):
        raise HTTPException(status_code=403, detail="Admin or editor access required.")
    return user


@router.get("/admin/guide/module-options", response_model=List[schemas.GuideModuleOption])
def list_module_options(request: Request, db: Session = Depends(get_db)):
    _require_admin_or_editor(request, db)
    return services.list_module_options(db)


@router.get("/admin/guide", response_model=List[schemas.GuidePageListItem])
def list_guide_pages(
    request: Request,
    search: Optional[str] = Query(None),
    published: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    _require_admin_or_editor(request, db)
    return services.list_admin_posts(db, request, search=search, published=published)


@router.get("/admin/guide/{post_id}", response_model=schemas.GuidePageAdminResponse)
def get_guide_page(post_id: int, request: Request, db: Session = Depends(get_db)):
    _require_admin_or_editor(request, db)
    return services.get_admin_post(db, request, post_id)


@router.post("/admin/guide", response_model=schemas.GuidePageAdminResponse, status_code=201)
def create_guide_page(data: schemas.GuidePageCreate, request: Request, db: Session = Depends(get_db)):
    _require_admin_or_editor(request, db)
    return services.create_post(db, request, data)


@router.patch("/admin/guide/{post_id}", response_model=schemas.GuidePageAdminResponse)
def update_guide_page(
    post_id: int,
    data: schemas.GuidePageUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_admin_or_editor(request, db)
    return services.update_post(db, request, post_id, data)


@router.delete("/admin/guide/{post_id}")
def delete_guide_page(post_id: int, request: Request, db: Session = Depends(get_db)):
    _require_admin_or_editor(request, db)
    return services.delete_post(db, post_id)


# Public read endpoints (no archive endpoint by design)
@router.get("/guide/{slug}", response_model=schemas.GuidePagePublicResponse)
def get_public_guide_page(slug: str, request: Request, db: Session = Depends(get_db)):
    return services.get_public_post(db, request, slug)


@router.get("/modules/{module_id}/guide", response_model=List[schemas.ModuleGuideCard])
def get_module_guide_pages(module_id: int, request: Request, db: Session = Depends(get_db)):
    return services.list_module_guide_pages(db, request, module_id)
