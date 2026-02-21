"""
routers/settings.py — Campus404
Admin platform settings routes: load grouped settings, save changed values.
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import PlatformSetting
from templates_config import templates

router = APIRouter()


@router.get("/admin/settings", response_class=HTMLResponse)
async def admin_settings(
    request: Request,
    db: Session = Depends(get_db),
    msg: str = None,
    msg_type: str = "success",
    tab: str = "gameplay",
):
    settings_list = db.query(PlatformSetting).all()
    # Group by tab for the template
    by_tab: dict = {}
    for s in settings_list:
        by_tab.setdefault(s.tab, []).append(s)
    return templates.TemplateResponse("admin/settings.html", {
        "request": request, "active": "settings",
        "by_tab": by_tab,
        "active_tab": tab,
        "msg": msg, "msg_type": msg_type,
    })


@router.post("/admin/settings")
async def admin_settings_save(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    active_tab = form.get("_tab", "gameplay")
    for key, value in form.items():
        if key.startswith("_"):  # skip meta fields like _tab
            continue
        setting = db.query(PlatformSetting).filter_by(key=key).first()
        if setting:
            setting.value = value
    db.commit()
    return RedirectResponse(
        f"/admin/settings?msg=Settings+saved&msg_type=success&tab={active_tab}",
        status_code=303,
    )
