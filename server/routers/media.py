"""
routers/media.py — Campus404
Admin media library routes: list, upload (with Pillow resizing), edit, update, delete.
Registers Jinja2 template globals for media helpers.
"""
import json
import os
import shutil
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from database import get_db
from models import MediaItem, PlatformSetting
from templates_config import templates

router = APIRouter()

# ── Upload directory constant (relative to server/) ──────────────────
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# ── Allowed MIME types ────────────────────────────────────────────────
ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "image/svg+xml", "image/bmp", "image/tiff",
}

# ── Helpers used by templates_config.py globals and this router ──────
def get_unique_filename(directory: str, filename: str) -> str:
    """If a file already exists, append -1, -2, etc. like WordPress."""
    name, ext = os.path.splitext(filename)
    counter = 1
    new_filename = filename
    while os.path.exists(os.path.join(directory, new_filename)):
        new_filename = f"{name}-{counter}{ext}"
        counter += 1
    return new_filename


# ── Routes ───────────────────────────────────────────────────────────
@router.get("/admin/media", response_class=HTMLResponse)
async def admin_media(
    request: Request,
    db: Session = Depends(get_db),
    msg: Optional[str] = None,
    msg_type: Optional[str] = "success",
    q: Optional[str] = None,
):
    query = db.query(MediaItem).order_by(MediaItem.uploaded_at.desc())
    if q:
        query = query.filter(
            MediaItem.title.contains(q) | MediaItem.original_name.contains(q)
        )
    return templates.TemplateResponse("admin/media.html", {
        "request": request,
        "active": "media",
        "items": query.all(),
        "total": db.query(MediaItem).count(),
        "q": q,
        "msg": msg,
        "msg_type": msg_type,
    })


@router.get("/admin/api/media")
async def api_admin_media(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
):
    """JSON endpoint for the WYSIWYG Image Picker Modal"""
    query = db.query(MediaItem).order_by(MediaItem.uploaded_at.desc())
    if q:
        query = query.filter(
            MediaItem.title.contains(q) | MediaItem.original_name.contains(q)
        )
    
    items = query.all()
    results = []
    for item in items:
        # Get thumbnail or fallback to original file path
        try:
            meta = json.loads(item.metadata_json or "{}")
            thumb_path = meta.get("sizes", {}).get("thumbnail", {}).get("file_path", item.file_path)
        except:
            thumb_path = item.file_path
            
        results.append({
            "id": item.id,
            "title": item.title or item.original_name,
            "url": item.file_path,
            "thumb": thumb_path,
            "mime_type": item.mime_type
        })
        
    return {"items": results}


@router.post("/admin/media/upload")
async def admin_media_upload(
    request: Request,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    uploaded = 0
    errors = []

    # Load media settings from DB once
    settings_query = db.query(PlatformSetting).filter(PlatformSetting.tab == "media").all()
    media_settings = {s.key: s.value for s in settings_query}

    def get_dim(s_key: str, default: int) -> int:
        val = media_settings.get(s_key, str(default))
        try:
            return int(val) if int(val) > 0 else default
        except ValueError:
            return default

    thumb_w   = get_dim("media_thumb_w", 150)
    thumb_h   = get_dim("media_thumb_h", 150)
    hard_crop = media_settings.get("media_thumb_crop", "true") == "true"
    medium_w  = get_dim("media_medium_w", 300)
    medium_h  = get_dim("media_medium_h", 300)
    large_w   = get_dim("media_large_w", 1024)
    large_h   = get_dim("media_large_h", 1024)
    do_organize = media_settings.get("media_organize", "true") == "true"

    # Decide target folder structure
    if do_organize:
        month_dir     = datetime.now().strftime("%Y/%m")
        target_dir    = os.path.join(UPLOADS_DIR, month_dir)
        db_path_prefix = f"/static/uploads/{month_dir}/"
    else:
        target_dir    = UPLOADS_DIR
        db_path_prefix = "/static/uploads/"

    os.makedirs(target_dir, exist_ok=True)

    for file in files:
        if file.content_type not in ALLOWED_MIME:
            errors.append(f"{file.filename}: unsupported type ({file.content_type})")
            continue

        original_name = file.filename or "unnamed.bin"
        safe_name = "".join(c for c in original_name if c.isalnum() or c in ".-_").lower()
        if not safe_name:
            safe_name = f"{uuid.uuid4().hex[:8]}.bin"

        disk_name = get_unique_filename(target_dir, safe_name)
        dest = os.path.join(target_dir, disk_name)

        # Save original
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)

        size = os.path.getsize(dest)
        metadata: dict = {"sizes": {}}

        try:
            with Image.open(dest) as img:
                metadata["width"]  = img.width
                metadata["height"] = img.height

                sizes: dict = {}
                if thumb_w > 0 and thumb_h > 0:
                    sizes["thumbnail"] = (thumb_w, thumb_h)
                if medium_w > 0 and medium_h > 0:
                    sizes["medium"] = (medium_w, medium_h)
                if large_w > 0 and large_h > 0:
                    sizes["large"] = (large_w, large_h)

                name_base, ext = os.path.splitext(disk_name)

                for size_name, max_dim in sizes.items():
                    is_thumb = size_name == "thumbnail"
                    if img.width > max_dim[0] or img.height > max_dim[1] or (is_thumb and hard_crop):
                        if is_thumb and hard_crop:
                            resized_img = ImageOps.fit(img, max_dim, Image.Resampling.LANCZOS)
                        else:
                            resized_img = img.copy()
                            resized_img.thumbnail(max_dim, Image.Resampling.LANCZOS)

                        resized_name = f"{name_base}-{resized_img.width}x{resized_img.height}{ext}"
                        resized_dest = os.path.join(target_dir, resized_name)

                        if img.format == "PNG":
                            resized_img.save(resized_dest, format="PNG")
                        elif img.format == "GIF":
                            resized_img.save(resized_dest, format="GIF", save_all=True)
                        else:
                            if resized_img.mode in ("RGBA", "P"):
                                resized_img = resized_img.convert("RGB")
                            resized_img.save(resized_dest, format="JPEG", quality=85)

                        metadata["sizes"][size_name] = {
                            "file":      resized_name,
                            "width":     resized_img.width,
                            "height":    resized_img.height,
                            "mime_type": file.content_type,
                            "file_path": f"{db_path_prefix}{resized_name}",
                        }
        except Exception as e:
            metadata["error"] = str(e)

        db.add(MediaItem(
            filename=disk_name,
            original_name=original_name,
            file_path=f"{db_path_prefix}{disk_name}",
            file_size=size,
            mime_type=file.content_type,
            title=os.path.splitext(original_name)[0],
            metadata_json=json.dumps(metadata),
        ))
        uploaded += 1

    db.commit()
    if errors:
        msg = f"Uploaded {uploaded} file(s). Skipped: {'; '.join(errors)}"
        return RedirectResponse(f"/admin/media?msg={msg}&msg_type=error", status_code=303)
    return RedirectResponse(
        f"/admin/media?msg=Uploaded+{uploaded}+file(s)+successfully&msg_type=success",
        status_code=303,
    )


@router.get("/admin/media/{item_id}/edit", response_class=HTMLResponse)
async def admin_media_edit(item_id: int, request: Request, db: Session = Depends(get_db)):
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if not item:
        return RedirectResponse("/admin/media?msg=Item+not+found&msg_type=error", status_code=303)
    return templates.TemplateResponse("admin/media_edit.html", {
        "request": request,
        "active": "media",
        "item": item,
        "msg": None,
    })


@router.post("/admin/media/{item_id}/update")
async def admin_media_update(
    item_id: int,
    title: str = Form(""),
    alt_text: str = Form(""),
    caption: str = Form(""),
    description: str = Form(""),
    db: Session = Depends(get_db),
):
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if item:
        item.title       = title
        item.alt_text    = alt_text
        item.caption     = caption
        item.description = description
        db.commit()
    return RedirectResponse(
        "/admin/media?msg=Media+details+saved+successfully&msg_type=success",
        status_code=303,
    )


@router.post("/admin/media/{item_id}/delete")
async def admin_media_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if item:
        # Delete original file from disk
        if item.file_path.startswith("/static/uploads/"):
            rel_path  = item.file_path.replace("/static/uploads/", "", 1)
            disk_path = os.path.join(UPLOADS_DIR, rel_path)
            if os.path.exists(disk_path):
                os.remove(disk_path)

        # Delete all resized versions
        try:
            meta = json.loads(item.metadata_json or "{}")
            for _size_key, size_data in meta.get("sizes", {}).items():
                fp = size_data.get("file_path", "")
                if fp.startswith("/static/uploads/"):
                    rel  = fp.replace("/static/uploads/", "", 1)
                    path = os.path.join(UPLOADS_DIR, rel)
                    if os.path.exists(path):
                        os.remove(path)
        except Exception:
            pass

        db.delete(item)
        db.commit()
    return RedirectResponse("/admin/media?msg=Deleted&msg_type=success", status_code=303)
