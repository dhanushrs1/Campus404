from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.database import get_db
from auth.jwt_utils import _decode
from auth.models import User, UserSession
from media.models import MediaFile
from media.storage_provider import (
    build_cloud_public_id,
    build_storage_settings_response,
    delete_cloudinary_asset,
    ensure_cloudinary_config_ready,
    ensure_provider_active,
    get_or_create_storage_settings,
    resolve_cloudinary_config,
    test_cloudinary_connection,
    touch_storage_settings_test_status,
    touch_storage_settings_updated,
    upload_blob_to_cloudinary,
)

router = APIRouter(tags=["media"])

ELEVATED_ROLES = {"ADMIN", "EDITOR"}
MAX_MEDIA_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_MEDIA_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/avif",
    "image/png",
    "image/x-png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/svg+xml",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "application/zip",
}
ALLOWED_MEDIA_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".jfif",
    ".pjpeg",
    ".avif",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".svg",
    ".mp4",
    ".webm",
    ".mov",
    ".mp3",
    ".wav",
    ".ogg",
    ".pdf",
    ".txt",
    ".md",
    ".json",
    ".csv",
    ".zip",
}
PREFERRED_SUFFIX_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/pjpeg": ".jpg",
    "image/avif": ".avif",
    "image/png": ".png",
    "image/x-png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/json": ".json",
    "text/csv": ".csv",
    "application/zip": ".zip",
}


class DeleteMediaRequest(BaseModel):
    relative_path: str


class StorageSettingsUpdateRequest(BaseModel):
    active_provider: str
    cloudinary_folder_prefix: str | None = None


class StorageSettingsTestRequest(BaseModel):
    cloudinary_folder_prefix: str | None = None


def _token_session_version(payload: dict[str, Any]) -> int:
    raw = payload.get("sv", 1)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 1
    return value if value > 0 else 1


def _token_session_id(payload: dict[str, Any]) -> int | None:
    value = payload.get("sid")
    try:
        session_id = int(value)
    except (TypeError, ValueError):
        return None
    return session_id if session_id > 0 else None


async def get_current_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required.")

    payload = _decode(auth_header[7:])
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.")

    user = await db.scalar(select(User).where(User.username == username))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is banned.")

    token_version = _token_session_version(payload)
    user_version = int(user.session_version or 1)
    if token_version != user_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )

    session_id = _token_session_id(payload)
    if session_id:
        login_session = await db.scalar(
            select(UserSession)
            .where(UserSession.id == session_id)
            .where(UserSession.user_id == user.id)
        )
        if not login_session or login_session.logout_time is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please log in again.",
            )

    normalized_role = (user.role or payload.get("role") or "").strip().upper()
    if normalized_role not in ELEVATED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can manage media.",
        )

    return user


def _slugify_stem(value: str) -> str:
    stem = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return stem or "media"


def _normalize_cloud_reference(raw_value: str) -> str:
    normalized = (raw_value or "").strip().replace("\\", "/").strip("/")
    candidate = Path(normalized)

    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="relative_path is required.")
    if ".." in candidate.parts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path traversal is not allowed.")

    clean_parts = [part for part in candidate.parts if part not in {"", "."}]
    if not clean_parts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid relative_path value.")

    return "/".join(clean_parts)


def _allowed_media(content_type: str, suffix: str) -> bool:
    return content_type in ALLOWED_MEDIA_CONTENT_TYPES or suffix in ALLOWED_MEDIA_EXTENSIONS


def _resolve_category(content_type: str, suffix: str) -> str:
    if content_type.startswith("image/") or suffix in {".jpg", ".jpeg", ".jfif", ".pjpeg", ".avif", ".png", ".webp", ".gif", ".bmp", ".svg"}:
        return "image"
    if content_type.startswith("video/") or suffix in {".mp4", ".webm", ".mov"}:
        return "video"
    if content_type.startswith("audio/") or suffix in {".mp3", ".wav", ".ogg"}:
        return "audio"
    if suffix in {".pdf", ".txt", ".md", ".json", ".csv", ".zip"}:
        return "document"
    return "file"


@router.get("/api/admin/media/storage-settings")
async def get_media_storage_settings(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    settings = await get_or_create_storage_settings(db)
    return build_storage_settings_response(settings)


@router.put("/api/admin/media/storage-settings")
async def update_media_storage_settings(
    payload: StorageSettingsUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    settings = await get_or_create_storage_settings(db)

    ensure_provider_active(payload.active_provider)

    if payload.cloudinary_folder_prefix is not None:
        settings.cloudinary_folder_prefix = payload.cloudinary_folder_prefix

    config = resolve_cloudinary_config(settings)
    ensure_cloudinary_config_ready(config)
    ok, message = test_cloudinary_connection(config)
    touch_storage_settings_test_status(settings, ok=ok)
    if not ok:
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    settings.active_provider = "cloudinary"
    touch_storage_settings_updated(settings, updated_by_id=admin.id)

    await db.commit()
    await db.refresh(settings)

    return {
        "message": "Storage settings updated.",
        "settings": build_storage_settings_response(settings),
    }


@router.post("/api/admin/media/storage-settings/test")
async def test_media_storage_settings(
    payload: StorageSettingsTestRequest,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    settings = await get_or_create_storage_settings(db)
    overrides: dict[str, str] = {}
    if payload.cloudinary_folder_prefix is not None:
        overrides["folder_prefix"] = payload.cloudinary_folder_prefix

    config = resolve_cloudinary_config(settings, overrides=overrides)

    ok, message = test_cloudinary_connection(config)
    touch_storage_settings_test_status(settings, ok=ok)
    await db.commit()

    return {"ok": ok, "message": message}


@router.get("/api/admin/media")
async def list_media(
    q: str = Query(default="", max_length=120),
    category: str = Query(default="", max_length=32),
    folder: str = Query(default="", max_length=100),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=30, le=100),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, list[dict[str, Any]]]:
    stmt = select(MediaFile).options(selectinload(MediaFile.uploaded_by)).order_by(MediaFile.uploaded_at.desc())
    if category and category != "all":
        stmt = stmt.where(MediaFile.category == category)
    if folder:
        stmt = stmt.where(MediaFile.relative_path.contains(f"/{folder}/"))
    if q:
        search = f"%{q}%"
        stmt = stmt.where(MediaFile.filename.ilike(search) | MediaFile.original_filename.ilike(search))
        
    stmt = stmt.offset(skip).limit(limit)
    
    result = await db.execute(stmt)
    rows = result.scalars().all()
    
    items = []
    for row in rows:
        items.append({
            "id": row.id,
            "filename": row.filename,
            "original_filename": row.original_filename,
            "relative_path": row.relative_path,
            "size": row.file_size,
            "content_type": row.mime_type,
            "category": row.category,
            "url": row.url,
            "storage_provider": row.storage_provider,
            "uploaded_at": row.uploaded_at.isoformat() + "Z",
            "uploaded_by_name": row.uploaded_by.username if row.uploaded_by else "Unknown",
            "uploaded_by_role": row.uploaded_by.role if row.uploaded_by else "Unknown"
        })
    return {"items": items}


@router.post("/api/admin/media/upload")
async def upload_media(
    files: list[UploadFile] = File(...),
    folder: str = Form("media", max_length=100),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, list[dict[str, Any]]]:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files uploaded.")

    settings = await get_or_create_storage_settings(db)
    ensure_provider_active("cloudinary")
    cloudinary_config = resolve_cloudinary_config(settings)
    ensure_cloudinary_config_ready(cloudinary_config)

    active_provider = "cloudinary"
    now = datetime.utcnow()
    year = f"{now.year:04d}"
    month = f"{now.month:02d}"

    uploaded_items: list[dict[str, Any]] = []

    for file in files:
        raw_name = file.filename or "media"
        content_type = (file.content_type or "").lower()
        suffix = Path(raw_name).suffix.lower()

        if suffix not in ALLOWED_MEDIA_EXTENSIONS:
            suffix = PREFERRED_SUFFIX_BY_CONTENT_TYPE.get(content_type, suffix)

        if not _allowed_media(content_type, suffix):
            await file.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type for {raw_name}.",
            )

        blob = await file.read()
        await file.close()

        if not blob:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{raw_name} is empty.")
        if len(blob) > MAX_MEDIA_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{raw_name} exceeds max size of 25MB.",
            )

        stem = _slugify_stem(Path(raw_name).stem)
        stem_with_uuid = f"{stem}-{uuid4().hex[:12]}"
        safe_filename = f"{stem_with_uuid}{suffix}"
        cat = _resolve_category(content_type, suffix)

        # Build dynamic prefix based on folder
        base_prefix = cloudinary_config.get("folder_prefix") or "campus404"
        import re
        folder_clean = re.sub(r"[^a-zA-Z0-9_\-]", "", folder) if folder else ""
        combined_prefix = f"{base_prefix}/{folder_clean}" if folder_clean else base_prefix

        rel_path = ""
        public_id = build_cloud_public_id(
            folder_prefix=combined_prefix,
            year=year,
            month=month,
            stem_with_uuid=stem_with_uuid,
        )
        result = upload_blob_to_cloudinary(
            blob,
            public_id=public_id,
            content_type=content_type,
            config=cloudinary_config,
        )
        cloud_public_id = str(result.get("public_id") or public_id)
        cloud_resource_type = str(result.get("resource_type") or "raw")
        media_url = str(result.get("secure_url") or "")
        rel_path = cloud_public_id
        
        db_file = MediaFile(
            filename=safe_filename,
            original_filename=raw_name,
            relative_path=rel_path,
            file_size=len(blob),
            mime_type=content_type,
            category=cat,
            url=media_url,
            storage_provider=active_provider,
            cloud_public_id=cloud_public_id,
            cloud_resource_type=cloud_resource_type,
            uploaded_by_id=admin.id,
            uploaded_at=now
        )
        db.add(db_file)

        uploaded_items.append({
            "filename": safe_filename,
            "original_filename": raw_name,
            "relative_path": rel_path,
            "size": len(blob),
            "content_type": content_type,
            "category": cat,
            "url": media_url,
            "storage_provider": active_provider,
            "uploaded_at": now.isoformat() + "Z",
            "uploaded_by_name": admin.username,
            "uploaded_by_role": admin.role
        })

    await db.commit()
    return {"items": uploaded_items}


@router.delete("/api/admin/media")
async def delete_media(
    payload: DeleteMediaRequest,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    rel_str = _normalize_cloud_reference(payload.relative_path)

    stmt = select(MediaFile).where(
        (MediaFile.relative_path == rel_str) | (MediaFile.cloud_public_id == rel_str)
    )
    result = await db.execute(stmt)
    db_file = result.scalar_one_or_none()

    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found.")

    if db_file.cloud_public_id:
        settings = await get_or_create_storage_settings(db)
        cloudinary_config = resolve_cloudinary_config(settings)
        ensure_cloudinary_config_ready(cloudinary_config)

        delete_cloudinary_asset(
            db_file.cloud_public_id,
            config=cloudinary_config,
            resource_type=db_file.cloud_resource_type,
        )

    await db.delete(db_file)
    await db.commit()

    return {"message": "Media deleted"}
