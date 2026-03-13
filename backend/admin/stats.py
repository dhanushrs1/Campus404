"""
admin/stats.py — Campus404
Admin dashboard statistics endpoint.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter()

@router.get("")
async def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.User).count()
    admins  = db.query(models.User).filter(models.User.is_admin == True).count()
    editors = db.query(models.User).filter(models.User.is_editor == True, models.User.is_admin == False).count()
    banned  = db.query(models.User).filter(models.User.is_banned == True).count()
    students = total - admins - editors

    return {
        "total_users": total,
        "admins": admins,
        "editors": editors,
        "students": students,
        "banned": banned,
    }
