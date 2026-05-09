from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any
from urllib.parse import unquote, urlparse

import cloudinary
import cloudinary.api as cloudinary_api
import cloudinary.uploader as cloudinary_uploader
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from media.models import MediaStorageSettings

ALLOWED_STORAGE_PROVIDERS = {"cloudinary"}


def _clean_value(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _sanitize_folder_prefix(value: str | None) -> str:
    raw = (value or "campus404").strip().strip("/")
    if not raw:
        return "campus404"
    normalized = re.sub(r"[^a-zA-Z0-9_\-/]+", "-", raw)
    normalized = re.sub(r"/+", "/", normalized).strip("/")
    return normalized or "campus404"


def _parse_cloudinary_url(value: str | None) -> dict[str, str | None]:
    if not value:
        return {"cloud_name": None, "api_key": None, "api_secret": None}

    parsed = urlparse(value)
    if parsed.scheme != "cloudinary":
        return {"cloud_name": None, "api_key": None, "api_secret": None}

    return {
        "cloud_name": parsed.hostname or None,
        "api_key": unquote(parsed.username or "") or None,
        "api_secret": unquote(parsed.password or "") or None,
    }


def _read_cloudinary_env_defaults() -> dict[str, str | None]:
    cloud_url_defaults = _parse_cloudinary_url(os.getenv("CLOUDINARY_URL"))

    cloud_name = _clean_value(os.getenv("CLOUDINARY_CLOUD_NAME")) or cloud_url_defaults["cloud_name"]
    api_key = _clean_value(os.getenv("CLOUDINARY_API_KEY")) or cloud_url_defaults["api_key"]
    api_secret = _clean_value(os.getenv("CLOUDINARY_API_SECRET")) or cloud_url_defaults["api_secret"]
    folder_prefix = _sanitize_folder_prefix(os.getenv("CLOUDINARY_PUBLIC_ID_PREFIX") or "campus404")

    return {
        "cloud_name": cloud_name,
        "api_key": api_key,
        "api_secret": api_secret,
        "folder_prefix": folder_prefix,
    }


async def get_or_create_storage_settings(db: AsyncSession) -> MediaStorageSettings:
    settings = await db.scalar(select(MediaStorageSettings).order_by(MediaStorageSettings.id.asc()))
    defaults = _read_cloudinary_env_defaults()

    if settings:
        should_commit = False

        if (settings.active_provider or "").strip().lower() != "cloudinary":
            settings.active_provider = "cloudinary"
            should_commit = True

        # Legacy credential fields are intentionally cleared because credentials
        # are now sourced only from environment variables.
        if settings.cloudinary_cloud_name is not None:
            settings.cloudinary_cloud_name = None
            should_commit = True
        if settings.cloudinary_api_key is not None:
            settings.cloudinary_api_key = None
            should_commit = True
        if settings.cloudinary_api_secret is not None:
            settings.cloudinary_api_secret = None
            should_commit = True

        if not _clean_value(settings.cloudinary_folder_prefix):
            settings.cloudinary_folder_prefix = defaults["folder_prefix"] or "campus404"
            should_commit = True

        if should_commit:
            settings.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(settings)
        return settings

    settings = MediaStorageSettings(
        active_provider="cloudinary",
        cloudinary_cloud_name=None,
        cloudinary_api_key=None,
        cloudinary_api_secret=None,
        cloudinary_folder_prefix=defaults["folder_prefix"] or "campus404",
    )
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


def build_storage_settings_response(settings: MediaStorageSettings) -> dict[str, Any]:
    env_defaults = _read_cloudinary_env_defaults()

    cloud_name = _clean_value(env_defaults["cloud_name"])
    api_key = _clean_value(env_defaults["api_key"])
    api_secret = _clean_value(env_defaults["api_secret"])
    prefix = _sanitize_folder_prefix(settings.cloudinary_folder_prefix or env_defaults["folder_prefix"])
    configured = bool(cloud_name and api_key and api_secret)

    return {
        "active_provider": "cloudinary",
        "providers": {
            "cloudinary": {
                "name": "Cloudinary CDN",
                "configured": configured,
                "cloud_name": cloud_name,
                "credentials_source": "environment",
                "folder_prefix": prefix,
                "last_tested_at": settings.last_tested_at.isoformat() + "Z" if settings.last_tested_at else None,
                "last_test_status": settings.last_test_status,
            },
        },
        "updated_at": settings.updated_at.isoformat() + "Z" if settings.updated_at else None,
    }


def resolve_cloudinary_config(
    settings: MediaStorageSettings,
    overrides: dict[str, Any] | None = None,
) -> dict[str, str | None]:
    overrides = overrides or {}
    env_defaults = _read_cloudinary_env_defaults()

    cloud_name = env_defaults["cloud_name"]
    api_key = env_defaults["api_key"]
    api_secret = env_defaults["api_secret"]
    folder_prefix = _sanitize_folder_prefix(settings.cloudinary_folder_prefix or env_defaults["folder_prefix"]) or "campus404"

    if "folder_prefix" in overrides:
        folder_prefix = _sanitize_folder_prefix(overrides.get("folder_prefix"))

    return {
        "cloud_name": cloud_name,
        "api_key": api_key,
        "api_secret": api_secret,
        "folder_prefix": folder_prefix,
    }


def ensure_provider_active(provider: str) -> str:
    normalized = (provider or "").strip().lower()
    if normalized not in ALLOWED_STORAGE_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Cloudinary storage is supported.",
        )
    return normalized


def ensure_cloudinary_config_ready(config: dict[str, str | None]) -> None:
    required = ["cloud_name", "api_key", "api_secret"]
    missing = [key for key in required if not _clean_value(config.get(key))]
    if missing:
        pretty = ", ".join(missing)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cloudinary configuration is incomplete: missing {pretty}.",
        )


def _capture_cloudinary_config() -> dict[str, Any]:
    current = cloudinary.config()
    return {
        "cloud_name": current.cloud_name,
        "api_key": current.api_key,
        "api_secret": current.api_secret,
        "secure": getattr(current, "secure", True),
    }


def _apply_cloudinary_config(config: dict[str, str | None]) -> None:
    cloudinary.config(
        cloud_name=config.get("cloud_name"),
        api_key=config.get("api_key"),
        api_secret=config.get("api_secret"),
        secure=True,
    )


def test_cloudinary_connection(config: dict[str, str | None]) -> tuple[bool, str]:
    ensure_cloudinary_config_ready(config)

    previous = _capture_cloudinary_config()
    try:
        _apply_cloudinary_config(config)
        cloudinary_api.ping()
        return True, "Cloudinary connection successful."
    except Exception as exc:
        return False, f"Cloudinary connection failed: {exc}"
    finally:
        cloudinary.config(**previous)


def upload_blob_to_cloudinary(
    blob: bytes,
    *,
    public_id: str,
    content_type: str,
    config: dict[str, str | None],
) -> dict[str, Any]:
    ensure_cloudinary_config_ready(config)

    previous = _capture_cloudinary_config()
    try:
        _apply_cloudinary_config(config)
        result = cloudinary_uploader.upload(
            blob,
            resource_type="auto",
            public_id=public_id,
            overwrite=False,
            use_filename=False,
            unique_filename=False,
            invalidate=False,
            format=None,
        )
        if not result or not result.get("secure_url"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Cloudinary upload failed to return a CDN URL.",
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cloudinary upload failed: {exc}",
        ) from exc
    finally:
        cloudinary.config(**previous)


def delete_cloudinary_asset(
    public_id: str,
    *,
    config: dict[str, str | None],
    resource_type: str | None = None,
) -> None:
    ensure_cloudinary_config_ready(config)

    previous = _capture_cloudinary_config()
    candidate_types = [resource_type] if resource_type else ["image", "video", "raw"]

    try:
        _apply_cloudinary_config(config)
        last_error: Exception | None = None
        for candidate in candidate_types:
            if not candidate:
                continue
            try:
                result = cloudinary_uploader.destroy(public_id, resource_type=candidate, invalidate=True)
                if isinstance(result, dict) and result.get("result") in {"ok", "not found"}:
                    return
            except Exception as exc:
                last_error = exc

        if last_error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Cloudinary delete failed: {last_error}",
            )
    finally:
        cloudinary.config(**previous)


def build_cloud_public_id(*, folder_prefix: str, year: str, month: str, stem_with_uuid: str) -> str:
    folder = _sanitize_folder_prefix(folder_prefix)
    return f"{folder}/{year}/{month}/{stem_with_uuid}".strip("/")


def touch_storage_settings_test_status(
    settings: MediaStorageSettings,
    *,
    ok: bool,
) -> None:
    settings.last_tested_at = datetime.utcnow()
    settings.last_test_status = "ok" if ok else "failed"


def touch_storage_settings_updated(
    settings: MediaStorageSettings,
    *,
    updated_by_id: int | None,
) -> None:
    settings.updated_at = datetime.utcnow()
    settings.updated_by_id = updated_by_id
