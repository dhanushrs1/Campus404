"""
routers/badges.py — Campus404
Admin badges CRUD routes: list, new, create, delete.
"""
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Badge
from templates_config import templates

router = APIRouter()


@router.get("/admin/badges", response_class=HTMLResponse)
async def admin_badges(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/badges.html", {
        "request": request, "active": "badges",
        "badges": db.query(Badge).all(),
    })


@router.get("/admin/badges/new", response_class=HTMLResponse)
async def admin_badges_new(request: Request):
    return templates.TemplateResponse("admin/badge_form.html", {
        "request": request, "active": "badges",
        "badge": None, "action": "/admin/badges/create",
    })


@router.post("/admin/badges/create")
async def admin_badges_create(
    name: str = Form(...),
    image_url: str = Form(""),
    required_xp: int = Form(0),
    db: Session = Depends(get_db),
):
    db.add(Badge(name=name, image_url=image_url, required_xp=required_xp))
    db.commit()
    return RedirectResponse("/admin/badges", status_code=303)


@router.post("/admin/badges/{badge_id}/delete")
async def admin_badges_delete(badge_id: int, db: Session = Depends(get_db)):
    badge = db.query(Badge).filter(Badge.id == badge_id).first()
    if badge:
        db.delete(badge)
        db.commit()
    return RedirectResponse("/admin/badges", status_code=303)
