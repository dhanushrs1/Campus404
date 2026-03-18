"""
admin/site_settings.py — Campus404
Persisted site branding settings for logo and favicon.
"""
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from authentications.security import ALGORITHM, SECRET_KEY
from database import get_db
import models

public_router = APIRouter()
admin_router = APIRouter()

ALLOWED_LOGO_EXTS = {"svg", "png", "jpg", "jpeg", "webp", "avif"}
ALLOWED_ICON_EXTS = {"svg", "png", "ico", "jpg", "jpeg", "webp"}


def _normalize_optional(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _extract_ext(url: str) -> str:
    path = urlparse(url).path.lower()
    if "." not in path:
        return ""
    return path.rsplit(".", 1)[-1]


def _iso_utc(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _validate_asset_url(url: Optional[str], allowed_exts: set[str], label: str) -> Optional[str]:
    url = _normalize_optional(url)
    if not url:
        return None

    if not (url.startswith("/") or url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(
            status_code=422,
            detail=f"{label} must start with '/' or be an absolute http(s) URL.",
        )

    ext = _extract_ext(url)
    if ext and ext not in allowed_exts:
        allowed = ", ".join(sorted(allowed_exts))
        raise HTTPException(
            status_code=422,
            detail=f"{label} format is not supported. Allowed formats: {allowed}.",
        )

    return url


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


def _get_or_create_settings(db: Session) -> models.SiteSetting:
    settings = db.query(models.SiteSetting).order_by(models.SiteSetting.id.asc()).first()
    if settings:
        return settings

    settings = models.SiteSetting(
        site_name="Campus404",
        meta_description="Campus404 hands-on coding labs and guided learning tracks.",
        site_logo_width=220,
        site_logo_height=48,
        guide_default_author="Campus404 Guide Team",
        guide_show_toc=True,
        guide_toc_depth=3,
        guide_show_social_share=True,
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def _to_response(settings: models.SiteSetting) -> dict:
    logo_ext = _extract_ext(settings.site_logo_url) if settings.site_logo_url else ""
    icon_ext = _extract_ext(settings.site_icon_url) if settings.site_icon_url else ""

    return {
        "site_name": settings.site_name,
        "meta_description": settings.meta_description,
        "site_logo_url": settings.site_logo_url,
        "site_logo_width": settings.site_logo_width,
        "site_logo_height": settings.site_logo_height,
        "site_icon_url": settings.site_icon_url,
        "guide_default_author": settings.guide_default_author,
        "guide_show_toc": bool(settings.guide_show_toc),
        "guide_toc_depth": int(settings.guide_toc_depth or 3),
        "guide_show_social_share": bool(settings.guide_show_social_share),
        "logo_is_svg": logo_ext == "svg",
        "icon_is_svg": icon_ext == "svg",
        "updated_at": _iso_utc(settings.updated_at),
    }


class SiteSettingsIn(BaseModel):
    site_name: str = Field(default="Campus404", min_length=2, max_length=120)
    meta_description: Optional[str] = Field(default=None, max_length=320)
    site_logo_url: Optional[str] = Field(default=None, max_length=512)
    site_logo_width: int = Field(default=220, ge=64, le=600)
    site_logo_height: int = Field(default=48, ge=24, le=240)
    site_icon_url: Optional[str] = Field(default=None, max_length=512)
    guide_default_author: Optional[str] = Field(default="Campus404 Guide Team", max_length=120)
    guide_show_toc: bool = Field(default=True)
    guide_toc_depth: int = Field(default=3, ge=2, le=4)
    guide_show_social_share: bool = Field(default=True)

    @field_validator("site_name")
    @classmethod
    def clean_site_name(cls, value: str) -> str:
        clean = value.strip()
        if len(clean) < 2:
            raise ValueError("site_name must have at least 2 characters")
        return clean

    @field_validator("meta_description", "site_logo_url", "site_icon_url", "guide_default_author")
    @classmethod
    def normalize_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional(value)


@public_router.get("/site-settings")
def get_site_settings(db: Session = Depends(get_db)):
    settings = _get_or_create_settings(db)
    return _to_response(settings)


@admin_router.get("/site-settings")
def get_site_settings_admin(request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    settings = _get_or_create_settings(db)
    return _to_response(settings)


@admin_router.put("/site-settings")
def update_site_settings(
    payload: SiteSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_admin(request, db)
    settings = _get_or_create_settings(db)

    settings.site_name = payload.site_name
    settings.meta_description = payload.meta_description
    settings.site_logo_url = _validate_asset_url(payload.site_logo_url, ALLOWED_LOGO_EXTS, "site_logo_url")
    settings.site_logo_width = payload.site_logo_width
    settings.site_logo_height = payload.site_logo_height
    settings.site_icon_url = _validate_asset_url(payload.site_icon_url, ALLOWED_ICON_EXTS, "site_icon_url")
    settings.guide_default_author = payload.guide_default_author or "Campus404 Guide Team"
    settings.guide_show_toc = payload.guide_show_toc
    settings.guide_toc_depth = payload.guide_toc_depth
    settings.guide_show_social_share = payload.guide_show_social_share
    settings.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(settings)
    return _to_response(settings)
