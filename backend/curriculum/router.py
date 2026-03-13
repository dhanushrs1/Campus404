"""
curriculum/router.py — Campus404 (updated)
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.orm import Session

from database import get_db
from . import services, schemas

router = APIRouter()

SUPPORTED_LANGUAGES = [
    {"id": 71,  "name": "Python 3",          "extension": "py"},
    {"id": 63,  "name": "JavaScript (Node)", "extension": "js"},
    {"id": 62,  "name": "Java",              "extension": "java"},
    {"id": 54,  "name": "C++ (GCC 9.2)",    "extension": "cpp"},
    {"id": 50,  "name": "C (GCC 9.2)",      "extension": "c"},
    {"id": 60,  "name": "Go",               "extension": "go"},
    {"id": 72,  "name": "Ruby",             "extension": "rb"},
    {"id": 73,  "name": "Rust",             "extension": "rs"},
    {"id": 78,  "name": "Kotlin",           "extension": "kt"},
    {"id": 74,  "name": "TypeScript",       "extension": "ts"},
    {"id": 82,  "name": "SQL",              "extension": "sql"},
    {"id": 79,  "name": "Bash",             "extension": "sh"},
    {"id": 85,  "name": "Perl",             "extension": "pl"},
    {"id": 43,  "name": "Plain Text",       "extension": "txt"},
    {"id": 0,   "name": "HTML / CSS / JS",  "extension": "html"},
]

LANG_EXT = {l["id"]: l["extension"] for l in SUPPORTED_LANGUAGES}


@router.get("/languages", response_model=list[schemas.LanguageResponse])
def get_languages():
    return SUPPORTED_LANGUAGES


# ── LAB ──────────────────────────────────────────────────────────────────────
@router.post("/labs", response_model=schemas.LabResponse, status_code=201)
def create_lab(data: schemas.LabCreate, request: Request, db: Session = Depends(get_db)):
    return services.create_lab(db, request, data)


@router.get("/labs", response_model=dict)
def list_labs(
    request: Request,
    published_only: bool = Query(False),
    language_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return services.get_labs(db, request, language_id, published_only, skip, limit)


@router.get("/labs/{lab_id}", response_model=schemas.LabResponse)
def get_lab(lab_id: int, request: Request, db: Session = Depends(get_db)):
    return services.get_lab(db, request, lab_id)


@router.patch("/labs/{lab_id}", response_model=schemas.LabResponse)
def update_lab(lab_id: int, data: schemas.LabUpdate, request: Request, db: Session = Depends(get_db)):
    return services.update_lab(db, request, lab_id, data)


@router.delete("/labs/{lab_id}")
def delete_lab(lab_id: int, db: Session = Depends(get_db)):
    return services.delete_lab(db, lab_id)


# ── MODULE ───────────────────────────────────────────────────────────────────
@router.post("/modules", response_model=schemas.ModuleResponse, status_code=201)
def create_module(data: schemas.ModuleCreate, db: Session = Depends(get_db)):
    return services.create_module(db, data)


@router.get("/modules", response_model=list[schemas.ModuleResponse])
def list_modules(lab_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    return services.get_modules(db, lab_id)


@router.get("/modules/{module_id}", response_model=schemas.ModuleResponse)
def get_module(module_id: int, db: Session = Depends(get_db)):
    return services.get_module(db, module_id)


@router.patch("/modules/{module_id}", response_model=schemas.ModuleResponse)
def update_module(module_id: int, data: schemas.ModuleUpdate, db: Session = Depends(get_db)):
    return services.update_module(db, module_id, data)


@router.delete("/modules/{module_id}")
def delete_module(module_id: int, db: Session = Depends(get_db)):
    return services.delete_module(db, module_id)


# ── CHALLENGE ────────────────────────────────────────────────────────────────
@router.post("/challenges", response_model=schemas.ChallengeResponse, status_code=201)
def create_challenge(data: schemas.ChallengeCreate, db: Session = Depends(get_db)):
    return services.create_challenge(db, data)


@router.get("/challenges", response_model=list[schemas.ChallengeResponse])
def list_challenges(module_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    return services.get_challenges(db, module_id)


@router.get("/challenges/{challenge_id}", response_model=schemas.ChallengeResponse)
def get_challenge(challenge_id: int, db: Session = Depends(get_db)):
    return services.get_challenge(db, challenge_id)


@router.patch("/challenges/{challenge_id}", response_model=schemas.ChallengeResponse)
def update_challenge(challenge_id: int, data: schemas.ChallengeUpdate, db: Session = Depends(get_db)):
    return services.update_challenge(db, challenge_id, data)


@router.delete("/challenges/{challenge_id}")
def delete_challenge(challenge_id: int, db: Session = Depends(get_db)):
    return services.delete_challenge(db, challenge_id)


# ── CHALLENGE FILES (bulk replace) ────────────────────────────────────────────
@router.put("/challenges/{challenge_id}/files", response_model=list[schemas.ChallengeFileResponse])
def replace_challenge_files(
    challenge_id: int,
    files: list[schemas.ChallengeFileCreate],
    db: Session = Depends(get_db),
):
    """Replace all files for a challenge. Max 5 files. Exactly one must be the main file."""
    return services.upsert_challenge_files(db, challenge_id, files)
