"""
routers/api.py — Campus404
Public JSON API consumed by the React frontend.
NOTE: Browser calls /api/levels → Nginx strips /api/ → FastAPI receives /levels.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Level

router = APIRouter()


class LevelPublicResponse(BaseModel):
    """
    Safe public schema for Level data sent to the React frontend.
    CRITICAL: expected_output and official_solution are intentionally
    excluded to prevent students from cheating via the network tab.
    """
    id:           int
    title:        str
    lab_id:       int
    order_number: int
    broken_code:  Optional[str] = None
    hint_text:    Optional[str] = None
    repo_link:    Optional[str] = None

    class Config:
        from_attributes = True  # enables ORM mode (SQLAlchemy → Pydantic)


@router.get("/", summary="API health check")
def read_root():
    return {"message": "Campus404 Backend is Running!"}


@router.get("/levels", response_model=List[LevelPublicResponse])
def api_levels(db: Session = Depends(get_db)):
    """Return all published levels — safe for public consumption."""
    return (
        db.query(Level)
        .filter(Level.is_published == True)
        .order_by(Level.lab_id, Level.order_number)
        .all()
    )
