"""
routers/challenges.py — Campus404
Admin challenges CRUD routes: list, new, create, edit, update, delete.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Module, Challenge
from templates_config import templates

router = APIRouter()


@router.get("/admin/challenges", response_class=HTMLResponse)
async def admin_challenges(request: Request, module_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Challenge)
    active_module = None
    if module_id:
        query = query.filter(Challenge.module_id == module_id)
        active_module = db.query(Module).filter(Module.id == module_id).first()
        
    return templates.TemplateResponse("admin/challenges.html", {
        "request": request, "active": "challenges",
        "challenges": query.order_by(Challenge.module_id, Challenge.order_number).all(),
        "active_module": active_module,
    })


@router.get("/admin/challenges/new", response_class=HTMLResponse)
async def admin_challenges_new(request: Request, module_id: Optional[int] = None, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/challenge_form.html", {
        "request": request, "active": "challenges",
        "challenge": None, "modules": db.query(Module).all(),
        "action": "/admin/challenges/create",
        "prefill_module_id": module_id,
    })


@router.post("/admin/challenges/create")
async def admin_challenges_create(
    module_id: int = Form(...),
    order_number: int = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    editor_file_name: str = Form("script.py"),
    instructions: str = Form(""),
    starter_code: str = Form(""),
    expected_output: str = Form(""),
    hint_text: str = Form(""),
    official_solution: str = Form(""),
    walkthrough_video_url: str = Form(""),
    is_published: str = Form(None),
    repo_link: str = Form(""),
    db: Session = Depends(get_db),
):
    db.add(Challenge(
        module_id=module_id, order_number=order_number, title=title,
        description=description or None, editor_file_name=editor_file_name,
        instructions=instructions, starter_code=starter_code,
        expected_output=expected_output,
        hint_text=hint_text, official_solution=official_solution,
        walkthrough_video_url=walkthrough_video_url or None,
        is_published=(is_published == "on"),
        repo_link=repo_link or None,
    ))
    db.commit()
    return RedirectResponse("/admin/challenges", status_code=303)


@router.get("/admin/challenges/{challenge_id}/edit", response_class=HTMLResponse)
async def admin_challenges_edit(challenge_id: int, request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/challenge_form.html", {
        "request": request, "active": "challenges",
        "challenge": db.query(Challenge).filter(Challenge.id == challenge_id).first(),
        "modules": db.query(Module).all(),
        "action": f"/admin/challenges/{challenge_id}/update",
    })


@router.post("/admin/challenges/{challenge_id}/update")
async def admin_challenges_update(
    challenge_id: int,
    module_id: int = Form(...),
    order_number: int = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    editor_file_name: str = Form("script.py"),
    instructions: str = Form(""),
    starter_code: str = Form(""),
    expected_output: str = Form(""),
    hint_text: str = Form(""),
    official_solution: str = Form(""),
    walkthrough_video_url: str = Form(""),
    is_published: str = Form(None),
    repo_link: str = Form(""),
    db: Session = Depends(get_db),
):
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge:
        challenge.module_id        = module_id
        challenge.order_number     = order_number
        challenge.title            = title
        challenge.description      = description or None
        challenge.editor_file_name = editor_file_name
        challenge.instructions     = instructions
        challenge.starter_code     = starter_code
        challenge.expected_output  = expected_output
        challenge.hint_text        = hint_text
        challenge.official_solution= official_solution
        challenge.walkthrough_video_url = walkthrough_video_url or None
        challenge.is_published     = (is_published == "on")
        challenge.repo_link        = repo_link or None
        db.commit()
    return RedirectResponse("/admin/challenges", status_code=303)


@router.post("/admin/challenges/{challenge_id}/delete")
async def admin_challenges_delete(challenge_id: int, db: Session = Depends(get_db)):
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge:
        db.delete(challenge)
        db.commit()
    return RedirectResponse("/admin/challenges", status_code=303)
