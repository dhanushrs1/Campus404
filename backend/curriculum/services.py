"""
curriculum/services.py — Campus404 (updated)
Business logic for Labs, Modules, ChallengeGroups, Levels, and files.
"""
from pathlib import Path
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, Request

from . import models, schemas

UPLOADS_ROOT = Path("/app/uploads")
MAX_FILES_PER_CHALLENGE = 5


def build_image_url(request: Request, relative_path: Optional[str]) -> Optional[str]:
    if not relative_path:
        return None
    base = str(request.base_url).rstrip("/")
    return f"{base}/uploads/{relative_path}"


def _safe_delete_image(relative_path: Optional[str]) -> None:
    if not relative_path:
        return
    target = (UPLOADS_ROOT / relative_path).resolve()
    if not str(target).startswith(str(UPLOADS_ROOT.resolve())):
        return
    if target.exists() and target.is_file():
        target.unlink()
    parent = target.parent
    while parent != UPLOADS_ROOT.resolve():
        try:
            if not any(parent.iterdir()):
                parent.rmdir()
            else:
                break
        except (OSError, StopIteration):
            break
        parent = parent.parent


def _lab_to_response(db: Session, request: Request, lab: models.Lab) -> schemas.LabResponse:
    return schemas.LabResponse(
        id=lab.id,
        title=lab.title,
        slug=lab.slug,
        description=lab.description,
        banner_image_path=lab.banner_image_path,
        hero_image_url=lab.hero_image_url,
        banner_url=build_image_url(request, lab.banner_image_path),
        language_id=lab.language_id,
        is_published=lab.is_published,
        total_xp=models.compute_lab_total_xp(db, lab.id),
        module_count=len(lab.modules),
        created_at=lab.created_at,
    )


def _module_to_response(db: Session, request: Request, module: models.Module) -> schemas.ModuleResponse:
    return schemas.ModuleResponse(
        id=module.id,
        unique_id=module.unique_id,
        slug=module.slug,
        lab_id=module.lab_id,
        title=module.title,
        description=module.description,
        guide_id=module.guide.id if module.guide else None,
        guide_title=module.guide.title if module.guide else None,
        guide_slug=module.guide.slug if module.guide else None,
        banner_image_path=module.banner_image_path,
        banner_url=build_image_url(request, module.banner_image_path),
        order_index=module.order_index,
        challenge_count=len(module.challenges),
        total_xp=sum(c.xp_reward for c in module.challenges),
        created_at=module.created_at,
    )


def _file_to_response(f: models.ChallengeFile) -> schemas.ChallengeFileResponse:
    return schemas.ChallengeFileResponse(
        id=f.id,
        challenge_id=f.challenge_id,
        filename=f.filename,
        content=f.content,
        is_main=f.is_main,
        order_index=f.order_index,
    )


def _challenge_to_response(challenge: models.Challenge) -> schemas.ChallengeResponse:
    if challenge.challenge_type == models.CHALLENGE_TYPE_EXAM:
        display_title = challenge.custom_title or "Module Exam"
    else:
        display_title = challenge.custom_title or f"Level {challenge.level_number}"

    return schemas.ChallengeResponse(
        id=challenge.id,
        module_id=challenge.module_id,
        challenge_group_id=challenge.challenge_group_id,
        level_number=challenge.level_number,
        challenge_type=challenge.challenge_type,
        custom_title=challenge.custom_title,
        display_title=display_title,
        xp_reward=challenge.xp_reward,
        expected_output=challenge.expected_output,
        content_html=challenge.content_html,
        is_published=challenge.is_published,
        files=[_file_to_response(f) for f in challenge.files],
        created_at=challenge.created_at,
        updated_at=challenge.updated_at,
    )


def _level_to_response(level: models.Challenge) -> schemas.LevelResponse:
    if level.challenge_type == models.CHALLENGE_TYPE_EXAM:
        display_title = level.custom_title or "Module Exam"
    else:
        display_title = level.custom_title or f"Level {level.level_number}"

    return schemas.LevelResponse(
        id=level.id,
        module_id=level.module_id,
        challenge_group_id=level.challenge_group_id,
        level_number=level.level_number,
        challenge_type=level.challenge_type,
        custom_title=level.custom_title,
        display_title=display_title,
        xp_reward=level.xp_reward,
        expected_output=level.expected_output,
        content_html=level.content_html,
        is_published=level.is_published,
        files=[_file_to_response(f) for f in level.files],
        created_at=level.created_at,
        updated_at=level.updated_at,
    )


def _challenge_group_to_response(group: models.ChallengeGroup) -> schemas.ChallengeGroupResponse:
    levels = list(group.levels or [])
    return schemas.ChallengeGroupResponse(
        id=group.id,
        module_id=group.module_id,
        title=group.title,
        description=group.description,
        order_index=group.order_index,
        is_published=group.is_published,
        level_count=len(levels),
        total_xp=int(sum(level.xp_reward for level in levels)),
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def _get_or_create_default_group(db: Session, module_id: int) -> models.ChallengeGroup:
    group = (
        db.query(models.ChallengeGroup)
        .filter(models.ChallengeGroup.module_id == module_id)
        .order_by(models.ChallengeGroup.order_index, models.ChallengeGroup.id)
        .first()
    )
    if group:
        return group

    group = models.ChallengeGroup(
        module_id=module_id,
        title="General Practice",
        description="Auto-created default challenge group.",
        order_index=0,
        is_published=True,
    )
    db.add(group)
    db.flush()
    return group


def _validate_guide_link(db: Session, guide_id: Optional[int], current_module_id: Optional[int] = None) -> None:
    if guide_id is None:
        return

    # Imported lazily to avoid circular imports at module import-time.
    from guide.models import GuidePage

    guide = db.query(GuidePage).filter(GuidePage.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail=f"Guide {guide_id} not found.")

    if guide.module_id is not None and guide.module_id != current_module_id:
        existing_module = db.query(models.Module).filter(models.Module.id == guide.module_id).first()
        existing_title = existing_module.title if existing_module else f"#{guide.module_id}"
        raise HTTPException(
            status_code=409,
            detail=f"Guide {guide_id} is already assigned to module '{existing_title}'.",
        )


# ── LAB ───────────────────────────────────────────────────────────────────────
def create_lab(db: Session, request: Request, data: schemas.LabCreate) -> schemas.LabResponse:
    if db.query(models.Lab).filter(models.Lab.slug == data.slug).first():
        raise HTTPException(status_code=409, detail=f"Slug '{data.slug}' is already in use.")
    lab = models.Lab(**data.model_dump())
    db.add(lab)
    db.commit()
    db.refresh(lab)
    return _lab_to_response(db, request, lab)


def get_labs(db, request, language_id=None, published_only=False, skip=0, limit=50):
    q = db.query(models.Lab)
    if published_only:
        q = q.filter(models.Lab.is_published == True)
    if language_id:
        q = q.filter(models.Lab.language_id == language_id)
    total = q.count()
    labs = q.order_by(models.Lab.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_lab_to_response(db, request, lab) for lab in labs]}


def get_lab(db, request, lab_id):
    lab = db.query(models.Lab).filter(models.Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")
    return _lab_to_response(db, request, lab)


def update_lab(db, request, lab_id, data):
    lab = db.query(models.Lab).filter(models.Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")
    update_data = data.model_dump(exclude_unset=True)
    if "banner_image_path" in update_data and update_data["banner_image_path"] != lab.banner_image_path:
        _safe_delete_image(lab.banner_image_path)
    for field, value in update_data.items():
        setattr(lab, field, value)
    db.commit()
    db.refresh(lab)
    return _lab_to_response(db, request, lab)


def delete_lab(db, lab_id):
    lab = db.query(models.Lab).filter(models.Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")
    _safe_delete_image(lab.banner_image_path)
    db.delete(lab)
    db.commit()
    return {"message": f"Lab '{lab.title}' deleted.", "id": lab_id}


# ── MODULE ────────────────────────────────────────────────────────────────────
def create_module(db, request, data):
    if not db.query(models.Lab).filter(models.Lab.id == data.lab_id).first():
        raise HTTPException(status_code=404, detail=f"Lab {data.lab_id} not found.")

    _validate_guide_link(db, data.guide_id)

    # Generate a unique 4-char ID; retry up to 10 times on collision
    for _ in range(10):
        uid = models._gen_uid(4)
        if not db.query(models.Module).filter(models.Module.unique_id == uid).first():
            break

    # Build slug: "module-title-uid"
    from re import sub
    base_slug = sub(r'[^a-z0-9-]+', '-', data.title.lower()).strip('-')
    slug = f"{base_slug}-{uid}"

    module_data = data.model_dump(exclude={"guide_id"})
    module = models.Module(**module_data, unique_id=uid, slug=slug)
    db.add(module)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Module title or guide assignment conflicts with an existing record.")

    if data.guide_id is not None:
        from guide.models import GuidePage

        guide = db.query(GuidePage).filter(GuidePage.id == data.guide_id).first()
        if guide:
            guide.module_id = module.id
            db.commit()

    db.refresh(module)
    return _module_to_response(db, request, module)


def get_modules(db, request, lab_id):
    return [_module_to_response(db, request, m) for m in
            db.query(models.Module).filter(models.Module.lab_id == lab_id)
            .order_by(models.Module.order_index).all()]


def get_module(db, request, module_id):
    m = db.query(models.Module).filter(models.Module.id == module_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Module not found.")
    return _module_to_response(db, request, m)


def update_module(db, request, module_id, data):
    m = db.query(models.Module).filter(models.Module.id == module_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Module not found.")

    update_data = data.model_dump(exclude_unset=True)

    guide_id_provided = "guide_id" in update_data
    new_guide_id = update_data.pop("guide_id", None)

    if guide_id_provided:
        _validate_guide_link(db, new_guide_id, current_module_id=module_id)

    if "banner_image_path" in update_data and update_data["banner_image_path"] != m.banner_image_path:
        _safe_delete_image(m.banner_image_path)
    for field, value in update_data.items():
        setattr(m, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Module update conflicts with an existing record.")

    if guide_id_provided:
        from guide.models import GuidePage

        current = db.query(GuidePage).filter(GuidePage.module_id == module_id).first()
        if current and (new_guide_id is None or current.id != new_guide_id):
            current.module_id = None

        if new_guide_id is not None:
            target = db.query(GuidePage).filter(GuidePage.id == new_guide_id).first()
            if target:
                target.module_id = module_id

        db.commit()

    db.refresh(m)
    return _module_to_response(db, request, m)


def delete_module(db, module_id):
    m = db.query(models.Module).filter(models.Module.id == module_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Module not found.")
    _safe_delete_image(m.banner_image_path)
    db.delete(m)
    db.commit()
    return {"message": f"Module '{m.title}' deleted.", "id": module_id}


# ── CHALLENGE GROUP (Concept) ────────────────────────────────────────────────
def create_challenge_group(db: Session, data: schemas.ChallengeGroupCreate):
    module = db.query(models.Module).filter(models.Module.id == data.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail=f"Module {data.module_id} not found.")

    next_order = (
        db.query(func.count(models.ChallengeGroup.id))
        .filter(models.ChallengeGroup.module_id == data.module_id)
        .scalar()
    ) or 0

    payload = data.model_dump()
    payload["order_index"] = int(next_order)

    group = models.ChallengeGroup(**payload)
    db.add(group)
    db.commit()
    db.refresh(group)
    return _challenge_group_to_response(group)


def get_challenge_groups(db: Session, module_id: int):
    return [
        _challenge_group_to_response(group)
        for group in db.query(models.ChallengeGroup)
        .filter(models.ChallengeGroup.module_id == module_id)
        .order_by(models.ChallengeGroup.order_index, models.ChallengeGroup.id)
        .all()
    ]


def get_challenge_group(db: Session, challenge_group_id: int):
    group = db.query(models.ChallengeGroup).filter(models.ChallengeGroup.id == challenge_group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Challenge group not found.")
    return _challenge_group_to_response(group)


def update_challenge_group(db: Session, challenge_group_id: int, data: schemas.ChallengeGroupUpdate):
    group = db.query(models.ChallengeGroup).filter(models.ChallengeGroup.id == challenge_group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Challenge group not found.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    db.commit()
    db.refresh(group)
    return _challenge_group_to_response(group)


def delete_challenge_group(db: Session, challenge_group_id: int):
    group = db.query(models.ChallengeGroup).filter(models.ChallengeGroup.id == challenge_group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Challenge group not found.")

    module_id, deleted_order = group.module_id, group.order_index
    db.delete(group)
    db.commit()

    remaining = (
        db.query(models.ChallengeGroup)
        .filter(
            models.ChallengeGroup.module_id == module_id,
            models.ChallengeGroup.order_index > deleted_order,
        )
        .order_by(models.ChallengeGroup.order_index)
        .all()
    )
    for row in remaining:
        row.order_index -= 1
    db.commit()
    return {"message": "Challenge group deleted.", "id": challenge_group_id}


# ── LEVEL (legacy Challenge-compatible) ──────────────────────────────────────
def _next_level_number(db, module_id):
    max_level = (
        db.query(func.max(models.Challenge.level_number))
        .filter(models.Challenge.module_id == module_id)
        .scalar()
    )
    return 1 if max_level is None else max_level + 1


def _create_level_record(
    db: Session,
    module_id: int,
    challenge_group_id: int,
    challenge_type: str,
    custom_title: Optional[str],
    xp_reward: int,
    expected_output: Optional[str],
    content_html: str,
    is_published: bool,
    files_data: List[schemas.ChallengeFileCreate],
):
    if challenge_type == models.CHALLENGE_TYPE_EXAM and xp_reward > 100:
        raise HTTPException(status_code=422, detail="Module exam XP cannot exceed 100.")

    existing_exam = (
        db.query(models.Challenge)
        .filter(
            models.Challenge.module_id == module_id,
            models.Challenge.challenge_type == models.CHALLENGE_TYPE_EXAM,
        )
        .first()
    )
    if challenge_type == models.CHALLENGE_TYPE_EXAM and existing_exam:
        raise HTTPException(status_code=409, detail="This module already has a final exam level.")

    if challenge_type == models.CHALLENGE_TYPE_LEVEL and existing_exam:
        raise HTTPException(
            status_code=409,
            detail="Cannot add standard levels after a final exam. Remove or convert the exam first.",
        )

    challenge = models.Challenge(
        module_id=module_id,
        challenge_group_id=challenge_group_id,
        level_number=_next_level_number(db, module_id),
        challenge_type=challenge_type,
        custom_title=custom_title,
        xp_reward=xp_reward,
        expected_output=expected_output,
        content_html=content_html,
        is_published=is_published,
    )
    db.add(challenge)
    db.flush()

    if len(files_data) > MAX_FILES_PER_CHALLENGE:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES_PER_CHALLENGE} files per challenge.")

    if files_data and not any(f.is_main for f in files_data):
        files_data[0].is_main = True

    for i, fd in enumerate(files_data or []):
        db.add(
            models.ChallengeFile(
                challenge_id=challenge.id,
                filename=fd.filename,
                content=fd.content,
                is_main=fd.is_main,
                order_index=i,
            )
        )

    db.commit()
    db.refresh(challenge)
    return challenge


def create_challenge(db, data: schemas.ChallengeCreate):
    module = db.query(models.Module).filter(models.Module.id == data.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail=f"Module {data.module_id} not found.")

    group_id = data.challenge_group_id
    if group_id:
        group = db.query(models.ChallengeGroup).filter(models.ChallengeGroup.id == group_id).first()
        if not group or group.module_id != data.module_id:
            raise HTTPException(status_code=404, detail="Challenge group not found for this module.")
    else:
        group = _get_or_create_default_group(db, data.module_id)
        group_id = group.id

    challenge = _create_level_record(
        db=db,
        module_id=data.module_id,
        challenge_group_id=group_id,
        challenge_type=data.challenge_type,
        custom_title=data.custom_title,
        xp_reward=data.xp_reward,
        expected_output=data.expected_output,
        content_html=data.content_html,
        is_published=data.is_published,
        files_data=data.files,
    )
    return _challenge_to_response(challenge)


def get_challenges(db, module_id):
    return [
        _challenge_to_response(c)
        for c in db.query(models.Challenge)
        .filter(models.Challenge.module_id == module_id)
        .order_by(models.Challenge.level_number, models.Challenge.id)
        .all()
    ]


def get_challenge(db, challenge_id):
    c = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found.")
    return _challenge_to_response(c)


def update_challenge(db, challenge_id, data):
    c = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    update_data = data.model_dump(exclude_unset=True)
    next_type = update_data.get("challenge_type", c.challenge_type)
    next_xp = update_data.get("xp_reward", c.xp_reward)

    if next_type == models.CHALLENGE_TYPE_EXAM and next_xp > 100:
        raise HTTPException(status_code=422, detail="Module exam XP cannot exceed 100.")

    if next_type == models.CHALLENGE_TYPE_EXAM:
        existing_exam = (
            db.query(models.Challenge)
            .filter(
                models.Challenge.module_id == c.module_id,
                models.Challenge.challenge_type == models.CHALLENGE_TYPE_EXAM,
                models.Challenge.id != c.id,
            )
            .first()
        )
        if existing_exam:
            raise HTTPException(status_code=409, detail="This module already has a final exam level.")

    if next_type == models.CHALLENGE_TYPE_LEVEL:
        existing_exam = (
            db.query(models.Challenge)
            .filter(
                models.Challenge.module_id == c.module_id,
                models.Challenge.challenge_type == models.CHALLENGE_TYPE_EXAM,
                models.Challenge.id != c.id,
            )
            .first()
        )
        if existing_exam and c.level_number > existing_exam.level_number:
            raise HTTPException(
                status_code=409,
                detail="Standard levels cannot be placed after a final exam.",
            )

    for field, value in update_data.items():
        setattr(c, field, value)

    if c.challenge_type == models.CHALLENGE_TYPE_EXAM:
        max_level = (
            db.query(func.max(models.Challenge.level_number))
            .filter(models.Challenge.module_id == c.module_id)
            .scalar()
        )
        if max_level and c.level_number != max_level:
            trailing = (
                db.query(models.Challenge)
                .filter(
                    models.Challenge.module_id == c.module_id,
                    models.Challenge.level_number > c.level_number,
                )
                .order_by(models.Challenge.level_number)
                .all()
            )
            for row in trailing:
                row.level_number -= 1
            c.level_number = max_level

    db.commit()
    db.refresh(c)
    return _challenge_to_response(c)


def delete_challenge(db, challenge_id):
    c = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found.")
    module_id, deleted_level = c.module_id, c.level_number
    db.delete(c)
    db.commit()

    remaining = (
        db.query(models.Challenge)
        .filter(
            models.Challenge.module_id == module_id,
            models.Challenge.level_number > deleted_level,
        )
        .order_by(models.Challenge.level_number)
        .all()
    )
    for ch in remaining:
        ch.level_number -= 1
    db.commit()
    return {"message": "Challenge deleted and levels re-numbered.", "id": challenge_id}


def create_level(db: Session, data: schemas.LevelCreate):
    group = db.query(models.ChallengeGroup).filter(models.ChallengeGroup.id == data.challenge_group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail=f"Challenge group {data.challenge_group_id} not found.")

    level = _create_level_record(
        db=db,
        module_id=group.module_id,
        challenge_group_id=group.id,
        challenge_type=data.challenge_type,
        custom_title=data.custom_title,
        xp_reward=data.xp_reward,
        expected_output=data.expected_output,
        content_html=data.content_html,
        is_published=data.is_published,
        files_data=data.files,
    )
    return _level_to_response(level)


def get_levels(db: Session, challenge_group_id: int):
    return [
        _level_to_response(level)
        for level in db.query(models.Challenge)
        .filter(models.Challenge.challenge_group_id == challenge_group_id)
        .order_by(models.Challenge.level_number, models.Challenge.id)
        .all()
    ]


def get_level(db: Session, level_id: int):
    level = db.query(models.Challenge).filter(models.Challenge.id == level_id).first()
    if not level:
        raise HTTPException(status_code=404, detail="Level not found.")
    return _level_to_response(level)


def update_level(db: Session, level_id: int, data: schemas.LevelUpdate):
    challenge_like = update_challenge(db, level_id, data)
    level = db.query(models.Challenge).filter(models.Challenge.id == challenge_like.id).first()
    return _level_to_response(level)


def delete_level(db: Session, level_id: int):
    return delete_challenge(db, level_id)


# ── CHALLENGE FILE ─────────────────────────────────────────────────────────────
def upsert_challenge_files(db, challenge_id: int, files: List[schemas.ChallengeFileCreate]):
    """
    Replace all files for a challenge. Enforces max 5 files and exactly one is_main.
    """
    if len(files) > MAX_FILES_PER_CHALLENGE:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES_PER_CHALLENGE} files per challenge.")
    c = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    # Delete existing files
    db.query(models.ChallengeFile).filter(models.ChallengeFile.challenge_id == challenge_id).delete()

    if not files:
        db.commit()
        return []

    # If no file is marked as main, mark first
    if not any(f.is_main for f in files):
        files[0].is_main = True

    created = []
    for i, fd in enumerate(files):
        f = models.ChallengeFile(
            challenge_id=challenge_id,
            filename=fd.filename,
            content=fd.content,
            is_main=fd.is_main,
            order_index=i,
        )
        db.add(f)
        db.flush()
        created.append(_file_to_response(f))

    db.commit()
    return created


def upsert_level_files(db: Session, level_id: int, files: List[schemas.ChallengeFileCreate]):
    return upsert_challenge_files(db, level_id, files)
