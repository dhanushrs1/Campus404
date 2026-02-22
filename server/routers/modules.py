"""
routers/modules.py — Campus404
Admin modules CRUD routes: list, new, create, edit, update, delete.
"""
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Lab, Module
from templates_config import templates

router = APIRouter()


@router.get("/admin/modules", response_class=HTMLResponse)
async def admin_modules(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/modules.html", {
        "request": request, "active": "modules",
        "modules": db.query(Module).order_by(Module.lab_id, Module.order_number).all(),
    })


@router.get("/admin/modules/new", response_class=HTMLResponse)
async def admin_modules_new(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/module_form.html", {
        "request": request, "active": "modules",
        "module": None, "labs": db.query(Lab).all(),
        "action": "/admin/modules/create",
    })


@router.post("/admin/modules/create")
async def admin_modules_create(
    lab_id: int = Form(...),
    order_number: int = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
):
    db.add(Module(
        lab_id=lab_id, order_number=order_number, title=title,
        description=description or None
    ))
    db.commit()
    return RedirectResponse("/admin/modules", status_code=303)


@router.get("/admin/modules/{module_id}/edit", response_class=HTMLResponse)
async def admin_modules_edit(module_id: int, request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/module_form.html", {
        "request": request, "active": "modules",
        "module": db.query(Module).filter(Module.id == module_id).first(),
        "labs": db.query(Lab).all(),
        "action": f"/admin/modules/{module_id}/update",
    })


@router.post("/admin/modules/{module_id}/update")
async def admin_modules_update(
    module_id: int,
    lab_id: int = Form(...),
    order_number: int = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if module:
        module.lab_id       = lab_id
        module.order_number = order_number
        module.title        = title
        module.description  = description or None
        db.commit()
    return RedirectResponse("/admin/modules", status_code=303)


@router.post("/admin/modules/{module_id}/delete")
async def admin_modules_delete(module_id: int, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if module:
        db.delete(module)
        db.commit()
    return RedirectResponse("/admin/modules", status_code=303)
