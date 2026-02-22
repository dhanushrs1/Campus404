"""
routers/labs.py — Campus404
Admin labs CRUD routes: list, new, create, edit, update, delete.
"""
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Lab, Module
from templates_config import templates

router = APIRouter()


@router.get("/admin/labs", response_class=HTMLResponse)
async def admin_labs(request: Request, db: Session = Depends(get_db)):
    labs = db.query(Lab).order_by(Lab.order_number, Lab.id).all()
    # Attach module counts
    counts = {}
    for module in db.query(Module).all():
        counts[module.lab_id] = counts.get(module.lab_id, 0) + 1
    return templates.TemplateResponse("admin/labs.html", {
        "request": request, "active": "labs",
        "labs": labs,
        "module_counts": counts,
    })


@router.get("/admin/labs/new", response_class=HTMLResponse)
async def admin_labs_new(request: Request):
    return templates.TemplateResponse("admin/lab_form.html", {
        "request": request, "active": "labs",
        "lab": None, "action": "/admin/labs/create",
    })


@router.post("/admin/labs/create")
async def admin_labs_create(
    name: str = Form(...),
    description: str = Form(""),
    order_number: int = Form(0),
    db: Session = Depends(get_db),
):
    db.add(Lab(name=name, description=description, order_number=order_number))
    db.commit()
    return RedirectResponse("/admin/labs", status_code=303)


@router.get("/admin/labs/{lab_id}/edit", response_class=HTMLResponse)
async def admin_labs_edit(lab_id: int, request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/lab_form.html", {
        "request": request, "active": "labs",
        "lab": db.query(Lab).filter(Lab.id == lab_id).first(),
        "action": f"/admin/labs/{lab_id}/update",
    })


@router.post("/admin/labs/{lab_id}/update")
async def admin_labs_update(
    lab_id: int,
    name: str = Form(...),
    description: str = Form(""),
    order_number: int = Form(0),
    db: Session = Depends(get_db),
):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if lab:
        lab.name = name
        lab.description = description
        lab.order_number = order_number
        db.commit()
    return RedirectResponse("/admin/labs", status_code=303)


@router.post("/admin/labs/{lab_id}/delete")
async def admin_labs_delete(lab_id: int, db: Session = Depends(get_db)):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if lab:
        db.delete(lab)
        db.commit()
    return RedirectResponse("/admin/labs", status_code=303)
