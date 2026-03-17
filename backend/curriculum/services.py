"""
curriculum/services.py — Campus404 (updated)
Business logic for Labs, Modules, Challenges, and ChallengeFiles.
"""
from pathlib import Path
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
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
    display_title = challenge.custom_title or f"Level {challenge.level_number}"
    return schemas.ChallengeResponse(
        id=challenge.id,
        module_id=challenge.module_id,
        level_number=challenge.level_number,
        custom_title=challenge.custom_title,
        display_title=display_title,
        xp_reward=challenge.xp_reward,
        content_html=challenge.content_html,
        is_published=challenge.is_published,
        files=[_file_to_response(f) for f in challenge.files],
        created_at=challenge.created_at,
        updated_at=challenge.updated_at,
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

    # Generate a unique 4-char ID; retry up to 10 times on collision
    for _ in range(10):
        uid = models._gen_uid(4)
        if not db.query(models.Module).filter(models.Module.unique_id == uid).first():
            break

    # Build slug: "module-title-uid"
    from re import sub
    base_slug = sub(r'[^a-z0-9-]+', '-', data.title.lower()).strip('-')
    slug = f"{base_slug}-{uid}"

    module_data = data.model_dump()
    module = models.Module(**module_data, unique_id=uid, slug=slug)
    db.add(module)
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
    if "banner_image_path" in update_data and update_data["banner_image_path"] != m.banner_image_path:
        _safe_delete_image(m.banner_image_path)
    for field, value in update_data.items():
        setattr(m, field, value)
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


# ── CHALLENGE ─────────────────────────────────────────────────────────────────
def _next_level_number(db, module_id):
    max_level = (
        db.query(func.max(models.Challenge.level_number))
        .filter(models.Challenge.module_id == module_id)
        .scalar()
    )
    return 1 if max_level is None else max_level + 1


def create_challenge(db, data: schemas.ChallengeCreate):
    if not db.query(models.Module).filter(models.Module.id == data.module_id).first():
        raise HTTPException(status_code=404, detail=f"Module {data.module_id} not found.")

    files_data = data.files
    challenge_data = data.model_dump(exclude={"files"})
    challenge = models.Challenge(
        **challenge_data,
        level_number=_next_level_number(db, data.module_id),
    )
    db.add(challenge)
    db.flush()  # get challenge.id before adding files

    # Handle files
    if not files_data:
        # Default single file based on lab language (caller should pass one)
        files_data = []

    if len(files_data) > MAX_FILES_PER_CHALLENGE:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES_PER_CHALLENGE} files per challenge.")

    # Ensure exactly one is_main
    if files_data and not any(f.is_main for f in files_data):
        files_data[0].is_main = True

    for i, fd in enumerate(files_data):
        f = models.ChallengeFile(
            challenge_id=challenge.id,
            filename=fd.filename,
            content=fd.content,
            is_main=fd.is_main,
            order_index=i,
        )
        db.add(f)

    db.commit()
    db.refresh(challenge)
    return _challenge_to_response(challenge)


def get_challenges(db, module_id):
    return [_challenge_to_response(c) for c in
            db.query(models.Challenge)
            .filter(models.Challenge.module_id == module_id)
            .order_by(models.Challenge.level_number).all()]


def get_challenge(db, challenge_id):
    c = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found.")
    return _challenge_to_response(c)


def update_challenge(db, challenge_id, data):
    c = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
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
    # Re-number remaining
    remaining = (
        db.query(models.Challenge)
        .filter(models.Challenge.module_id == module_id,
                models.Challenge.level_number > deleted_level)
        .order_by(models.Challenge.level_number).all()
    )
    for ch in remaining:
        ch.level_number -= 1
    db.commit()
    return {"message": "Challenge deleted and levels re-numbered.", "id": challenge_id}


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
