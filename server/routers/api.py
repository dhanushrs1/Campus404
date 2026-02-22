"""
routers/api.py — Campus404
Public JSON API consumed by the React frontend.
NOTE: Browser calls /api/challenges → Nginx strips /api/ → FastAPI receives /challenges.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from database import get_db
from models import Challenge, Module, Lab

router = APIRouter()


class ChallengePublicResponse(BaseModel):
    """
    Safe public schema for Challenge data sent to the React frontend.
    CRITICAL: expected_output and official_solution are intentionally
    excluded to prevent students from cheating via the network tab.
    """
    id:                    int
    title:                 str
    module_id:             int
    order_number:          int
    description:           Optional[str] = None
    editor_file_name:      str
    instructions:          Optional[str] = None
    starter_code:          Optional[str] = None
    hint_text:             Optional[str] = None
    walkthrough_video_url: Optional[str] = None
    repo_link:             Optional[str] = None

    class Config:
        from_attributes = True


class ModulePublicResponse(BaseModel):
    id:           int
    title:        str
    lab_id:       int
    order_number: int
    description:  Optional[str] = None
    challenges:   List[ChallengePublicResponse] = []
    
    class Config:
        from_attributes = True


@router.get("/", summary="API health check")
def read_root():
    return {"message": "Campus404 Backend is Running!"}


@router.get("/challenges", response_model=List[ChallengePublicResponse])
def api_challenges(db: Session = Depends(get_db)):
    """Return all published challenges — safe for public consumption."""
    return (
        db.query(Challenge)
        .filter(Challenge.is_published == True)
        .order_by(Challenge.module_id, Challenge.order_number)
        .all()
    )


@router.get("/challenges/{challenge_id}", response_model=ChallengePublicResponse)
def api_challenge_detail(challenge_id: int, db: Session = Depends(get_db)):
    """Return a single published challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id, Challenge.is_published == True).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found or not published.")
    return challenge


@router.get("/labs/{lab_id}/modules", response_model=List[ModulePublicResponse])
def api_lab_modules(lab_id: int, db: Session = Depends(get_db)):
    """Return all modules and nested published challenges for a specific lab."""
    # Ensure lab exists
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")
        
    modules = (
        db.query(Module)
        .options(joinedload(Module.challenges))
        .filter(Module.lab_id == lab_id)
        .order_by(Module.order_number)
        .all()
    )
    
    result = []
    for mod in modules:
        pub_challenges = sorted(
            [c for c in mod.challenges if c.is_published],
            key=lambda c: c.order_number
        )
        mod_dict = {
            "id": mod.id,
            "title": mod.title,
            "lab_id": mod.lab_id,
            "order_number": mod.order_number,
            "description": mod.description,
            "challenges": pub_challenges
        }
        result.append(mod_dict)
        
    return result
