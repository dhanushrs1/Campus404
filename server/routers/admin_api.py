"""
routers/admin_api.py — Campus404
Backend Admin API for the React Challenge Builder.
"""
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from database import get_db
from models import Challenge, ChallengeFile, TestCase

router = APIRouter(prefix="/admin/challenges")

class ChallengeFileSchema(BaseModel):
    name: str
    language: str
    content: str
    is_entry_point: bool

class TestCaseSchema(BaseModel):
    input_data: str
    expected_output: str
    is_hidden: bool

class ChallengeCreateRequest(BaseModel):
    title: str
    module_id: int
    order_number: Optional[int] = None
    description: Optional[str] = None
    environment: str = "standard_script"
    content_blocks: List[Any] = []
    files: List[ChallengeFileSchema] = []
    test_cases: List[TestCaseSchema] = []
    xp_override: Optional[int] = None
    language_id: int = 71

class ChallengeFileResponse(ChallengeFileSchema):
    id: int
    challenge_id: int
    class Config:
        from_attributes = True

class TestCaseResponse(TestCaseSchema):
    id: int
    challenge_id: int
    class Config:
        from_attributes = True

class ChallengeResponse(ChallengeCreateRequest):
    id: int
    files: List[ChallengeFileResponse] = []
    test_cases: List[TestCaseResponse] = []
    class Config:
        from_attributes = True

@router.post("", response_model=ChallengeResponse)
def create_challenge(payload: ChallengeCreateRequest, db: Session = Depends(get_db)):
    order_num = payload.order_number
    if not order_num:
        max_order = db.query(func.max(Challenge.order_number)).filter(Challenge.module_id == payload.module_id).scalar()
        order_num = (max_order or 0) + 1

    challenge = Challenge(
        title=payload.title,
        module_id=payload.module_id,
        order_number=order_num,
        description=payload.description,
        environment=payload.environment,
        content_blocks=payload.content_blocks,
        is_published=False,
        xp_override=payload.xp_override,
        language_id=payload.language_id
    )
    db.add(challenge)
    db.flush() 
    
    for f in payload.files:
        cf = ChallengeFile(
            challenge_id=challenge.id,
            name=f.name,
            language=f.language,
            content=f.content,
            is_entry_point=f.is_entry_point
        )
        db.add(cf)
        
    for t in payload.test_cases:
        tc = TestCase(
            challenge_id=challenge.id,
            input_data=t.input_data,
            expected_output=t.expected_output,
            is_hidden=t.is_hidden
        )
        db.add(tc)
        
    db.commit()
    db.refresh(challenge)
    return challenge

@router.get("/{id}", response_model=ChallengeResponse)
def get_challenge(id: int, db: Session = Depends(get_db)):
    challenge = db.query(Challenge).options(
        joinedload(Challenge.files),
        joinedload(Challenge.test_cases)
    ).filter(Challenge.id == id).first()
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
        
    return challenge

@router.put("/{id}", response_model=ChallengeResponse)
def update_challenge(id: int, payload: ChallengeCreateRequest, db: Session = Depends(get_db)):
    challenge = db.query(Challenge).filter(Challenge.id == id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
        
    challenge.title = payload.title
    challenge.module_id = payload.module_id
    if payload.order_number is not None:
        challenge.order_number = payload.order_number
    challenge.description = payload.description
    challenge.environment = payload.environment
    challenge.content_blocks = payload.content_blocks
    challenge.xp_override = payload.xp_override
    challenge.language_id = payload.language_id
    
    # Replace files: delete old ones, add new ones
    db.query(ChallengeFile).filter(ChallengeFile.challenge_id == challenge.id).delete()
    for f in payload.files:
        db.add(ChallengeFile(
            challenge_id=challenge.id,
            name=f.name,
            language=f.language,
            content=f.content,
            is_entry_point=f.is_entry_point
        ))
        
    # Replace test cases: delete old ones, add new ones
    db.query(TestCase).filter(TestCase.challenge_id == challenge.id).delete()
    for t in payload.test_cases:
        db.add(TestCase(
            challenge_id=challenge.id,
            input_data=t.input_data,
            expected_output=t.expected_output,
            is_hidden=t.is_hidden
        ))
        
    db.commit()
    db.refresh(challenge)
    return challenge
