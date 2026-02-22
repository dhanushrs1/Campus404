"""
routers/analytics.py — Campus404
Admin analytics: attempt-to-pass ratio per level (Level Difficulty Stats).
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Level, Submission
from templates_config import templates

router = APIRouter()


@router.get("/admin/analytics", response_class=HTMLResponse)
async def admin_analytics(request: Request, db: Session = Depends(get_db)):
    # All published levels
    levels = db.query(Level).filter(Level.is_published == True).all()

    # Per-level submission counts
    total_counts = dict(
        db.query(Submission.level_id, func.count(Submission.id))
        .group_by(Submission.level_id)
        .all()
    )
    pass_counts = dict(
        db.query(Submission.level_id, func.count(Submission.id))
        .filter(Submission.status == "passed")
        .group_by(Submission.level_id)
        .all()
    )

    stats = []
    for lvl in levels:
        total   = total_counts.get(lvl.id, 0)
        passes  = pass_counts.get(lvl.id, 0)
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
            "level":      lvl,
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
