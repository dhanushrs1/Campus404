"""
routers/levels.py — Campus404
Admin levels CRUD routes: list, new, create, edit, update, delete.
"""
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Lab, Level
from templates_config import templates

router = APIRouter()


@router.get("/admin/levels", response_class=HTMLResponse)
async def admin_levels(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/levels.html", {
        "request": request, "active": "levels",
        "levels": db.query(Level).order_by(Level.lab_id, Level.order_number).all(),
    })


@router.get("/admin/levels/new", response_class=HTMLResponse)
async def admin_levels_new(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/level_form.html", {
        "request": request, "active": "levels",
        "level": None, "labs": db.query(Lab).all(),
        "action": "/admin/levels/create",
    })


@router.post("/admin/levels/create")
async def admin_levels_create(
    lab_id: int = Form(...),
    order_number: int = Form(...),
    title: str = Form(...),
    broken_code: str = Form(""),
    expected_output: str = Form(""),
    hint_text: str = Form(""),
    official_solution: str = Form(""),
    is_published: str = Form(None),
    repo_link: str = Form(""),
    db: Session = Depends(get_db),
):
    db.add(Level(
        lab_id=lab_id, order_number=order_number, title=title,
        broken_code=broken_code, expected_output=expected_output,
        hint_text=hint_text, official_solution=official_solution,
        is_published=(is_published == "on"),
        repo_link=repo_link or None,
    ))
    db.commit()
    return RedirectResponse("/admin/levels", status_code=303)


@router.get("/admin/levels/{level_id}/edit", response_class=HTMLResponse)
async def admin_levels_edit(level_id: int, request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/level_form.html", {
        "request": request, "active": "levels",
        "level": db.query(Level).filter(Level.id == level_id).first(),
        "labs": db.query(Lab).all(),
        "action": f"/admin/levels/{level_id}/update",
    })


@router.post("/admin/levels/{level_id}/update")
async def admin_levels_update(
    level_id: int,
    lab_id: int = Form(...),
    order_number: int = Form(...),
    title: str = Form(...),
    broken_code: str = Form(""),
    expected_output: str = Form(""),
    hint_text: str = Form(""),
    official_solution: str = Form(""),
    is_published: str = Form(None),
    repo_link: str = Form(""),
    db: Session = Depends(get_db),
):
    level = db.query(Level).filter(Level.id == level_id).first()
    if level:
        level.lab_id           = lab_id
        level.order_number     = order_number
        level.title            = title
        level.broken_code      = broken_code
        level.expected_output  = expected_output
        level.hint_text        = hint_text
        level.official_solution= official_solution
        level.is_published     = (is_published == "on")
        level.repo_link        = repo_link or None
        db.commit()
    return RedirectResponse("/admin/levels", status_code=303)


@router.post("/admin/levels/{level_id}/delete")
async def admin_levels_delete(level_id: int, db: Session = Depends(get_db)):
    level = db.query(Level).filter(Level.id == level_id).first()
    if level:
        db.delete(level)
        db.commit()
    return RedirectResponse("/admin/levels", status_code=303)
