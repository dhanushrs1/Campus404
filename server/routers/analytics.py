"""
routers/analytics.py — Campus404
Admin analytics: attempt-to-pass ratio per level (Level Difficulty Stats).
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Challenge, Submission
from templates_config import templates

router = APIRouter()


@router.get("/admin/analytics", response_class=HTMLResponse)
async def admin_analytics(request: Request, db: Session = Depends(get_db)):
    # All published challenges
    challenges = db.query(Challenge).filter(Challenge.is_published == True).all()

    # Per-challenge submission counts
    total_counts = dict(
        db.query(Submission.challenge_id, func.count(Submission.id))
        .group_by(Submission.challenge_id)
        .all()
    )
    pass_counts = dict(
        db.query(Submission.challenge_id, func.count(Submission.id))
        .filter(Submission.status == "passed")
        .group_by(Submission.challenge_id)
        .all()
    )

    stats = []
    for chl in challenges:
        total   = total_counts.get(chl.id, 0)
        passes  = pass_counts.get(chl.id, 0)
        rate    = round((passes / total * 100), 1) if total > 0 else None
        if rate is None:
            difficulty = "no_data"
        elif rate < 20:
            difficulty = "hard"
        elif rate < 60:
            difficulty = "medium"
        else:
            difficulty = "easy"

        stats.append({
            "challenge":  chl,
            "total":      total,
            "passes":     passes,
            "rate":       rate,
            "difficulty": difficulty,
            "warn":       total >= 10 and passes == 0,
        })

    # Sort by pass rate ascending (hardest first) — None at bottom
    stats.sort(key=lambda s: (s["rate"] is None, s["rate"] or 0))

    return templates.TemplateResponse("admin/analytics.html", {
        "request": request,
        "active":  "analytics",
        "stats":   stats,
    })
