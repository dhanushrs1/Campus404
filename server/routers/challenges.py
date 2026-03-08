"""
routers/challenges.py — Campus404
Admin challenges CRUD routes: list, new, create, edit, update, delete.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Module, Challenge
from templates_config import templates

router = APIRouter()


@router.get("/admin/challenges", response_class=HTMLResponse)
async def admin_challenges(request: Request, module_id: Optional[int] = None, db: Session = Depends(get_db)):
    if module_id:
        query = db.query(Challenge).filter(Challenge.module_id == module_id)
        active_module = db.query(Module).filter(Module.id == module_id).first()
    else:
        query = db.query(Challenge)
        active_module = None
        
    return templates.TemplateResponse("admin/content/challenges.html", {
        "request": request, "active": "challenges",
        "challenges": query.order_by(Challenge.module_id, Challenge.order_number).all(),
        "active_module": active_module,
    })


@router.get("/admin/challenges/new", response_class=HTMLResponse)
async def admin_challenges_new(request: Request, module_id: Optional[int] = None, db: Session = Depends(get_db)):
    auto_level = 1
    module_name = ""
    
    if module_id:
        mod = db.query(Module).filter(Module.id == module_id).first()
        if mod:
            module_name = mod.title
        max_order = db.query(func.max(Challenge.order_number)).filter(Challenge.module_id == module_id).scalar()
        auto_level = (max_order or 0) + 1

    return templates.TemplateResponse("admin/content/challenge_form.html", {
        "request": request, "active": "challenges",
        "challenge": None, 
        "modules": db.query(Module).all(),
        "prefill_module_id": module_id,
        "module_name": module_name,
        "auto_level": auto_level
    })


# admin_challenges_create and admin_challenges_update removed.
# The UI now delegates creation/updating via fetch() directly to
# the backend REST API in admin_api.py instead of raw form submissions.


@router.get("/admin/challenges/{challenge_id}/edit", response_class=HTMLResponse)
async def admin_challenges_edit(challenge_id: int, request: Request, db: Session = Depends(get_db)):
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    module_name = ""
    if challenge and challenge.module:
         module_name = challenge.module.title

    return templates.TemplateResponse("admin/content/challenge_form.html", {
        "request": request, "active": "challenges",
        "challenge": challenge,
        "modules": db.query(Module).all(),
        "module_name": module_name
    })


@router.post("/admin/challenges/{challenge_id}/delete")
async def admin_challenges_delete(challenge_id: int, db: Session = Depends(get_db)):
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge:
        db.delete(challenge)
        db.commit()
    return RedirectResponse("/admin/challenges", status_code=303)
