"""
guide/services.py — Campus404
Business logic for Guide content type.
"""
from math import ceil
import re
from typing import List, Optional

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from . import models, schemas
import curriculum.models as cm

_SLUG_SEP_RE = re.compile(r"[^a-z0-9-]+")
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def build_image_url(request: Request, relative_path: Optional[str]) -> Optional[str]:
    if not relative_path:
        return None
    base = str(request.base_url).rstrip("/")
    return f"{base}/uploads/{relative_path}"


def slugify(value: str) -> str:
    raw = (value or "").strip().lower()
    slug = _SLUG_SEP_RE.sub("-", raw).strip("-")
    slug = re.sub(r"-+", "-", slug)
    return slug


def estimate_reading_minutes(content_html: str) -> int:
    text = _HTML_TAG_RE.sub(" ", content_html or "")
    words = [w for w in text.split() if w.strip()]
    return max(1, ceil(len(words) / 220))


def _to_list_item(request: Request, post: models.GuidePage) -> schemas.GuidePageListItem:
    module = post.module
    return schemas.GuidePageListItem(
        id=post.id,
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        is_published=post.is_published,
        module_id=module.id if module else None,
        module_title=module.title if module else None,
        module_slug=module.slug if module else None,
        module_count=1 if module else 0,
        featured_image_path=post.featured_image_path,
        featured_image_url=build_image_url(request, post.featured_image_path),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def _to_module_ref(module: cm.Module) -> schemas.GuideModuleRef:
    return schemas.GuideModuleRef(
        module_id=module.id,
        module_title=module.title,
        module_slug=module.slug,
        lab_id=module.lab.id,
        lab_title=module.lab.title,
        lab_slug=module.lab.slug,
    )


def _to_module_refs(post: models.GuidePage) -> List[schemas.GuideModuleRef]:
    if not post.module:
        return []
    return [_to_module_ref(post.module)]


def _to_admin_response(request: Request, post: models.GuidePage) -> schemas.GuidePageAdminResponse:
    module_refs = _to_module_refs(post)
    module_ids = [m.module_id for m in module_refs]
    return schemas.GuidePageAdminResponse(
        id=post.id,
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        content_html=post.content_html,
        is_published=post.is_published,
        featured_image_path=post.featured_image_path,
        featured_image_url=build_image_url(request, post.featured_image_path),
        module_id=module_ids[0] if module_ids else None,
        module_ids=module_ids,
        modules=module_refs,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def _to_public_response(request: Request, post: models.GuidePage) -> schemas.GuidePagePublicResponse:
    module_refs = _to_module_refs(post)
    return schemas.GuidePagePublicResponse(
        id=post.id,
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        content_html=post.content_html,
        featured_image_url=build_image_url(request, post.featured_image_path),
        module_id=post.module_id,
        modules=module_refs,
        updated_at=post.updated_at,
    )


def _ensure_unique_slug(db: Session, slug: str, exclude_post_id: Optional[int] = None) -> None:
    q = db.query(models.GuidePage).filter(models.GuidePage.slug == slug)
    if exclude_post_id is not None:
        q = q.filter(models.GuidePage.id != exclude_post_id)
    if q.first():
        raise HTTPException(status_code=409, detail=f"Slug '{slug}' is already in use.")


def _ensure_module_assignable(
    db: Session,
    module_id: Optional[int],
    exclude_post_id: Optional[int] = None,
) -> None:
    if module_id is None:
        return

    module = db.query(cm.Module).filter(cm.Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail=f"Module {module_id} not found.")

    q = db.query(models.GuidePage).filter(models.GuidePage.module_id == module_id)
    if exclude_post_id is not None:
        q = q.filter(models.GuidePage.id != exclude_post_id)

    assigned = q.first()
    if assigned:
        raise HTTPException(
            status_code=409,
            detail=f"Module {module_id} is already assigned to guide '{assigned.title}'.",
        )


def list_module_options(db: Session) -> List[schemas.GuideModuleOption]:
    modules = (
        db.query(cm.Module)
        .join(cm.Lab, cm.Module.lab_id == cm.Lab.id)
        .order_by(cm.Lab.title.asc(), cm.Module.order_index.asc(), cm.Module.title.asc())
        .all()
    )

    return [
        schemas.GuideModuleOption(
            module_id=module.id,
            module_title=module.title,
            module_slug=module.slug,
            lab_id=module.lab.id,
            lab_title=module.lab.title,
            lab_slug=module.lab.slug,
        )
        for module in modules
    ]


def list_admin_posts(
    db: Session,
    request: Request,
    search: Optional[str] = None,
    published: Optional[bool] = None,
) -> List[schemas.GuidePageListItem]:
    q = db.query(models.GuidePage)

    if published is not None:
        q = q.filter(models.GuidePage.is_published == published)

    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            (models.GuidePage.title.ilike(like))
            | (models.GuidePage.slug.ilike(like))
            | (models.GuidePage.excerpt.ilike(like))
        )

    posts = q.order_by(models.GuidePage.updated_at.desc()).all()
    return [_to_list_item(request, post) for post in posts]


def get_admin_post(db: Session, request: Request, post_id: int) -> schemas.GuidePageAdminResponse:
    post = db.query(models.GuidePage).filter(models.GuidePage.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Guide not found.")
    return _to_admin_response(request, post)


def create_post(db: Session, request: Request, data: schemas.GuidePageCreate) -> schemas.GuidePageAdminResponse:
    slug = data.slug or slugify(data.title)
    if not slug:
        raise HTTPException(status_code=422, detail="Could not generate a valid slug from title.")
    _ensure_unique_slug(db, slug)

    _ensure_module_assignable(db, data.module_id)

    post = models.GuidePage(
        title=data.title.strip(),
        slug=slug,
        excerpt=data.excerpt,
        content_html=data.content_html,
        featured_image_path=data.featured_image_path,
        module_id=data.module_id,
        is_published=data.is_published,
    )

    db.add(post)
    db.commit()
    db.refresh(post)
    return _to_admin_response(request, post)


def update_post(db: Session, request: Request, post_id: int, data: schemas.GuidePageUpdate) -> schemas.GuidePageAdminResponse:
    post = db.query(models.GuidePage).filter(models.GuidePage.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Guide not found.")

    update_data = data.model_dump(exclude_unset=True)

    if "slug" in update_data and update_data["slug"]:
        _ensure_unique_slug(db, update_data["slug"], exclude_post_id=post_id)

    requested_module_id = update_data.pop("module_id", post.module_id)
    module_ids = update_data.pop("module_ids", None)
    if module_ids is not None and "module_id" not in data.model_fields_set:
        requested_module_id = module_ids[0] if module_ids else None

    _ensure_module_assignable(db, requested_module_id, exclude_post_id=post_id)

    for field, value in update_data.items():
        setattr(post, field, value)

    post.module_id = requested_module_id

    if "title" in update_data and not post.slug:
        generated = slugify(post.title)
        if not generated:
            raise HTTPException(status_code=422, detail="Could not generate a valid slug from title.")
        _ensure_unique_slug(db, generated, exclude_post_id=post_id)
        post.slug = generated

    db.commit()
    db.refresh(post)
    return _to_admin_response(request, post)


def delete_post(db: Session, post_id: int) -> dict:
    post = db.query(models.GuidePage).filter(models.GuidePage.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Guide not found.")

    db.delete(post)
    db.commit()
    return {"message": "Guide deleted.", "id": post_id}


def get_public_post(db: Session, request: Request, slug: str) -> schemas.GuidePagePublicResponse:
    post = (
        db.query(models.GuidePage)
        .filter(models.GuidePage.slug == slug, models.GuidePage.is_published == True)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Guide not found.")
    return _to_public_response(request, post)


def list_module_guide_pages(db: Session, request: Request, module_id: int) -> List[schemas.ModuleGuideCard]:
    posts = (
        db.query(models.GuidePage)
        .filter(
            models.GuidePage.module_id == module_id,
            models.GuidePage.is_published == True,
        )
        .order_by(models.GuidePage.updated_at.desc())
        .all()
    )

    return [
        schemas.ModuleGuideCard(
            id=post.id,
            title=post.title,
            slug=post.slug,
            excerpt=post.excerpt,
            featured_image_url=build_image_url(request, post.featured_image_path),
            reading_minutes=estimate_reading_minutes(post.content_html),
            updated_at=post.updated_at,
        )
        for post in posts
    ]
