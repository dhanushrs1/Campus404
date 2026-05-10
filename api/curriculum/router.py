from __future__ import annotations

import asyncio
import httpx
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.database import get_db
from auth.jwt_utils import _decode
from auth.models import User
from curriculum import models, schemas
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


def _token_session_version(payload: dict[str, Any]) -> int:
    raw = payload.get("sv", 1)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 1
    return value if value > 0 else 1


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
        order=order_value
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

    track.sections.sort(key=lambda section: int(section.order or 0))
    for section in track.sections:
        section.exercises.sort(key=lambda exercise: int(exercise.order or 0))
        for exercise in section.exercises:
            exercise.total_tasks = len(exercise.tasks) if exercise.tasks else 0
            exercise.task_ids = [task.id for task in exercise.tasks] if exercise.tasks else []

    track.learner_count = 0
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
