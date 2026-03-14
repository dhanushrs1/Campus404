"""
admin/stats.py — Campus404
Admin dashboard statistics endpoint.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models
import curriculum.models as cm
import urllib.request
import json
import os

router = APIRouter()

@router.get("")
async def get_stats(db: Session = Depends(get_db)):
    # User Stats
    total_users = db.query(models.User).count()
    admins  = db.query(models.User).filter(models.User.is_admin == True).count()
    editors = db.query(models.User).filter(models.User.is_editor == True, models.User.is_admin == False).count()
    banned  = db.query(models.User).filter(models.User.is_banned == True).count()
    students = total_users - admins - editors

    # Curriculum Stats
    total_labs = db.query(cm.Lab).count()
    total_modules = db.query(cm.Module).count()
    total_challenges = db.query(cm.Challenge).count()
    total_submissions = db.query(cm.ChallengeCompletion).count()

    # System Status (Backend is running if we are here)
    system_status = "online"

    # Judge0 Status
    judge_status = "offline"
    judge_url = os.getenv("JUDGE0_URL", "http://campus_sandbox_api:2358")
    try:
        req = urllib.request.Request(f"{judge_url}/system_info", method="GET")
        with urllib.request.urlopen(req, timeout=3) as response:
            if response.status == 200:
                judge_status = "online"
    except Exception:
        pass

    return {
        "users": {
            "total": total_users,
            "admins": admins,
            "editors": editors,
            "students": students,
            "banned": banned,
        },
        "curriculum": {
            "labs": total_labs,
            "modules": total_modules,
            "challenges": total_challenges,
            "submissions": total_submissions
        },
        "health": {
            "system": system_status,
            "judge0": judge_status
        }
    }
