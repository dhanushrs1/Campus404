from __future__ import annotations

import asyncio
import hashlib
import httpx
import json
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.database import get_db
from auth.jwt_utils import _decode
from auth.models import User, UserSession
from curriculum import models, schemas
from curriculum.services import LeaderboardService, ProgressService, RewardService, SubmissionService
from media.storage_provider import (
    build_cloud_public_id,
    ensure_cloudinary_config_ready,
    get_or_create_storage_settings,
    resolve_cloudinary_config,
    upload_blob_to_cloudinary,
)

router = APIRouter(tags=["curriculum"])

ELEVATED_ROLES = {"ADMIN", "EDITOR"}
MAX_TRACK_FEATURED_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_TRACK_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}
ALLOWED_TRACK_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".jfif"}
ANALYTICS_HASH_SALT = os.getenv("ANALYTICS_HASH_SALT") or os.getenv("JWT_SECRET", "campus404-analytics")
UNTRACKED_VISIT_PREFIXES = ("/admin", "/auth", "/api")


def _token_session_version(payload: dict[str, Any]) -> int:
    raw = payload.get("sv", 1)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 1
    return value if value > 0 else 1


def _extract_client_ip(request: Request) -> str | None:
    for header_name in ("x-real-ip", "cf-connecting-ip", "x-client-ip"):
        value = request.headers.get(header_name)
        if value:
            return value.strip()[:64]

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]

    if request.client:
        return request.client.host[:64]

    return None


def _analytics_hash(value: str | None) -> str | None:
    normalized = (value or "").strip()
    if not normalized:
        return None
    payload = f"{ANALYTICS_HASH_SALT}:{normalized}".encode("utf-8", errors="ignore")
    return hashlib.sha256(payload).hexdigest()


def _normalize_visit_path(value: str | None) -> str:
    raw = (value or "/").strip()
    if not raw.startswith("/"):
        return "/"
    path_only = raw.split("#", 1)[0].split("?", 1)[0].strip()
    return (path_only or "/")[:512]


def _is_trackable_visit_path(path: str) -> bool:
    normalized = path.lower()
    return not any(normalized == prefix or normalized.startswith(f"{prefix}/") for prefix in UNTRACKED_VISIT_PREFIXES)


async def get_current_user(
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

    return user


@router.post("/api/analytics/visit", response_model=schemas.SiteVisitResponse)
async def record_site_visit(
    payload: schemas.SiteVisitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> schemas.SiteVisitResponse:
    path = _normalize_visit_path(payload.path)
    if not _is_trackable_visit_path(path):
        return schemas.SiteVisitResponse(ok=True)

    ip_hash = _analytics_hash(_extract_client_ip(request))
    if not ip_hash:
        return schemas.SiteVisitResponse(ok=True)

    now = datetime.utcnow()
    visit_date = now.date()
    user_agent_hash = _analytics_hash((request.headers.get("user-agent") or "")[:512])
    referrer = (payload.referrer or "").strip()[:1024] or None

    existing_visit = await db.scalar(
        select(models.SiteVisit)
        .where(models.SiteVisit.visit_date == visit_date)
        .where(models.SiteVisit.ip_hash == ip_hash)
    )
    if existing_visit:
        existing_visit.last_seen_at = now
        await db.commit()
        return schemas.SiteVisitResponse(ok=True)

    db.add(
        models.SiteVisit(
            visit_date=visit_date,
            ip_hash=ip_hash,
            user_agent_hash=user_agent_hash,
            first_path=path,
            referrer=referrer,
            first_seen_at=now,
            last_seen_at=now,
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()

    return schemas.SiteVisitResponse(ok=True)


async def get_current_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await get_current_user(request, db)
    normalized_role = (user.role or "").strip().upper()
    if normalized_role not in ELEVATED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can manage curriculum.",
        )

    return user


def _apply_conditions(statement: Any, conditions: list[Any]) -> Any:
    for condition in conditions:
        statement = statement.where(condition)
    return statement


async def _max_sequence(
    db: AsyncSession,
    sequence_column: Any,
    conditions: list[Any],
) -> int:
    statement = select(func.max(sequence_column))
    statement = _apply_conditions(statement, conditions)
    value = await db.scalar(statement)
    return int(value or 0)


async def _resolve_insert_position(
    db: AsyncSession,
    model: Any,
    sequence_column: Any,
    requested_position: int | None,
    conditions: list[Any],
) -> int:
    max_value = await _max_sequence(db, sequence_column, conditions)
    if requested_position is None:
        return max_value + 1

    proposed = int(requested_position)
    position = max(1, min(proposed, max_value + 1))

    shift_statement = update(model).where(sequence_column >= position)
    shift_statement = _apply_conditions(shift_statement, conditions)
    await db.execute(shift_statement.values({sequence_column.key: sequence_column + 1}))

    return position


async def _reposition_sequence(
    db: AsyncSession,
    model: Any,
    sequence_column: Any,
    current_position: int,
    requested_position: int,
    conditions: list[Any],
) -> int:
    max_value = await _max_sequence(db, sequence_column, conditions)
    target_position = max(1, min(int(requested_position), max_value))

    if target_position == current_position:
        return current_position

    if target_position > current_position:
        shift_statement = (
            update(model)
            .where(sequence_column > current_position)
            .where(sequence_column <= target_position)
        )
        shift_statement = _apply_conditions(shift_statement, conditions)
        await db.execute(shift_statement.values({sequence_column.key: sequence_column - 1}))
    else:
        shift_statement = (
            update(model)
            .where(sequence_column >= target_position)
            .where(sequence_column < current_position)
        )
        shift_statement = _apply_conditions(shift_statement, conditions)
        await db.execute(shift_statement.values({sequence_column.key: sequence_column + 1}))

    return target_position


async def _close_sequence_gap(
    db: AsyncSession,
    model: Any,
    sequence_column: Any,
    removed_position: int,
    conditions: list[Any],
) -> None:
    statement = update(model).where(sequence_column > removed_position)
    statement = _apply_conditions(statement, conditions)
    await db.execute(statement.values({sequence_column.key: sequence_column - 1}))


def _validate_unique_ids(item_ids: list[int]) -> None:
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_ids must not contain duplicates.",
        )


def _slugify_stem(value: str) -> str:
    stem = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return stem or "track"


def _normalize_track_image_url(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _ordered(items: list[Any], key_name: str = "order") -> list[Any]:
    return sorted(items or [], key=lambda item: int(getattr(item, key_name, 0) or 0))


def _normalize_mode(value: str | None) -> str:
    return "code" if value == "task" else (value or "code")


async def _load_exercise_admin_context(
    db: AsyncSession,
    exercise_id: int,
) -> tuple[models.Exercise, models.Section, models.Track]:
    exercise = await db.scalar(
        select(models.Exercise)
        .options(
            selectinload(models.Exercise.tasks),
            selectinload(models.Exercise.files),
            selectinload(models.Exercise.test_cases),
            selectinload(models.Exercise.hints),
            selectinload(models.Exercise.quiz_questions).selectinload(models.QuizQuestion.options),
        )
        .where(models.Exercise.id == exercise_id)
    )
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    section = await db.scalar(select(models.Section).where(models.Section.id == exercise.section_id))
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    track = await db.scalar(select(models.Track).where(models.Track.id == section.track_id))
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    exercise.tasks = _ordered(list(exercise.tasks or []), "step_number")
    exercise.files = _ordered(list(exercise.files or []))
    exercise.test_cases = _ordered(list(exercise.test_cases or []))
    exercise.hints = _ordered(list(exercise.hints or []))
    exercise.quiz_questions = _ordered(list(exercise.quiz_questions or []))
    for question in exercise.quiz_questions:
        question.options = _ordered(list(question.options or []))
    return exercise, section, track


def _exercise_publish_issues(
    exercise: models.Exercise,
    *,
    track_id: int | None = None,
    section_id: int | None = None,
) -> list[schemas.AdminPublishIssue]:
    mode = _normalize_mode(exercise.mode)
    issues: list[schemas.AdminPublishIssue] = []

    def add(message: str, severity: str = "error") -> None:
        issues.append(
            schemas.AdminPublishIssue(
                scope="exercise",
                message=message,
                severity=severity,
                track_id=track_id,
                section_id=section_id,
                exercise_id=int(exercise.id),
            )
        )

    if not str(exercise.title or "").strip():
        add("Exercise title is required.")
    if int(exercise.xp_reward or 0) < 0:
        add("XP reward cannot be negative.")

    has_instruction = bool(str(exercise.instructions_md or exercise.theory_content or "").strip())
    if not has_instruction:
        add("Add learner instructions or theory content.")

    if mode in {"code", "multi_file_code", "frontend_preview", "project"}:
        files = list(exercise.files or [])
        if not files:
            add("Add at least one workspace file.")
        elif not any(file.is_entrypoint for file in files):
            add("Choose an entrypoint file.")
        if mode != "frontend_preview" and not list(exercise.test_cases or []):
            add("Add at least one visible or hidden test case.")

    if mode == "frontend_preview":
        config = exercise.validation_config or {}
        has_rules = any(config.get(key) for key in ["required_files", "required_text", "required_selectors", "css_contains", "js_contains"])
        if not has_rules:
            add("Add frontend preview acceptance rules.")

    if mode == "quiz":
        questions = list(exercise.quiz_questions or [])
        if not questions:
            add("Add quiz questions.")
        for question in questions:
            if not any(option.is_correct for option in question.options or []):
                add(f"Question {question.order or question.id} needs a correct option.")

    if mode == "theory" and not str(exercise.theory_content or exercise.instructions_md or "").strip():
        add("Theory lessons need lesson content.")

    if not exercise.is_published:
        add("Exercise is still in draft.", "warning")

    return issues


async def _exercise_publish_check(
    exercise: models.Exercise,
    section: models.Section,
    track: models.Track,
) -> schemas.AdminPublishCheckResponse:
    issues = _exercise_publish_issues(exercise, track_id=int(track.id), section_id=int(section.id))
    return schemas.AdminPublishCheckResponse(
        ready=not any(issue.severity == "error" for issue in issues),
        issues=issues,
        totals={
            "sections": 1,
            "exercises": 1,
            "files": len(exercise.files or []),
            "tests": len(exercise.test_cases or []),
            "hints": len(exercise.hints or []),
            "quiz_questions": len(exercise.quiz_questions or []),
        },
    )


def _apply_exercise_patch(item: models.Exercise, payload: schemas.ExerciseUpdate) -> None:
    for field in [
        "title",
        "slug",
        "mode",
        "theory_content",
        "instructions_md",
        "xp_reward",
        "unlock_rule",
        "reference_solution_url",
        "docs_url",
        "passing_score_pct",
        "attempts_allowed",
        "validation_config",
        "auto_submit_on_pass",
        "is_published",
    ]:
        value = getattr(payload, field)
        if value is not None:
            if field in {"reference_solution_url", "docs_url"} and isinstance(value, str):
                value = value.strip() or None
            setattr(item, field, value)


# ADMIN: TRACKS

@router.get("/api/admin/tracks", response_model=list[schemas.TrackInDB])
async def list_tracks(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[models.Track]:
    rows = await db.scalars(select(models.Track).order_by(models.Track.order))
    return list(rows.all())


@router.post("/api/admin/tracks", response_model=schemas.TrackInDB, status_code=status.HTTP_201_CREATED)
async def create_track(
    payload: schemas.TrackCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Track:
    order_value = await _resolve_insert_position(
        db,
        models.Track,
        models.Track.order,
        payload.order,
        [],
    )

    item = models.Track(
        title=payload.title,
        slug=payload.slug if payload.slug is not None else _slugify_stem(payload.title),
        description=payload.description,
        featured_image_url=_normalize_track_image_url(payload.featured_image_url),
        language_id=payload.language_id,
        order=order_value,
        is_published=payload.is_published if payload.is_published is not None else False,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/api/admin/tracks/reorder")
async def reorder_tracks(
    payload: schemas.ReorderRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    _validate_unique_ids(payload.item_ids)

    total_tracks = int((await db.scalar(select(func.count()).select_from(models.Track))) or 0)
    if total_tracks != len(payload.item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_ids must include all tracks.",
        )

    found_ids = (await db.scalars(select(models.Track.id).where(models.Track.id.in_(payload.item_ids)))).all()
    if len(found_ids) != len(payload.item_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more tracks were not found.")

    for index, item_id in enumerate(payload.item_ids, start=1):
        await db.execute(update(models.Track).where(models.Track.id == item_id).values(order=index))

    await db.commit()
    return {"message": "Tracks reordered"}


@router.put("/api/admin/tracks/{track_id}", response_model=schemas.TrackInDB)
async def update_track(
    track_id: int,
    payload: schemas.TrackUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Track:
    item = await db.scalar(select(models.Track).where(models.Track.id == track_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    if payload.order is not None:
        item.order = await _reposition_sequence(
            db,
            models.Track,
            models.Track.order,
            int(item.order),
            int(payload.order),
            [],
        )

    if payload.title is not None:
        item.title = payload.title
    if payload.slug is not None:
        item.slug = payload.slug
    if payload.description is not None:
        item.description = payload.description
    if payload.featured_image_url is not None:
        item.featured_image_url = _normalize_track_image_url(payload.featured_image_url)
    if payload.language_id is not None:
        item.language_id = payload.language_id
    if payload.is_published is not None:
        item.is_published = payload.is_published

    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/api/admin/tracks/{track_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_track(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Response:
    item = await db.scalar(select(models.Track).where(models.Track.id == track_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    removed_order = int(item.order)
    await db.delete(item)
    await _close_sequence_gap(db, models.Track, models.Track.order, removed_order, [])
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/api/admin/uploads/track-featured-image")
async def upload_track_featured_image(
    file: UploadFile = File(...),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str | int]:
    suffix = Path(file.filename or "").suffix.lower()
    content_type = (file.content_type or "").lower()

    if content_type not in ALLOWED_TRACK_IMAGE_CONTENT_TYPES and suffix not in ALLOWED_TRACK_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only jpg, png, webp, and gif images are allowed.",
        )

    blob = await file.read()
    await file.close()

    if not blob:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    if len(blob) > MAX_TRACK_FEATURED_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size must be 5MB or smaller.",
        )

    now = datetime.utcnow()
    year = f"{now.year:04d}"
    month = f"{now.month:02d}"
    stem = _slugify_stem(Path(file.filename or "track").stem)
    stem_with_uuid = f"{stem}-{uuid4().hex[:12]}"

    settings = await get_or_create_storage_settings(db)
    cloudinary_config = resolve_cloudinary_config(settings)
    ensure_cloudinary_config_ready(cloudinary_config)
    public_id = build_cloud_public_id(
        folder_prefix=cloudinary_config.get("folder_prefix") or "campus404",
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
    public_url = str(result.get("secure_url") or "")
    if not public_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cloudinary upload failed to return an image URL.",
        )

    return {"url": public_url, "size": len(blob), "content_type": content_type}


# ADMIN: SECTIONS

@router.get("/api/admin/tracks/{track_id}/sections", response_model=list[schemas.SectionInDB])
async def list_sections(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[models.Section]:
    rows = await db.scalars(
        select(models.Section)
        .where(models.Section.track_id == track_id)
        .order_by(models.Section.order)
    )
    return list(rows.all())


@router.post("/api/admin/tracks/{track_id}/sections", response_model=schemas.SectionInDB, status_code=status.HTTP_201_CREATED)
async def create_section(
    track_id: int,
    payload: schemas.SectionCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Section:
    track = await db.scalar(select(models.Track).where(models.Track.id == track_id))
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    conditions = [models.Section.track_id == track_id]
    order_value = await _resolve_insert_position(
        db,
        models.Section,
        models.Section.order,
        payload.order,
        conditions,
    )

    item = models.Section(
        track_id=track_id,
        title=payload.title,
        slug=payload.slug if payload.slug is not None else _slugify_stem(payload.title),
        order=order_value
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/api/admin/sections/reorder")
async def reorder_sections(
    payload: schemas.ReorderRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    _validate_unique_ids(payload.item_ids)

    rows = (
        await db.execute(
            select(models.Section.id, models.Section.track_id)
            .where(models.Section.id.in_(payload.item_ids))
        )
    ).all()

    if len(rows) != len(payload.item_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more sections were not found.")

    track_ids = {row.track_id for row in rows}
    if len(track_ids) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sections must belong to the same track.",
        )

    track_id = next(iter(track_ids))
    sibling_count = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.Section)
                .where(models.Section.track_id == track_id)
            )
        )
        or 0
    )
    if sibling_count != len(payload.item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_ids must include all sections in the selected track.",
        )

    for index, item_id in enumerate(payload.item_ids, start=1):
        await db.execute(update(models.Section).where(models.Section.id == item_id).values(order=index))

    await db.commit()
    return {"message": "Sections reordered"}


@router.put("/api/admin/sections/{section_id}", response_model=schemas.SectionInDB)
async def update_section(
    section_id: int,
    payload: schemas.SectionUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Section:
    item = await db.scalar(select(models.Section).where(models.Section.id == section_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    conditions = [models.Section.track_id == item.track_id]
    if payload.order is not None:
        item.order = await _reposition_sequence(
            db,
            models.Section,
            models.Section.order,
            int(item.order),
            int(payload.order),
            conditions,
        )

    if payload.title is not None:
        item.title = payload.title
    if payload.slug is not None:
        item.slug = payload.slug
    if payload.badge_url is not None:
        item.badge_url = payload.badge_url if payload.badge_url.strip() else None

    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/api/admin/sections/{section_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Response:
    item = await db.scalar(select(models.Section).where(models.Section.id == section_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    removed_order = int(item.order)
    track_id = int(item.track_id)
    await db.delete(item)
    await _close_sequence_gap(
        db,
        models.Section,
        models.Section.order,
        removed_order,
        [models.Section.track_id == track_id],
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ADMIN: EXERCISES

@router.get("/api/admin/sections/{section_id}/exercises", response_model=list[schemas.ExerciseInDB])
async def list_exercises(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[models.Exercise]:
    rows = await db.scalars(
        select(models.Exercise)
        .where(models.Exercise.section_id == section_id)
        .order_by(models.Exercise.order)
    )
    return list(rows.all())


@router.post("/api/admin/sections/{section_id}/exercises", response_model=schemas.ExerciseInDB, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    section_id: int,
    payload: schemas.ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Exercise:
    section = await db.scalar(select(models.Section).where(models.Section.id == section_id))
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    conditions = [models.Exercise.section_id == section_id]
    order_value = await _resolve_insert_position(
        db,
        models.Exercise,
        models.Exercise.order,
        payload.order,
        conditions,
    )

    item = models.Exercise(
        section_id=section_id,
        title=payload.title,
        slug=payload.slug if payload.slug is not None else _slugify_stem(payload.title),
        order=order_value,
        mode=payload.mode or "code",
        theory_content=payload.theory_content,
        instructions_md=payload.instructions_md,
        xp_reward=payload.xp_reward,
        unlock_rule=payload.unlock_rule,
        reference_solution_url=payload.reference_solution_url,
        docs_url=payload.docs_url,
        passing_score_pct=payload.passing_score_pct,
        attempts_allowed=payload.attempts_allowed,
        validation_config=payload.validation_config,
        auto_submit_on_pass=payload.auto_submit_on_pass,
        is_published=payload.is_published,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/api/admin/exercises/reorder")
async def reorder_exercises(
    payload: schemas.ReorderRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    _validate_unique_ids(payload.item_ids)

    rows = (
        await db.execute(
            select(models.Exercise.id, models.Exercise.section_id)
            .where(models.Exercise.id.in_(payload.item_ids))
        )
    ).all()

    if len(rows) != len(payload.item_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more exercises were not found.")

    section_ids = {row.section_id for row in rows}
    if len(section_ids) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercises must belong to the same section.",
        )

    section_id = next(iter(section_ids))
    sibling_count = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.Exercise)
                .where(models.Exercise.section_id == section_id)
            )
        )
        or 0
    )
    if sibling_count != len(payload.item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_ids must include all exercises in the selected section.",
        )

    for index, item_id in enumerate(payload.item_ids, start=1):
        await db.execute(update(models.Exercise).where(models.Exercise.id == item_id).values(order=index))

    await db.commit()
    return {"message": "Exercises reordered"}


@router.put("/api/admin/exercises/{exercise_id}", response_model=schemas.ExerciseInDB)
async def update_exercise(
    exercise_id: int,
    payload: schemas.ExerciseUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Exercise:
    item = await db.scalar(select(models.Exercise).where(models.Exercise.id == exercise_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    conditions = [models.Exercise.section_id == item.section_id]
    if payload.order is not None:
        item.order = await _reposition_sequence(
            db,
            models.Exercise,
            models.Exercise.order,
            int(item.order),
            int(payload.order),
            conditions,
        )

    if payload.title is not None:
        item.title = payload.title
    if payload.slug is not None:
        item.slug = payload.slug
    if payload.mode is not None:
        item.mode = payload.mode
    if payload.theory_content is not None:
        item.theory_content = payload.theory_content
    if payload.instructions_md is not None:
        item.instructions_md = payload.instructions_md
    if payload.xp_reward is not None:
        item.xp_reward = payload.xp_reward
    if payload.unlock_rule is not None:
        item.unlock_rule = payload.unlock_rule
    if payload.reference_solution_url is not None:
        item.reference_solution_url = payload.reference_solution_url.strip() or None
    if payload.docs_url is not None:
        item.docs_url = payload.docs_url.strip() or None
    if payload.passing_score_pct is not None:
        item.passing_score_pct = payload.passing_score_pct
    if payload.attempts_allowed is not None:
        item.attempts_allowed = payload.attempts_allowed
    if payload.validation_config is not None:
        item.validation_config = payload.validation_config
    if payload.auto_submit_on_pass is not None:
        item.auto_submit_on_pass = payload.auto_submit_on_pass
    if payload.is_published is not None:
        item.is_published = payload.is_published

    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/api/admin/exercises/{exercise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_exercise(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Response:
    item = await db.scalar(select(models.Exercise).where(models.Exercise.id == exercise_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    removed_order = int(item.order)
    section_id = int(item.section_id)
    await db.delete(item)
    await _close_sequence_gap(
        db,
        models.Exercise,
        models.Exercise.order,
        removed_order,
        [models.Exercise.section_id == section_id],
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ADMIN: TASKS

@router.get("/api/admin/exercises/{exercise_id}/tasks", response_model=list[schemas.TaskInDB])
async def list_tasks(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[models.Task]:
    rows = await db.scalars(
        select(models.Task)
        .where(models.Task.exercise_id == exercise_id)
        .order_by(models.Task.step_number)
    )
    return list(rows.all())


@router.post("/api/admin/exercises/{exercise_id}/tasks", response_model=schemas.TaskInDB, status_code=status.HTTP_201_CREATED)
async def create_task(
    exercise_id: int,
    payload: schemas.TaskCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Task:
    exercise = await db.scalar(select(models.Exercise).where(models.Exercise.id == exercise_id))
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    conditions = [models.Task.exercise_id == exercise_id]
    step_value = await _resolve_insert_position(
        db,
        models.Task,
        models.Task.step_number,
        payload.step_number,
        conditions,
    )

    item = models.Task(
        exercise_id=exercise_id,
        step_number=step_value,
        instructions_md=payload.instructions_md,
        starter_code=payload.starter_code,
        solution_code=payload.solution_code,
        test_cases=payload.test_cases,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/api/admin/tasks/reorder")
async def reorder_tasks(
    payload: schemas.ReorderRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    _validate_unique_ids(payload.item_ids)

    rows = (
        await db.execute(
            select(models.Task.id, models.Task.exercise_id)
            .where(models.Task.id.in_(payload.item_ids))
        )
    ).all()

    if len(rows) != len(payload.item_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more tasks were not found.")

    exercise_ids = {row.exercise_id for row in rows}
    if len(exercise_ids) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tasks must belong to the same exercise.",
        )

    exercise_id = next(iter(exercise_ids))
    sibling_count = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.Task)
                .where(models.Task.exercise_id == exercise_id)
            )
        )
        or 0
    )
    if sibling_count != len(payload.item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_ids must include all tasks in the selected exercise.",
        )

    for index, item_id in enumerate(payload.item_ids, start=1):
        await db.execute(update(models.Task).where(models.Task.id == item_id).values(step_number=index))

    await db.commit()
    return {"message": "Tasks reordered"}


@router.put("/api/admin/tasks/{task_id}", response_model=schemas.TaskInDB)
async def update_task(
    task_id: int,
    payload: schemas.TaskUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Task:
    item = await db.scalar(select(models.Task).where(models.Task.id == task_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    conditions = [models.Task.exercise_id == item.exercise_id]
    if payload.step_number is not None:
        item.step_number = await _reposition_sequence(
            db,
            models.Task,
            models.Task.step_number,
            int(item.step_number),
            int(payload.step_number),
            conditions,
        )

    if payload.instructions_md is not None:
        item.instructions_md = payload.instructions_md
    if payload.starter_code is not None:
        item.starter_code = payload.starter_code
    if payload.solution_code is not None:
        item.solution_code = payload.solution_code
    if payload.test_cases is not None:
        item.test_cases = payload.test_cases

    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/api/admin/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Response:
    item = await db.scalar(select(models.Task).where(models.Task.id == task_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    removed_step = int(item.step_number)
    exercise_id = int(item.exercise_id)
    await db.delete(item)
    await _close_sequence_gap(
        db,
        models.Task,
        models.Task.step_number,
        removed_step,
        [models.Task.exercise_id == exercise_id],
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# STUDENT ENDPOINTS

@router.get("/api/tracks", response_model=list[schemas.TrackTree])
async def list_tracks_student(
    db: AsyncSession = Depends(get_db),
) -> list[models.Track]:
    rows = await db.scalars(
        select(models.Track)
        .options(
            selectinload(models.Track.sections)
            .selectinload(models.Section.exercises)
            .selectinload(models.Exercise.tasks)
        )
        .where(models.Track.is_published == True)
        .order_by(models.Track.order)
    )

    tracks = list(rows.all())
    learner_counts: dict[int, int] = {}
    if tracks:
        track_ids = [track.id for track in tracks]
        learner_rows = await db.execute(
            select(
                models.Section.track_id,
                func.count(func.distinct(models.UserTaskProgress.user_id)),
            )
            .join(models.Exercise, models.Exercise.section_id == models.Section.id)
            .join(models.Task, models.Task.exercise_id == models.Exercise.id)
            .join(models.UserTaskProgress, models.UserTaskProgress.task_id == models.Task.id)
            .where(models.Section.track_id.in_(track_ids))
            .group_by(models.Section.track_id)
        )
        learner_counts = {
            int(track_id): int(count or 0)
            for track_id, count in learner_rows.all()
        }

    for track in tracks:
        track.learner_count = learner_counts.get(int(track.id), 0)
        track.sections.sort(key=lambda section: int(section.order or 0))
        for section in track.sections:
            section.exercises.sort(key=lambda exercise: int(exercise.order or 0))
            for exercise in section.exercises:
                exercise.total_tasks = len(exercise.tasks) if exercise.tasks else 0
                exercise.task_ids = [t.id for t in exercise.tasks] if exercise.tasks else []

    return tracks

@router.get("/api/tracks/{track_identifier}/leaderboard", response_model=list[schemas.TrackLeaderboardEntry])
async def get_track_leaderboard(
    track_identifier: str,
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    statement = select(models.Track.id).where(models.Track.is_published == True)
    if track_identifier.isdigit():
        statement = statement.where(models.Track.id == int(track_identifier))
    else:
        statement = statement.where(models.Track.slug == track_identifier)

    track_id = await db.scalar(statement)
    if not track_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    safe_limit = max(1, min(int(limit or 5), 20))
    task_total_rows = await db.execute(
        select(models.Exercise.id, func.count(models.Task.id))
        .join(models.Task, models.Task.exercise_id == models.Exercise.id)
        .join(models.Section, models.Section.id == models.Exercise.section_id)
        .where(models.Section.track_id == track_id)
        .group_by(models.Exercise.id)
    )
    task_totals = {
        int(exercise_id): int(total or 0)
        for exercise_id, total in task_total_rows.all()
    }
    if not task_totals:
        return []

    progress_rows = await db.execute(
        select(
            User.id,
            User.username,
            User.avatar,
            models.Exercise.id,
            func.count(func.distinct(models.UserTaskProgress.task_id)),
        )
        .join(models.UserTaskProgress, models.UserTaskProgress.user_id == User.id)
        .join(models.Task, models.Task.id == models.UserTaskProgress.task_id)
        .join(models.Exercise, models.Exercise.id == models.Task.exercise_id)
        .join(models.Section, models.Section.id == models.Exercise.section_id)
        .where(models.Section.track_id == track_id)
        .where(User.is_active == True)
        .group_by(User.id, User.username, User.avatar, models.Exercise.id)
    )

    learners: dict[int, dict[str, Any]] = {}
    for user_id, username, avatar, exercise_id, completed_tasks in progress_rows.all():
        total_tasks = task_totals.get(int(exercise_id), 0)
        safe_completed = min(int(completed_tasks or 0), total_tasks or int(completed_tasks or 0))
        entry = learners.setdefault(
            int(user_id),
            {
                "user_id": int(user_id),
                "username": username,
                "avatar": avatar,
                "completed_tasks": 0,
                "completed_exercises": 0,
            },
        )
        entry["completed_tasks"] += safe_completed
        if total_tasks > 0 and safe_completed >= total_tasks:
            entry["completed_exercises"] += 1

    ranked = sorted(
        learners.values(),
        key=lambda item: (-int(item["completed_tasks"]), -int(item["completed_exercises"]), item["username"].lower()),
    )[:safe_limit]

    return [
        {
            **entry,
            "rank": index + 1,
            "xp": int(entry["completed_exercises"]) * 20,
        }
        for index, entry in enumerate(ranked)
    ]

@router.get("/api/tracks/{track_identifier}/tree", response_model=schemas.TrackDetailTree)
async def get_track_detail_tree(
    track_identifier: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> models.Track:
    statement = (
        select(models.Track)
        .options(
            selectinload(models.Track.sections)
            .selectinload(models.Section.exercises)
            .selectinload(models.Exercise.tasks)
        )
        .where(models.Track.is_published == True)
    )
    if track_identifier.isdigit():
        statement = statement.where(models.Track.id == int(track_identifier))
    else:
        statement = statement.where(models.Track.slug == track_identifier)

    track = await db.scalar(statement)
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    await ProgressService.ensure_track_unlocked(db, user_id=int(_user.id), track_id=int(track.id))
    await db.flush()

    track.sections.sort(key=lambda section: int(section.order or 0))
    progress_rows = await db.scalars(
        select(models.UserExerciseProgress)
        .where(models.UserExerciseProgress.user_id == _user.id)
        .where(models.UserExerciseProgress.track_id == track.id)
    )
    progress_map = {int(row.exercise_id): row.status for row in progress_rows.all()}
    for section in track.sections:
        section.exercises.sort(key=lambda exercise: int(exercise.order or 0))
        for exercise in section.exercises:
            exercise.total_tasks = len(exercise.tasks) if exercise.tasks else 0
            exercise.task_ids = [task.id for task in exercise.tasks] if exercise.tasks else []
            exercise.status = progress_map.get(int(exercise.id), "locked")

    track.learner_count = 0
    await db.commit()
    return track

@router.get("/api/tracks/{track_identifier}", response_model=schemas.TrackStudent)
async def get_track_student(
    track_identifier: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> models.Track:
    statement = select(models.Track).options(selectinload(models.Track.sections)).where(models.Track.is_published == True)
    if track_identifier.isdigit():
        statement = statement.where(models.Track.id == int(track_identifier))
    else:
        statement = statement.where(models.Track.slug == track_identifier)
        
    item = await db.scalar(statement)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    item.sections.sort(key=lambda section: int(section.order or 0))
    return item


@router.get("/api/exercises/{exercise_identifier}", response_model=schemas.ExerciseStudent)
async def get_exercise_student(
    exercise_identifier: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> models.Exercise:
    statement = select(models.Exercise).options(selectinload(models.Exercise.tasks))
    if exercise_identifier.isdigit():
        statement = statement.where(models.Exercise.id == int(exercise_identifier))
    else:
        statement = statement.where(models.Exercise.slug == exercise_identifier)
        
    item = await db.scalar(statement)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    item.tasks.sort(key=lambda task: int(task.step_number or 0))
    return item


@router.get("/api/exercises/{exercise_identifier}/workspace", response_model=schemas.ExerciseWorkspaceData)
async def get_exercise_workspace(
    exercise_identifier: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    """Return everything the workspace page needs in a single call."""
    statement = select(models.Exercise).options(selectinload(models.Exercise.tasks))
    if exercise_identifier.isdigit():
        statement = statement.where(models.Exercise.id == int(exercise_identifier))
    else:
        statement = statement.where(models.Exercise.slug == exercise_identifier)
        
    exercise = await db.scalar(statement)
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    section = await db.scalar(
        select(models.Section).where(models.Section.id == exercise.section_id)
    )
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    track = await db.scalar(
        select(models.Track).where(models.Track.id == section.track_id)
    )
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    # Sibling exercises in the same section (for Table of Contents + Back/Next)
    siblings_rows = await db.scalars(
        select(models.Exercise)
        .where(models.Exercise.section_id == section.id)
        .order_by(models.Exercise.order)
    )
    siblings = list(siblings_rows.all())

    exercise.tasks.sort(key=lambda task: int(task.step_number or 0))

    return {
        "id": exercise.id,
        "title": exercise.title,
        "mode": exercise.mode,
        "theory_content": exercise.theory_content,
        "order": exercise.order,
        "tasks": exercise.tasks,
        "section_id": section.id,
        "section_title": section.title,
        "track_id": track.id,
        "track_title": track.title,
        "language_id": track.language_id,
        "exercises_in_section": [
            {"id": s.id, "title": s.title, "order": s.order}
            for s in siblings
        ],
        "total_exercises_in_section": len(siblings),
    }


JUDGE_URL = os.getenv("JUDGE_URL", "http://campus404-judge:2358")

@router.post("/api/exercises/{exercise_id}/tasks/{task_id}/evaluate", response_model=schemas.TaskEvaluateResponse)
async def evaluate_task(
    exercise_id: int,
    task_id: int,
    payload: schemas.TaskEvaluateRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    """Securely evaluates a task's source code against backend-hidden test cases."""
    task = await db.scalar(
        select(models.Task)
        .where(models.Task.id == task_id)
        .where(models.Task.exercise_id == exercise_id)
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    test_cases_raw = task.test_cases
    test_cases = []
    if isinstance(test_cases_raw, str):
        try:
            test_cases = json.loads(test_cases_raw)
        except json.JSONDecodeError:
            pass
    elif isinstance(test_cases_raw, list):
        test_cases = test_cases_raw

    if not test_cases:
        test_cases = [{"input": "", "expected_outputs": [""], "match_mode": "normalize"}]

    passed_count = 0
    first_fail_error = None
    last_output = None
    first_fail_verdict = None

    async with httpx.AsyncClient(timeout=15.0) as client:
        for idx, tc in enumerate(test_cases):
            # 1. Start job
            try:
                resp = await client.post(
                    f"{JUDGE_URL}/submissions",
                    json={
                        "source_code": payload.source_code,
                        "language_id": payload.language_id,
                        "stdin": tc.get("input", ""),
                    },
                )
                resp.raise_for_status()
                job_id = resp.json().get("job_id")
            except Exception as e:
                return {"passed": False, "verdict": "Internal Error", "error": f"Failed to post to judge: {str(e)}", "passed_cases": passed_count, "total_cases": len(test_cases)}

            # 2. Poll job
            result = None
            for _ in range(30):
                await asyncio.sleep(0.5)
                try:
                    poll_resp = await client.get(f"{JUDGE_URL}/submissions/{job_id}")
                    body = poll_resp.json()
                    if body.get("status") == "completed" or body.get("verdict"):
                        result = body
                        break
                except Exception:
                    continue

            if not result:
                return {"passed": False, "verdict": "Time Limit Exceeded", "error": "Execution timed out.", "passed_cases": passed_count, "total_cases": len(test_cases)}

            verdict = result.get("verdict")
            output = (result.get("output") or "").strip()
            error = result.get("error")

            if error:
                import re
                error = re.sub(r'File "/tmp/[^/]+/[^"]+"', 'File "main.py"', error)

            last_output = output

            if verdict != "Accepted" or error:
                first_fail_verdict = verdict if verdict else "Runtime Error"
                first_fail_error = error
                break

            # 3. Validation
            expected_outs = tc.get("expected_outputs", [""])
            if not expected_outs and tc.get("expected_output") is not None:
                expected_outs = [tc.get("expected_output")]
            match_mode = tc.get("match_mode", "normalize")

            passed = False
            for exp in expected_outs:
                if match_mode == "exact":
                    if output == exp:
                        passed = True
                        break
                elif match_mode == "any_of":
                    if output in expected_outs:
                        passed = True
                        break
                else: # normalize
                    if output.strip() == (exp or "").strip():
                        passed = True
                        break

            if passed:
                passed_count += 1
            else:
                first_fail_verdict = "Wrong Answer"
                break

    if passed_count == len(test_cases):
        return {
            "passed": True,
            "verdict": "Accepted",
            "output": last_output,
            "passed_cases": passed_count,
            "total_cases": len(test_cases)
        }
    else:
        return {
            "passed": False,
            "verdict": first_fail_verdict or "Wrong Answer",
            "output": last_output,
            "error": first_fail_error,
            "passed_cases": passed_count,
            "total_cases": len(test_cases)
        }

@router.post("/api/progress/task/{task_id}", response_model=schemas.UserTaskProgressResponse)
async def mark_task_completed(
    task_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user(request, db)
    
    # Check if task exists
    task = await db.scalar(select(models.Task).where(models.Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Check if progress already exists
    progress = await db.scalar(
        select(models.UserTaskProgress)
        .where(models.UserTaskProgress.user_id == user.id)
        .where(models.UserTaskProgress.task_id == task_id)
    )
    
    if progress:
        progress.status = "completed"
        progress.completed_at = func.now()
    else:
        progress = models.UserTaskProgress(
            user_id=user.id,
            task_id=task_id,
            status="completed"
        )
        db.add(progress)
        
    await db.commit()
    await db.refresh(progress)
    return progress

@router.get("/api/progress/task", response_model=list[schemas.UserTaskProgressResponse])
async def get_all_task_progress(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user(request, db)
    
    result = await db.execute(
        select(models.UserTaskProgress)
        .where(models.UserTaskProgress.user_id == user.id)
    )
    return result.scalars().all()


# LEARNING ENGINE HELPERS

async def _workspace_payload(
    db: AsyncSession,
    *,
    user: User,
    exercise_id: int,
) -> schemas.ExerciseWorkspaceData:
    try:
        exercise, section, track = await SubmissionService.get_exercise_context(db, exercise_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    await ProgressService.ensure_track_unlocked(db, user_id=int(user.id), track_id=int(track.id))
    await ProgressService.mark_exercise_started(db, user_id=int(user.id), exercise=exercise)
    await db.flush()

    progress = await ProgressService.get_exercise_progress(
        db,
        user_id=int(user.id),
        exercise_id=int(exercise.id),
    )
    track_tree = await db.scalar(
        select(models.Track)
        .options(
            selectinload(models.Track.sections)
            .selectinload(models.Section.exercises)
            .selectinload(models.Exercise.tasks)
        )
        .where(models.Track.id == track.id)
    )
    progress_rows = await db.scalars(
        select(models.UserExerciseProgress)
        .where(models.UserExerciseProgress.user_id == user.id)
        .where(models.UserExerciseProgress.track_id == track.id)
    )
    progress_map = {int(row.exercise_id): row for row in progress_rows.all()}

    sections_payload: list[dict[str, Any]] = []
    exercises_in_section: list[dict[str, Any]] = []
    for item_section in sorted(track_tree.sections if track_tree else [], key=lambda item: int(item.order or 0)):
        exercises_payload = []
        completed = 0
        for item_exercise in sorted(item_section.exercises or [], key=lambda item: int(item.order or 0)):
            item_progress = progress_map.get(int(item_exercise.id))
            item_status = item_progress.status if item_progress else "locked"
            if item_status == "completed":
                completed += 1
            summary = {
                "id": item_exercise.id,
                "section_id": item_exercise.section_id,
                "order": item_exercise.order,
                "title": item_exercise.title,
                "slug": item_exercise.slug,
                "mode": "code" if item_exercise.mode == "task" else item_exercise.mode,
                "total_tasks": len(item_exercise.tasks or []),
                "xp_reward": item_exercise.xp_reward,
                "status": item_status,
            }
            exercises_payload.append(summary)
            if int(item_section.id) == int(section.id):
                exercises_in_section.append(
                    {
                        "id": item_exercise.id,
                        "title": item_exercise.title,
                        "slug": item_exercise.slug,
                        "order": item_exercise.order,
                        "mode": "code" if item_exercise.mode == "task" else item_exercise.mode,
                        "status": item_status,
                    }
                )
        total = len(exercises_payload)
        sections_payload.append(
            {
                "id": item_section.id,
                "track_id": item_section.track_id,
                "order": item_section.order,
                "title": item_section.title,
                "slug": item_section.slug,
                "badge_url": item_section.badge_url,
                "status": "completed" if total and completed >= total else ("in_progress" if completed else "unlocked"),
                "progress_percent": round((completed / total) * 100) if total else 0,
                "exercises": exercises_payload,
            }
        )

    files = sorted(exercise.files or [], key=lambda item: int(item.order or 0))
    file_payload = [
        schemas.ExerciseFileStudent.model_validate(file)
        for file in files
    ]
    if not file_payload and exercise.tasks:
        first_task = sorted(exercise.tasks, key=lambda item: int(item.step_number or 0))[0]
        file_payload = [
            schemas.ExerciseFileStudent(
                id=0,
                exercise_id=int(exercise.id),
                file_path="main.py",
                language="python",
                starter_code=first_task.starter_code or "",
                is_entrypoint=True,
                is_editable=True,
                order=1,
            )
        ]

    hint_payload = []
    for hint in sorted(exercise.hints or [], key=lambda item: int(item.order or 0)):
        unlocked = await SubmissionService._hint_is_unlocked(  # noqa: SLF001 - route-level projection helper.
            db,
            user_id=int(user.id),
            exercise_id=int(exercise.id),
            hint=hint,
        )
        usage = await db.scalar(
            select(models.HintUsage)
            .where(models.HintUsage.user_id == user.id)
            .where(models.HintUsage.hint_id == hint.id)
        )
        hint_payload.append(
            schemas.HintStudent(
                id=hint.id,
                exercise_id=hint.exercise_id,
                order=hint.order,
                unlock_rule=hint.unlock_rule,
                penalty_xp=hint.penalty_xp,
                is_unlocked=unlocked,
                has_used=usage is not None,
                content_md=hint.content_md if unlocked else None,
            )
        )

    questions = []
    for question in sorted(exercise.quiz_questions or [], key=lambda item: int(item.order or 0)):
        question.options.sort(key=lambda option: int(option.order or 0))
        questions.append(schemas.QuizQuestionStudent.model_validate(question))

    user_xp = int(
        (
            await db.scalar(
                select(func.coalesce(func.sum(models.XpEvent.points), 0))
                .where(models.XpEvent.user_id == user.id)
            )
        )
        or 0
    )

    return schemas.ExerciseWorkspaceData(
        id=exercise.id,
        title=exercise.title,
        mode="code" if exercise.mode == "task" else exercise.mode,
        theory_content=exercise.theory_content,
        instructions_md=exercise.instructions_md,
        order=exercise.order,
        tasks=sorted(exercise.tasks or [], key=lambda item: int(item.step_number or 0)),
        files=file_payload,
        hints=hint_payload,
        quiz_questions=questions,
        reference_solution_url=exercise.reference_solution_url,
        docs_url=exercise.docs_url,
        xp_reward=exercise.xp_reward,
        passing_score_pct=exercise.passing_score_pct,
        attempts_allowed=exercise.attempts_allowed,
        validation_config=exercise.validation_config,
        auto_submit_on_pass=exercise.auto_submit_on_pass,
        status=progress.status if progress else "unlocked",
        best_score=progress.best_score if progress else 0,
        attempts_count=progress.attempts_count if progress else 0,
        section_id=section.id,
        section_title=section.title,
        track_id=track.id,
        track_title=track.title,
        language_id=track.language_id,
        exercises_in_section=exercises_in_section,
        sections=sections_payload,
        total_exercises_in_section=len(exercises_in_section),
        user_xp=user_xp,
        current_streak=await ProgressService.current_streak(db, user_id=int(user.id)),
    )


# LEARNING ENGINE: STUDENT WORKSPACE

@router.get("/api/workspace/exercises/{exercise_id}", response_model=schemas.ExerciseWorkspaceData)
async def get_workspace_exercise(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ExerciseWorkspaceData:
    payload = await _workspace_payload(db, user=user, exercise_id=exercise_id)
    await db.commit()
    return payload


@router.post("/api/workspace/exercises/{exercise_id}/run", response_model=schemas.ExerciseRunResponse)
async def run_workspace_exercise(
    exercise_id: int,
    payload: schemas.ExerciseRunRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ExerciseRunResponse:
    try:
        result = await SubmissionService.run_exercise(
            db,
            user_id=int(user.id),
            exercise_id=exercise_id,
            payload=payload,
        )
        await db.commit()
        return result
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/api/workspace/exercises/{exercise_id}/submit", response_model=schemas.ExerciseSubmitResponse)
async def submit_workspace_exercise(
    exercise_id: int,
    payload: schemas.ExerciseSubmitRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ExerciseSubmitResponse:
    try:
        result = await SubmissionService.submit_exercise(
            db,
            user_id=int(user.id),
            exercise_id=exercise_id,
            payload=payload,
        )
        await db.commit()
        return result
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/api/workspace/exercises/{exercise_id}/hint/{hint_id}", response_model=schemas.HintUsageResponse)
async def use_workspace_hint(
    exercise_id: int,
    hint_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.HintUsageResponse:
    try:
        hint, used_at = await SubmissionService.use_hint(
            db,
            user_id=int(user.id),
            exercise_id=exercise_id,
            hint_id=hint_id,
        )
        await db.commit()
        return schemas.HintUsageResponse(
            hint=schemas.HintStudent(
                id=hint.id,
                exercise_id=hint.exercise_id,
                order=hint.order,
                unlock_rule=hint.unlock_rule,
                penalty_xp=hint.penalty_xp,
                is_unlocked=True,
                has_used=True,
                content_md=hint.content_md,
            ),
            used_at=used_at,
        )
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/api/workspace/exercises/{exercise_id}/reference-access", response_model=schemas.ReferenceAccessResponse)
async def record_workspace_reference_access(
    exercise_id: int,
    payload: schemas.ReferenceAccessRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ReferenceAccessResponse:
    try:
        access = await SubmissionService.record_reference_access(
            db,
            user_id=int(user.id),
            exercise_id=exercise_id,
            reference_url=payload.reference_url,
        )
        await db.commit()
        return schemas.ReferenceAccessResponse(reference_url=access.reference_url, accessed_at=access.accessed_at)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/api/workspace/exercises/{exercise_id}/complete-theory", response_model=schemas.ExerciseSubmitResponse)
async def complete_workspace_theory(
    exercise_id: int,
    _payload: schemas.TheoryCompleteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ExerciseSubmitResponse:
    try:
        result = await SubmissionService.complete_theory(db, user_id=int(user.id), exercise_id=exercise_id)
        await db.commit()
        return result
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# LEARNING ENGINE: QUIZZES

@router.post("/api/workspace/quizzes/{exercise_id}/start", response_model=schemas.QuizStartResponse)
async def start_workspace_quiz(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.QuizStartResponse:
    try:
        attempt, questions, exercise = await SubmissionService.start_quiz(db, user_id=int(user.id), exercise_id=exercise_id)
        await db.commit()
        return schemas.QuizStartResponse(
            attempt_id=attempt.id,
            exercise_id=exercise_id,
            questions=[schemas.QuizQuestionStudent.model_validate(question) for question in questions],
            passing_score_pct=exercise.passing_score_pct,
            attempts_allowed=exercise.attempts_allowed,
        )
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/api/workspace/quizzes/{exercise_id}/answer")
async def answer_workspace_quiz(
    exercise_id: int,
    payload: schemas.QuizAnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    try:
        await SubmissionService.answer_quiz(
            db,
            user_id=int(user.id),
            attempt_id=payload.attempt_id,
            question_id=payload.question_id,
            option_id=payload.option_id,
        )
        await db.commit()
        return {"message": "Answer saved"}
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/api/workspace/quizzes/{exercise_id}/finish", response_model=schemas.QuizFinishResponse)
async def finish_workspace_quiz(
    exercise_id: int,
    payload: schemas.QuizFinishRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.QuizFinishResponse:
    try:
        result = await SubmissionService.finish_quiz(
            db,
            user_id=int(user.id),
            attempt_id=payload.attempt_id,
            answers=payload.answers,
        )
        await db.commit()
        return result
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# LEARNING ENGINE: PROGRESS, XP, BADGES, LEADERBOARDS

@router.get("/api/tracks/{track_id}/progress")
async def get_track_progress(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    await ProgressService.ensure_track_unlocked(db, user_id=int(user.id), track_id=track_id)
    snapshot = await ProgressService.recalculate_track(db, user_id=int(user.id), track_id=track_id)
    await db.commit()
    return snapshot


@router.get("/api/leaderboard/global", response_model=schemas.LeaderboardResponse)
async def get_global_leaderboard(
    time_range: str = "all_time",
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.LeaderboardResponse:
    return await LeaderboardService.leaderboard(
        db,
        time_range=time_range,
        page=page,
        page_size=page_size,
        current_user_id=int(user.id),
    )


@router.get("/api/leaderboard/tracks/{track_id}", response_model=schemas.LeaderboardResponse)
async def get_track_xp_leaderboard(
    track_id: int,
    time_range: str = "all_time",
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.LeaderboardResponse:
    return await LeaderboardService.leaderboard(
        db,
        track_id=track_id,
        time_range=time_range,
        page=page,
        page_size=page_size,
        current_user_id=int(user.id),
    )


@router.get("/api/users/me/progress", response_model=schemas.UserProgressResponse)
async def get_my_progress(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.UserProgressResponse:
    total_xp = int(
        (
            await db.scalar(
                select(func.coalesce(func.sum(models.XpEvent.points), 0))
                .where(models.XpEvent.user_id == user.id)
            )
        )
        or 0
    )
    completed_exercises = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.UserExerciseProgress)
                .where(models.UserExerciseProgress.user_id == user.id)
                .where(models.UserExerciseProgress.status == "completed")
            )
        )
        or 0
    )
    completed_tracks = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.UserTrackProgress)
                .where(models.UserTrackProgress.user_id == user.id)
                .where(models.UserTrackProgress.status == "completed")
            )
        )
        or 0
    )
    track_rows = await db.execute(
        select(models.UserTrackProgress, models.Track)
        .join(models.Track, models.Track.id == models.UserTrackProgress.track_id)
        .where(models.UserTrackProgress.user_id == user.id)
        .order_by(models.UserTrackProgress.updated_at.desc())
    )
    badges = await db.scalars(
        select(models.UserBadge)
        .options(selectinload(models.UserBadge.badge))
        .where(models.UserBadge.user_id == user.id)
        .order_by(models.UserBadge.awarded_at.desc())
    )
    return schemas.UserProgressResponse(
        total_xp=total_xp,
        completed_exercises=completed_exercises,
        completed_tracks=completed_tracks,
        current_streak=await ProgressService.current_streak(db, user_id=int(user.id)),
        tracks=[
            {
                "track_id": progress.track_id,
                "title": track.title,
                "slug": track.slug,
                "status": progress.status,
                "completed_exercises": progress.completed_exercises,
                "total_exercises": progress.total_exercises,
                "total_xp": progress.total_xp,
                "progress_percent": round((progress.completed_exercises / progress.total_exercises) * 100)
                if progress.total_exercises
                else 0,
            }
            for progress, track in track_rows.all()
        ],
        badges=list(badges.all()),
    )


@router.get("/api/users/me/xp-events", response_model=list[schemas.XpEventResponse])
async def get_my_xp_events(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[models.XpEvent]:
    rows = await db.scalars(
        select(models.XpEvent)
        .where(models.XpEvent.user_id == user.id)
        .order_by(models.XpEvent.created_at.desc())
        .limit(max(1, min(int(limit or 50), 200)))
    )
    return list(rows.all())


@router.get("/api/users/me/badges", response_model=list[schemas.UserBadgeResponse])
async def get_my_badges(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[models.UserBadge]:
    rows = await db.scalars(
        select(models.UserBadge)
        .options(selectinload(models.UserBadge.badge))
        .where(models.UserBadge.user_id == user.id)
        .order_by(models.UserBadge.awarded_at.desc())
    )
    return list(rows.all())


# LEARNING ENGINE: ADMIN CONTENT STUDIO

@router.get("/api/admin/curriculum/tree", response_model=schemas.AdminCurriculumTreeResponse)
async def get_admin_curriculum_tree(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> schemas.AdminCurriculumTreeResponse:
    rows = await db.scalars(
        select(models.Track)
        .options(selectinload(models.Track.sections).selectinload(models.Section.exercises))
        .order_by(models.Track.order)
    )
    tracks = list(rows.all())
    for track in tracks:
        track.sections = _ordered(list(track.sections or []))
        for section in track.sections:
            section.exercises = _ordered(list(section.exercises or []))
    return schemas.AdminCurriculumTreeResponse(tracks=tracks)


@router.get("/api/admin/exercises/{exercise_id}/studio", response_model=schemas.AdminExerciseStudioData)
async def get_admin_exercise_studio(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> schemas.AdminExerciseStudioData:
    exercise, section, track = await _load_exercise_admin_context(db, exercise_id)
    return schemas.AdminExerciseStudioData(
        exercise=exercise,
        section=section,
        track=track,
        publish_check=await _exercise_publish_check(exercise, section, track),
    )


@router.put("/api/admin/exercises/{exercise_id}/studio", response_model=schemas.AdminExerciseStudioData)
async def save_admin_exercise_studio(
    exercise_id: int,
    payload: schemas.AdminExerciseStudioUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> schemas.AdminExerciseStudioData:
    exercise, section, track = await _load_exercise_admin_context(db, exercise_id)

    if payload.exercise:
        if payload.exercise.order is not None:
            exercise.order = await _reposition_sequence(
                db,
                models.Exercise,
                models.Exercise.order,
                int(exercise.order),
                int(payload.exercise.order),
                [models.Exercise.section_id == exercise.section_id],
            )
        _apply_exercise_patch(exercise, payload.exercise)

    if payload.files is not None:
        await db.execute(delete(models.ExerciseFile).where(models.ExerciseFile.exercise_id == exercise_id))
        entrypoint_seen = False
        for index, file_payload in enumerate(payload.files, start=1):
            is_entrypoint = bool(file_payload.is_entrypoint)
            if is_entrypoint:
                entrypoint_seen = True
            db.add(
                models.ExerciseFile(
                    exercise_id=exercise_id,
                    file_path=file_payload.file_path,
                    language=file_payload.language,
                    starter_code=file_payload.starter_code,
                    solution_code=file_payload.solution_code,
                    is_entrypoint=is_entrypoint,
                    is_editable=file_payload.is_editable,
                    order=file_payload.order or index,
                )
            )
        if payload.files and not entrypoint_seen:
            await db.flush()
            first_file = await db.scalar(
                select(models.ExerciseFile)
                .where(models.ExerciseFile.exercise_id == exercise_id)
                .order_by(models.ExerciseFile.order)
            )
            if first_file:
                first_file.is_entrypoint = True

    if payload.test_cases is not None:
        await db.execute(delete(models.ExerciseTestCase).where(models.ExerciseTestCase.exercise_id == exercise_id))
        for index, case_payload in enumerate(payload.test_cases, start=1):
            db.add(
                models.ExerciseTestCase(
                    exercise_id=exercise_id,
                    label=case_payload.label,
                    stdin=case_payload.stdin,
                    expected_stdout=case_payload.expected_stdout,
                    expected_outputs=case_payload.expected_outputs,
                    match_mode=case_payload.match_mode,
                    is_hidden=case_payload.is_hidden,
                    timeout_ms=case_payload.timeout_ms,
                    memory_limit_mb=case_payload.memory_limit_mb,
                    custom_judge_options=case_payload.custom_judge_options,
                    order=case_payload.order or index,
                )
            )

    if payload.hints is not None:
        await db.execute(delete(models.Hint).where(models.Hint.exercise_id == exercise_id))
        for index, hint_payload in enumerate(payload.hints, start=1):
            db.add(
                models.Hint(
                    exercise_id=exercise_id,
                    content_md=hint_payload.content_md,
                    order=hint_payload.order or index,
                    unlock_rule=hint_payload.unlock_rule,
                    penalty_xp=hint_payload.penalty_xp,
                )
            )

    if payload.quiz is not None:
        await db.execute(
            delete(models.QuizOption).where(
                models.QuizOption.question_id.in_(
                    select(models.QuizQuestion.id).where(models.QuizQuestion.exercise_id == exercise_id)
                )
            ).execution_options(synchronize_session=False)
        )
        await db.execute(delete(models.QuizQuestion).where(models.QuizQuestion.exercise_id == exercise_id))
        exercise.passing_score_pct = payload.quiz.passing_score_pct
        exercise.attempts_allowed = payload.quiz.attempts_allowed
        for question_index, question_payload in enumerate(payload.quiz.questions, start=1):
            question = models.QuizQuestion(
                exercise_id=exercise_id,
                question_text=question_payload.question_text,
                question_type=question_payload.question_type,
                code_snippet=question_payload.code_snippet,
                explanation_md=question_payload.explanation_md,
                order=question_payload.order or question_index,
            )
            db.add(question)
            await db.flush()
            for option_index, option_payload in enumerate(question_payload.options, start=1):
                db.add(
                    models.QuizOption(
                        question_id=question.id,
                        option_text=option_payload.option_text,
                        is_correct=option_payload.is_correct,
                        explanation_md=option_payload.explanation_md,
                        order=option_payload.order or option_index,
                    )
                )

    await db.commit()
    fresh_exercise, fresh_section, fresh_track = await _load_exercise_admin_context(db, exercise_id)
    return schemas.AdminExerciseStudioData(
        exercise=fresh_exercise,
        section=fresh_section,
        track=fresh_track,
        publish_check=await _exercise_publish_check(fresh_exercise, fresh_section, fresh_track),
    )


@router.post("/api/admin/exercises/{exercise_id}/validate", response_model=schemas.AdminExerciseValidationResponse)
async def validate_admin_exercise(
    exercise_id: int,
    payload: schemas.AdminExerciseValidateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> schemas.AdminExerciseValidationResponse:
    exercise, _section, track = await _load_exercise_admin_context(db, exercise_id)
    mode = _normalize_mode(exercise.mode)

    if payload.files is not None:
        files = [
            schemas.SubmittedFile(
                file_path=item.file_path,
                content=item.content,
                language=item.language,
                is_entrypoint=item.is_entrypoint,
            )
            for item in payload.files
        ]
    else:
        files = [
            schemas.SubmittedFile(
                file_path=file.file_path,
                content=(file.solution_code if payload.use_solution else file.starter_code) or file.starter_code or "",
                language=file.language,
                is_entrypoint=bool(file.is_entrypoint),
            )
            for file in _ordered(list(exercise.files or []))
        ]
        if not files and exercise.tasks:
            task = _ordered(list(exercise.tasks or []), "step_number")[0]
            files = [
                schemas.SubmittedFile(
                    file_path=SubmissionService._default_file_name(int(track.language_id)),  # noqa: SLF001
                    content=(task.solution_code if payload.use_solution else task.starter_code) or task.starter_code or "",
                    is_entrypoint=True,
                )
            ]

    test_cases = SubmissionService._test_cases(exercise)  # noqa: SLF001
    if not payload.include_hidden:
        test_cases = [case for case in test_cases if not bool(case.get("is_hidden", True))]
    if mode == "frontend_preview":
        test_cases = [
            {
                "label": "Preview validation",
                "stdin": "",
                "expected_outputs": [],
                "match_mode": "normalize",
                "is_hidden": False,
                "validation_config": exercise.validation_config or {},
                "validation_kind": "frontend_preview",
            }
        ]

    passed_count = 0
    visible_results: list[dict[str, Any]] = []
    judge_results: list[dict[str, Any]] = []
    first_error: str | None = None
    first_verdict: str | None = None

    for index, test_case in enumerate(test_cases):
        result = await SubmissionService._judge_submission(  # noqa: SLF001
            files=files,
            language_id=SubmissionService._language_id_for_files(files, int(track.language_id)),  # noqa: SLF001
            test_case=test_case,
            mode=mode,
        )
        judge_results.append(result)
        verdict = result.get("verdict") or "Internal Error"
        case_passed = verdict == "Accepted" and not result.get("error")
        if case_passed:
            passed_count += 1
        elif first_verdict is None:
            first_verdict = verdict
            first_error = result.get("error") or result.get("output") or "Validation failed."
        visible_results.append(
            {
                "label": test_case.get("label") or f"Check {index + 1}",
                "passed": case_passed,
                "verdict": verdict,
                "hidden": bool(test_case.get("is_hidden", False)),
                "output": result.get("output"),
                "error": result.get("error"),
            }
        )

    total_cases = len(test_cases)
    passed = total_cases == 0 or passed_count == total_cases
    return schemas.AdminExerciseValidationResponse(
        passed=passed,
        verdict="Accepted" if passed else (first_verdict or "Wrong Answer"),
        passed_cases=passed_count,
        total_cases=total_cases,
        visible_results=visible_results,
        judge_result={"results": judge_results},
        error=first_error,
    )


@router.post("/api/admin/exercises/{exercise_id}/preview")
async def preview_admin_exercise(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> dict[str, Any]:
    exercise, section, track = await _load_exercise_admin_context(db, exercise_id)
    return {
        "learner_preview_url": f"/{track.slug or track.id}/{section.slug or section.id}/{exercise.slug or exercise.id}/{exercise.id}",
        "mode": _normalize_mode(exercise.mode),
        "title": exercise.title,
        "instructions_md": exercise.instructions_md,
        "theory_content": exercise.theory_content,
        "files": [schemas.ExerciseFileInDB.model_validate(file).model_dump() for file in exercise.files or []],
        "validation_config": exercise.validation_config or {},
    }


@router.post("/api/admin/tracks/{track_id}/publish-check", response_model=schemas.AdminPublishCheckResponse)
async def check_track_publish_ready(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> schemas.AdminPublishCheckResponse:
    track = await db.scalar(
        select(models.Track)
        .options(
            selectinload(models.Track.sections)
            .selectinload(models.Section.exercises)
            .selectinload(models.Exercise.files),
            selectinload(models.Track.sections)
            .selectinload(models.Section.exercises)
            .selectinload(models.Exercise.test_cases),
            selectinload(models.Track.sections)
            .selectinload(models.Section.exercises)
            .selectinload(models.Exercise.hints),
            selectinload(models.Track.sections)
            .selectinload(models.Section.exercises)
            .selectinload(models.Exercise.quiz_questions)
            .selectinload(models.QuizQuestion.options),
        )
        .where(models.Track.id == track_id)
    )
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")

    issues: list[schemas.AdminPublishIssue] = []
    if not str(track.title or "").strip():
        issues.append(schemas.AdminPublishIssue(scope="track", track_id=track_id, message="Track title is required."))
    if not str(track.slug or "").strip():
        issues.append(schemas.AdminPublishIssue(scope="track", track_id=track_id, message="Track slug is required."))
    if not track.sections:
        issues.append(schemas.AdminPublishIssue(scope="track", track_id=track_id, message="Add at least one section."))

    section_count = 0
    exercise_count = 0
    file_count = 0
    test_count = 0
    for section in _ordered(list(track.sections or [])):
        section_count += 1
        if not str(section.title or "").strip():
            issues.append(
                schemas.AdminPublishIssue(scope="section", track_id=track_id, section_id=int(section.id), message="Section title is required.")
            )
        if not section.exercises:
            issues.append(
                schemas.AdminPublishIssue(scope="section", track_id=track_id, section_id=int(section.id), message="Add at least one exercise.")
            )
        for exercise in _ordered(list(section.exercises or [])):
            exercise_count += 1
            file_count += len(exercise.files or [])
            test_count += len(exercise.test_cases or [])
            issues.extend(_exercise_publish_issues(exercise, track_id=track_id, section_id=int(section.id)))

    return schemas.AdminPublishCheckResponse(
        ready=not any(issue.severity == "error" for issue in issues),
        issues=issues,
        totals={
            "sections": section_count,
            "exercises": exercise_count,
            "files": file_count,
            "tests": test_count,
        },
    )


@router.get("/api/admin/exercises/{exercise_id}/files", response_model=list[schemas.ExerciseFileInDB])
async def list_exercise_files(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[models.ExerciseFile]:
    rows = await db.scalars(
        select(models.ExerciseFile)
        .where(models.ExerciseFile.exercise_id == exercise_id)
        .order_by(models.ExerciseFile.order)
    )
    return list(rows.all())


@router.post("/api/admin/exercises/{exercise_id}/files", response_model=schemas.ExerciseFileInDB, status_code=status.HTTP_201_CREATED)
async def create_exercise_file(
    exercise_id: int,
    payload: schemas.ExerciseFileCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.ExerciseFile:
    exercise = await db.scalar(select(models.Exercise).where(models.Exercise.id == exercise_id))
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")
    if payload.is_entrypoint:
        await db.execute(
            update(models.ExerciseFile)
            .where(models.ExerciseFile.exercise_id == exercise_id)
            .values(is_entrypoint=False)
        )
    order_value = await _resolve_insert_position(
        db,
        models.ExerciseFile,
        models.ExerciseFile.order,
        payload.order,
        [models.ExerciseFile.exercise_id == exercise_id],
    )
    item = models.ExerciseFile(
        exercise_id=exercise_id,
        file_path=payload.file_path,
        language=payload.language,
        starter_code=payload.starter_code,
        solution_code=payload.solution_code,
        is_entrypoint=payload.is_entrypoint,
        is_editable=payload.is_editable,
        order=order_value,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/api/admin/exercise-files/{file_id}", response_model=schemas.ExerciseFileInDB)
async def update_exercise_file(
    file_id: int,
    payload: schemas.ExerciseFileUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.ExerciseFile:
    item = await db.scalar(select(models.ExerciseFile).where(models.ExerciseFile.id == file_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if payload.is_entrypoint is True:
        await db.execute(
            update(models.ExerciseFile)
            .where(models.ExerciseFile.exercise_id == item.exercise_id)
            .where(models.ExerciseFile.id != item.id)
            .values(is_entrypoint=False)
        )
    for field in [
        "file_path",
        "language",
        "starter_code",
        "solution_code",
        "is_entrypoint",
        "is_editable",
        "order",
    ]:
        value = getattr(payload, field)
        if value is not None:
            setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/api/admin/exercise-files/{file_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_exercise_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Response:
    item = await db.scalar(select(models.ExerciseFile).where(models.ExerciseFile.id == file_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    await db.delete(item)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/admin/exercises/{exercise_id}/hints", response_model=list[schemas.HintInDB])
async def list_exercise_hints(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[models.Hint]:
    rows = await db.scalars(select(models.Hint).where(models.Hint.exercise_id == exercise_id).order_by(models.Hint.order))
    return list(rows.all())


@router.post("/api/admin/exercises/{exercise_id}/hints", response_model=schemas.HintInDB, status_code=status.HTTP_201_CREATED)
async def create_exercise_hint(
    exercise_id: int,
    payload: schemas.HintCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Hint:
    exercise = await db.scalar(select(models.Exercise).where(models.Exercise.id == exercise_id))
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")
    order_value = await _resolve_insert_position(
        db,
        models.Hint,
        models.Hint.order,
        payload.order,
        [models.Hint.exercise_id == exercise_id],
    )
    item = models.Hint(
        exercise_id=exercise_id,
        content_md=payload.content_md,
        order=order_value,
        unlock_rule=payload.unlock_rule,
        penalty_xp=payload.penalty_xp,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/api/admin/hints/{hint_id}", response_model=schemas.HintInDB)
async def update_exercise_hint(
    hint_id: int,
    payload: schemas.HintUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Hint:
    item = await db.scalar(select(models.Hint).where(models.Hint.id == hint_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hint not found")
    for field in ["content_md", "order", "unlock_rule", "penalty_xp"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/api/admin/hints/{hint_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_exercise_hint(
    hint_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Response:
    item = await db.scalar(select(models.Hint).where(models.Hint.id == hint_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hint not found")
    await db.delete(item)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/admin/exercises/{exercise_id}/test-cases", response_model=list[schemas.ExerciseTestCaseInDB])
async def list_exercise_test_cases(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[models.ExerciseTestCase]:
    rows = await db.scalars(
        select(models.ExerciseTestCase)
        .where(models.ExerciseTestCase.exercise_id == exercise_id)
        .order_by(models.ExerciseTestCase.order)
    )
    return list(rows.all())


@router.post("/api/admin/exercises/{exercise_id}/test-cases", response_model=schemas.ExerciseTestCaseInDB, status_code=status.HTTP_201_CREATED)
async def create_exercise_test_case(
    exercise_id: int,
    payload: schemas.ExerciseTestCaseCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.ExerciseTestCase:
    exercise = await db.scalar(select(models.Exercise).where(models.Exercise.id == exercise_id))
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")
    order_value = await _resolve_insert_position(
        db,
        models.ExerciseTestCase,
        models.ExerciseTestCase.order,
        payload.order,
        [models.ExerciseTestCase.exercise_id == exercise_id],
    )
    item = models.ExerciseTestCase(
        exercise_id=exercise_id,
        label=payload.label,
        stdin=payload.stdin,
        expected_stdout=payload.expected_stdout,
        expected_outputs=payload.expected_outputs,
        match_mode=payload.match_mode,
        is_hidden=payload.is_hidden,
        timeout_ms=payload.timeout_ms,
        memory_limit_mb=payload.memory_limit_mb,
        custom_judge_options=payload.custom_judge_options,
        order=order_value,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/api/admin/test-cases/{case_id}", response_model=schemas.ExerciseTestCaseInDB)
async def update_exercise_test_case(
    case_id: int,
    payload: schemas.ExerciseTestCaseUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.ExerciseTestCase:
    item = await db.scalar(select(models.ExerciseTestCase).where(models.ExerciseTestCase.id == case_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")
    for field in [
        "label",
        "stdin",
        "expected_stdout",
        "expected_outputs",
        "match_mode",
        "is_hidden",
        "timeout_ms",
        "memory_limit_mb",
        "custom_judge_options",
        "order",
    ]:
        value = getattr(payload, field)
        if value is not None:
            setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/api/admin/test-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_exercise_test_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Response:
    item = await db.scalar(select(models.ExerciseTestCase).where(models.ExerciseTestCase.id == case_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")
    await db.delete(item)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/api/admin/exercises/{exercise_id}/quiz", response_model=schemas.ExerciseAdmin)
async def save_exercise_quiz(
    exercise_id: int,
    payload: schemas.QuizPayload,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Exercise:
    exercise = await db.scalar(
        select(models.Exercise)
        .options(selectinload(models.Exercise.quiz_questions).selectinload(models.QuizQuestion.options))
        .where(models.Exercise.id == exercise_id)
    )
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")
    for question in list(exercise.quiz_questions or []):
        await db.delete(question)
    exercise.mode = "quiz"
    exercise.passing_score_pct = payload.passing_score_pct
    exercise.attempts_allowed = payload.attempts_allowed
    for question_index, question_payload in enumerate(payload.questions, start=1):
        question = models.QuizQuestion(
            exercise_id=exercise_id,
            question_text=question_payload.question_text,
            question_type=question_payload.question_type,
            code_snippet=question_payload.code_snippet,
            explanation_md=question_payload.explanation_md,
            order=question_payload.order or question_index,
        )
        db.add(question)
        await db.flush()
        for option_index, option_payload in enumerate(question_payload.options, start=1):
            db.add(
                models.QuizOption(
                    question_id=question.id,
                    option_text=option_payload.option_text,
                    is_correct=option_payload.is_correct,
                    explanation_md=option_payload.explanation_md,
                    order=option_payload.order or option_index,
                )
            )
    await db.commit()
    fresh = await db.scalar(
        select(models.Exercise)
        .options(
            selectinload(models.Exercise.tasks),
            selectinload(models.Exercise.files),
            selectinload(models.Exercise.hints),
            selectinload(models.Exercise.test_cases),
            selectinload(models.Exercise.quiz_questions).selectinload(models.QuizQuestion.options),
        )
        .where(models.Exercise.id == exercise_id)
    )
    return fresh


@router.get("/api/admin/badges", response_model=list[schemas.BadgeResponse])
async def list_admin_badges(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[models.Badge]:
    rows = await db.scalars(select(models.Badge).order_by(models.Badge.title))
    return list(rows.all())


@router.post("/api/admin/badges", response_model=schemas.BadgeResponse, status_code=status.HTTP_201_CREATED)
async def create_badge(
    payload: schemas.BadgeCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Badge:
    badge = models.Badge(**payload.model_dump())
    db.add(badge)
    await db.commit()
    await db.refresh(badge)
    return badge


@router.put("/api/admin/badges/{badge_id}", response_model=schemas.BadgeResponse)
async def update_badge(
    badge_id: int,
    payload: schemas.BadgeUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> models.Badge:
    badge = await db.scalar(select(models.Badge).where(models.Badge.id == badge_id))
    if not badge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Badge not found")
    for field in [
        "badge_key",
        "title",
        "description",
        "icon_url",
        "scope",
        "rule_type",
        "rule_config",
        "xp_bonus",
        "is_active",
    ]:
        value = getattr(payload, field)
        if value is not None:
            setattr(badge, field, value)
    await db.commit()
    await db.refresh(badge)
    return badge


@router.delete("/api/admin/badges/{badge_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_badge(
    badge_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Response:
    badge = await db.scalar(select(models.Badge).where(models.Badge.id == badge_id))
    if not badge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Badge not found")
    await db.delete(badge)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/admin/dashboard/stats", response_model=schemas.AdminDashboardStats)
async def get_admin_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> schemas.AdminDashboardStats:
    now = datetime.utcnow()
    start_24h = now - timedelta(days=1)
    start_7d = now - timedelta(days=7)
    start_30d = now - timedelta(days=30)

    total_users = int((await db.scalar(select(func.count()).select_from(User))) or 0)
    active_learners = int(
        (
            await db.scalar(
                select(func.count(func.distinct(models.XpEvent.user_id)))
                .where(models.XpEvent.created_at >= datetime.utcnow() - timedelta(days=7))
            )
        )
        or 0
    )
    total_tracks = int((await db.scalar(select(func.count()).select_from(models.Track))) or 0)
    published_tracks = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.Track)
                .where(models.Track.is_published == True)
            )
        )
        or 0
    )
    draft_tracks = max(total_tracks - published_tracks, 0)
    total_sections = int((await db.scalar(select(func.count()).select_from(models.Section))) or 0)
    total_exercises = int((await db.scalar(select(func.count()).select_from(models.Exercise))) or 0)
    published_exercises = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.Exercise)
                .where(models.Exercise.is_published == True)
            )
        )
        or 0
    )
    draft_exercises = max(total_exercises - published_exercises, 0)
    exercises_solved = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.UserExerciseProgress)
                .where(models.UserExerciseProgress.status == "completed")
            )
        )
        or 0
    )
    total_progress_records = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.UserExerciseProgress)
            )
        )
        or 0
    )
    quiz_completions = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.QuizAttempt)
                .where(models.QuizAttempt.completed_at.is_not(None))
            )
        )
        or 0
    )
    quiz_passes = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.QuizAttempt)
                .where(models.QuizAttempt.completed_at.is_not(None))
                .where(models.QuizAttempt.passed == True)
            )
        )
        or 0
    )
    pending_content = draft_tracks + draft_exercises
    total_xp = int((await db.scalar(select(func.coalesce(func.sum(models.XpEvent.points), 0)))) or 0)
    xp_last_7_days = int(
        (
            await db.scalar(
                select(func.coalesce(func.sum(models.XpEvent.points), 0))
                .where(models.XpEvent.created_at >= start_7d)
            )
        )
        or 0
    )
    xp_awarded_24h = int(
        (
            await db.scalar(
                select(func.coalesce(func.sum(models.XpEvent.points), 0))
                .where(models.XpEvent.created_at >= start_24h)
            )
        )
        or 0
    )
    attempts_last_24h = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.ExerciseAttempt)
                .where(models.ExerciseAttempt.created_at >= start_24h)
            )
        )
        or 0
    )
    passed_attempts_last_24h = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.ExerciseAttempt)
                .where(models.ExerciseAttempt.created_at >= start_24h)
                .where(models.ExerciseAttempt.status.in_(["passed", "submitted"]))
            )
        )
        or 0
    )
    failed_attempts_last_24h = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.ExerciseAttempt)
                .where(models.ExerciseAttempt.created_at >= start_24h)
                .where(models.ExerciseAttempt.status == "failed")
            )
        )
        or 0
    )
    unique_visits_24h = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.SiteVisit)
                .where(models.SiteVisit.first_seen_at >= start_24h)
            )
        )
        or 0
    )
    visits_last_24h = unique_visits_24h
    active_users_24h = int(
        (
            await db.scalar(
                select(func.count(func.distinct(UserSession.user_id)))
                .select_from(UserSession)
                .where(UserSession.login_time >= start_24h)
            )
        )
        or 0
    )
    new_users_24h = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(User)
                .where(User.created_at >= start_24h)
            )
        )
        or 0
    )
    badges_awarded = int((await db.scalar(select(func.count()).select_from(models.UserBadge))) or 0)

    completion_rate = int(round((exercises_solved / total_progress_records) * 100)) if total_progress_records else 0
    quiz_pass_rate = int(round((quiz_passes / quiz_completions) * 100)) if quiz_completions else 0

    day_dates = [(now - timedelta(days=offset)).date() for offset in range(6, -1, -1)]
    day_keys = [day.isoformat() for day in day_dates]
    activity_by_day = {
        key: {"date": key, "exercise_attempts": 0, "passed_attempts": 0, "quiz_completions": 0, "xp": 0, "sessions": 0, "unique_visits": 0, "active_users": 0, "new_users": 0}
        for key in day_keys
    }

    attempt_activity = await db.execute(
        select(models.ExerciseAttempt.created_at, models.ExerciseAttempt.status)
        .where(models.ExerciseAttempt.created_at >= start_7d)
    )
    for row in attempt_activity.all():
        if not row.created_at:
            continue
        key = row.created_at.date().isoformat()
        if key in activity_by_day:
            activity_by_day[key]["exercise_attempts"] += 1
            if row.status in {"passed", "submitted"}:
                activity_by_day[key]["passed_attempts"] += 1

    quiz_activity = await db.execute(
        select(models.QuizAttempt.completed_at)
        .where(models.QuizAttempt.completed_at.is_not(None))
        .where(models.QuizAttempt.completed_at >= start_7d)
    )
    for row in quiz_activity.all():
        key = row.completed_at.date().isoformat()
        if key in activity_by_day:
            activity_by_day[key]["quiz_completions"] += 1

    xp_activity = await db.execute(
        select(models.XpEvent.created_at, models.XpEvent.points)
        .where(models.XpEvent.created_at >= start_7d)
    )
    for row in xp_activity.all():
        key = row.created_at.date().isoformat()
        if key in activity_by_day:
            activity_by_day[key]["xp"] += int(row.points or 0)

    visit_activity = await db.execute(
        select(models.SiteVisit.visit_date, func.count().label("visit_count"))
        .where(models.SiteVisit.visit_date.in_(day_dates))
        .group_by(models.SiteVisit.visit_date)
    )
    for row in visit_activity.all():
        if not row.visit_date:
            continue
        key = row.visit_date.isoformat()
        if key in activity_by_day:
            activity_by_day[key]["sessions"] = int(row.visit_count or 0)
            activity_by_day[key]["unique_visits"] = int(row.visit_count or 0)

    login_activity = await db.execute(
        select(func.date(UserSession.login_time).label("login_date"), func.count(func.distinct(UserSession.user_id)).label("user_count"))
        .where(UserSession.login_time >= start_7d)
        .group_by(func.date(UserSession.login_time))
    )
    for row in login_activity.all():
        if not row.login_date:
            continue
        key = row.login_date.isoformat() if hasattr(row.login_date, "isoformat") else str(row.login_date)
        if key in activity_by_day:
            activity_by_day[key]["active_users"] = int(row.user_count or 0)

    user_activity = await db.execute(
        select(User.created_at)
        .where(User.created_at >= start_7d)
    )
    for row in user_activity.all():
        if not row.created_at:
            continue
        key = row.created_at.date().isoformat()
        if key in activity_by_day:
            activity_by_day[key]["new_users"] += 1

    xp_total_label = func.coalesce(func.sum(models.XpEvent.points), 0).label("total_xp")
    top_rows = await db.execute(
        select(User.id, User.username, User.first_name, User.last_name, User.avatar, xp_total_label)
        .join(models.XpEvent, models.XpEvent.user_id == User.id)
        .group_by(User.id, User.username, User.first_name, User.last_name, User.avatar)
        .order_by(xp_total_label.desc(), User.id.asc())
        .limit(5)
    )
    top_learners = []
    for row in top_rows.all():
        completed_count = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.UserExerciseProgress)
                    .where(models.UserExerciseProgress.user_id == row.id)
                    .where(models.UserExerciseProgress.status == "completed")
                )
            )
            or 0
        )
        display_name = " ".join(part for part in [row.first_name, row.last_name] if part).strip() or row.username
        top_learners.append(
            {
                "user_id": row.id,
                "username": row.username,
                "display_name": display_name,
                "avatar_url": row.avatar,
                "total_xp": int(row.total_xp or 0),
                "completed_exercises": completed_count,
            }
        )

    recent_users_rows = (
        await db.scalars(
            select(User)
            .order_by(User.created_at.desc())
            .limit(5)
        )
    ).all()
    recent_users = [
        {
            "user_id": user.id,
            "username": user.username,
            "display_name": " ".join(part for part in [user.first_name, user.last_name] if part).strip() or user.username,
            "avatar_url": user.avatar,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        for user in recent_users_rows
    ]

    track_rows = (
        await db.scalars(
            select(models.Track)
            .options(selectinload(models.Track.sections).selectinload(models.Section.exercises))
            .order_by(models.Track.order)
            .limit(6)
        )
    ).all()
    track_performance = []
    for track in track_rows:
        track_total_exercises = sum(len(section.exercises or []) for section in track.sections or [])
        enrolled = int(
            (
                await db.scalar(
                    select(func.count(func.distinct(models.UserTrackProgress.user_id)))
                    .where(models.UserTrackProgress.track_id == track.id)
                )
            )
            or 0
        )
        completed_tracks = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.UserTrackProgress)
                    .where(models.UserTrackProgress.track_id == track.id)
                    .where(models.UserTrackProgress.status == "completed")
                )
            )
            or 0
        )
        completed_exercise_progress = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.UserExerciseProgress)
                    .where(models.UserExerciseProgress.track_id == track.id)
                    .where(models.UserExerciseProgress.status == "completed")
                )
            )
            or 0
        )
        possible_completions = enrolled * track_total_exercises
        progress_rate = int(round((completed_exercise_progress / possible_completions) * 100)) if possible_completions else 0
        track_performance.append(
            {
                "track_id": track.id,
                "title": track.title,
                "is_published": bool(track.is_published),
                "enrolled": enrolled,
                "completed_tracks": completed_tracks,
                "completed_exercises": completed_exercise_progress,
                "total_exercises": track_total_exercises,
                "progress_rate": progress_rate,
            }
        )

    mode_rows = await db.execute(
        select(models.ExerciseAttempt.mode, func.count().label("item_count"))
        .where(models.ExerciseAttempt.created_at >= start_30d)
        .group_by(models.ExerciseAttempt.mode)
        .order_by(func.count().desc())
    )
    mode_breakdown = [
        {"mode": row.mode or "unknown", "count": int(row.item_count or 0), "source": "attempts_30d"}
        for row in mode_rows.all()
    ]
    if not mode_breakdown:
        content_mode_rows = await db.execute(
            select(models.Exercise.mode, func.count().label("item_count"))
            .group_by(models.Exercise.mode)
            .order_by(func.count().desc())
        )
        mode_breakdown = [
            {"mode": row.mode or "unknown", "count": int(row.item_count or 0), "source": "content"}
            for row in content_mode_rows.all()
        ]

    top_entry_rows = await db.execute(
        select(models.SiteVisit.first_path, func.count().label("visit_count"))
        .where(models.SiteVisit.visit_date.in_(day_dates))
        .where(models.SiteVisit.first_path.is_not(None))
        .group_by(models.SiteVisit.first_path)
        .order_by(func.count().desc(), models.SiteVisit.first_path.asc())
        .limit(5)
    )
    top_entry_paths = [
        {"path": row.first_path or "/", "visits": int(row.visit_count or 0)}
        for row in top_entry_rows.all()
    ]

    judge_health = "unknown"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{JUDGE_URL}/health")
            judge_health = "healthy" if response.status_code == 200 else "degraded"
    except Exception:
        judge_health = "unreachable"
    return schemas.AdminDashboardStats(
        total_users=total_users,
        active_learners=active_learners,
        exercises_solved=exercises_solved,
        quiz_completions=quiz_completions,
        pending_content=pending_content,
        leaderboard_health="ready",
        judge_health=judge_health,
        api_health="healthy",
        database_health="healthy",
        total_tracks=total_tracks,
        published_tracks=published_tracks,
        total_sections=total_sections,
        total_exercises=total_exercises,
        published_exercises=published_exercises,
        draft_exercises=draft_exercises,
        total_xp=total_xp,
        xp_last_7_days=xp_last_7_days,
        xp_awarded_24h=xp_awarded_24h,
        attempts_last_24h=attempts_last_24h,
        passed_attempts_last_24h=passed_attempts_last_24h,
        failed_attempts_last_24h=failed_attempts_last_24h,
        visits_last_24h=visits_last_24h,
        unique_visits_24h=unique_visits_24h,
        active_users_24h=active_users_24h,
        new_users_24h=new_users_24h,
        badges_awarded=badges_awarded,
        completion_rate=completion_rate,
        quiz_pass_rate=quiz_pass_rate,
        activity_by_day=list(activity_by_day.values()),
        visit_activity_by_day=[
            {"date": item["date"], "unique_visits": item["unique_visits"], "visits": item["unique_visits"]}
            for item in activity_by_day.values()
        ],
        top_entry_paths=top_entry_paths,
        top_learners=top_learners,
        recent_users=recent_users,
        track_performance=track_performance,
        mode_breakdown=mode_breakdown,
    )


@router.get("/api/admin/learning-engine/health", response_model=schemas.AdminEngineHealthResponse)
async def get_admin_learning_engine_health(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> schemas.AdminEngineHealthResponse:
    draft_exercises = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.Exercise)
                .where(models.Exercise.is_published == False)
            )
        )
        or 0
    )
    exercises_without_files = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(models.Exercise)
                .outerjoin(models.ExerciseFile, models.ExerciseFile.exercise_id == models.Exercise.id)
                .where(models.Exercise.mode.in_(["code", "multi_file_code", "frontend_preview", "project"]))
                .where(models.ExerciseFile.id.is_(None))
            )
        )
        or 0
    )
    content_health = "ready" if draft_exercises == 0 and exercises_without_files == 0 else "needs_review"

    judge_health = "unknown"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{JUDGE_URL}/health")
            judge_health = "healthy" if response.status_code == 200 else "degraded"
    except Exception:
        judge_health = "unreachable"

    attempts = await db.execute(
        select(
            models.ExerciseAttempt.id,
            models.ExerciseAttempt.status,
            models.ExerciseAttempt.mode,
            models.ExerciseAttempt.tests_passed,
            models.ExerciseAttempt.tests_total,
            models.ExerciseAttempt.created_at,
            models.Exercise.title,
            User.username,
        )
        .join(models.Exercise, models.Exercise.id == models.ExerciseAttempt.exercise_id)
        .join(User, User.id == models.ExerciseAttempt.user_id)
        .order_by(models.ExerciseAttempt.created_at.desc())
        .limit(12)
    )
    recent_attempts = [
        {
            "id": row.id,
            "status": row.status,
            "mode": row.mode,
            "tests_passed": row.tests_passed,
            "tests_total": row.tests_total,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "exercise_title": row.title,
            "username": row.username,
        }
        for row in attempts.all()
    ]

    return schemas.AdminEngineHealthResponse(
        content_health=content_health,
        judge_health=judge_health,
        leaderboard_health="ready",
        recent_attempts=recent_attempts,
    )
