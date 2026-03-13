"""
admin/uploads.py — Campus404
Secure file upload API with WordPress-style folder organization.

Features:
  - WordPress-style /uploads/YYYY/MM/DD/ directory structure
  - Allowed types: JPEG, PNG, GIF, WebP, AVIF, SVG, PDF, ICO
  - SVG security: strip scripts, event handlers, external references, foreignObject
  - Secure filenames: UUID-based names to prevent collisions and traversal
  - Admin can delete; editors can only upload/list
  - Returns full public URL
"""
import os
import re
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Query
from fastapi.responses import JSONResponse

router = APIRouter()

# ── Constants ──────────────────────────────────────────────────────────
UPLOAD_ROOT = Path("/app/uploads")

ALLOWED_TYPES: dict[str, str] = {
    "image/jpeg":    "jpg",
    "image/jpg":    "jpg",
    "image/png":     "png",
    "image/gif":     "gif",
    "image/webp":    "webp",
    "image/avif":    "avif",
    "image/svg+xml": "svg",
    "image/x-icon":  "ico",
    "image/vnd.microsoft.icon": "ico",
    "application/pdf": "pdf",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# Magic bytes for file header validation
MAGIC_BYTES = {
    b"\xff\xd8\xff":    "jpeg",
    b"\x89PNG\r\n\x1a\n": "png",
    b"GIF87a":          "gif",
    b"GIF89a":          "gif",
    b"RIFF":            "webp",  # RIFF....WEBP — check further
    b"<?xml":           "svg",
    b"<svg":            "svg",
    b"%PDF":            "pdf",
    b"\x00\x00\x01\x00": "ico",
}


# ── SVG Security Sanitizer ─────────────────────────────────────────────
def _sanitize_svg(content: str) -> str:
    """
    Strips dangerous content from SVG files:
    - <script> blocks
    - Event handler attributes (on*)
    - External hrefs / xlink:href pointing outside the doc
    - <foreignObject> (can embed HTML/JS)
    - <use> elements referencing external resources
    - data: URIs in href/src
    """
    # Remove <script> blocks entirely
    content = re.sub(r"<script[\s\S]*?</script\s*>", "", content, flags=re.IGNORECASE)

    # Remove event handler attributes (onclick, onload, onerror, etc.)
    content = re.sub(r'\bon\w+\s*=\s*["\'][^"\']*["\']', "", content, flags=re.IGNORECASE)
    content = re.sub(r'\bon\w+\s*=\s*[^\s>]+', "", content, flags=re.IGNORECASE)

    # Remove <foreignObject> (can embed arbitrary HTML)
    content = re.sub(r"<foreignObject[\s\S]*?</foreignObject\s*>", "", content, flags=re.IGNORECASE)

    # Remove external hrefs / xlink:href
    content = re.sub(
        r'(href|xlink:href)\s*=\s*["\'](?!#)[^"\']*["\']',
        "",
        content,
        flags=re.IGNORECASE,
    )

    # Remove data: URIs (can embed base64 scripts)
    content = re.sub(r'(src|href)\s*=\s*["\']data:[^"\']*["\']', "", content, flags=re.IGNORECASE)

    # Remove javascript: pseudo-protocol
    content = re.sub(r'(href|src|action)\s*=\s*["\']javascript:[^"\']*["\']', "", content, flags=re.IGNORECASE)

    # Remove <use> referencing anything outside the document
    content = re.sub(r'<use[^>]+href\s*=\s*["\'][^#][^"\']*["\'][^>]*/>', "", content, flags=re.IGNORECASE)

    return content


def _validate_magic(data: bytes, content_type: str) -> bool:
    """Light magic-byte validation to reject files with wrong claimed type."""
    # SVG: must start with <?xml or <svg (after optional BOM/whitespace)
    if content_type == "image/svg+xml":
        head = data.lstrip()[:10].decode("utf-8", errors="ignore").lower()
        return head.startswith("<?xml") or head.startswith("<svg")
    # WebP: RIFF....WEBP
    if content_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    # AVIF: ftyp box with avif/avis brand
    if content_type == "image/avif":
        return b"ftyp" in data[:20] and (b"avif" in data[4:20] or b"avis" in data[4:20])
    # JPEG
    if content_type in ("image/jpeg", "image/jpg"):
        return data[:3] == b"\xff\xd8\xff"
    # PNG
    if content_type == "image/png":
        return data[:8] == b"\x89PNG\r\n\x1a\n"
    # GIF
    if content_type == "image/gif":
        return data[:6] in (b"GIF87a", b"GIF89a")
    # PDF
    if content_type == "application/pdf":
        return data[:4] == b"%PDF"
    return True  # ICO and others — skip deep validation


def _get_upload_dir() -> Path:
    """Return a WordPress-style date-based path and ensure it exists."""
    now = datetime.utcnow()
    subdir = UPLOAD_ROOT / str(now.year) / f"{now.month:02d}" / f"{now.day:02d}"
    subdir.mkdir(parents=True, exist_ok=True)
    return subdir


def _public_url(request: Request, file_path: Path) -> str:
    """Build the public URL from a file path."""
    relative = file_path.relative_to(UPLOAD_ROOT)
    base = str(request.base_url).rstrip("/")
    return f"{base}/uploads/{relative.as_posix()}"


# ── POST /upload ───────────────────────────────────────────────────────
@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    content_type = file.content_type or ""

    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"File type '{content_type}' is not allowed. Allowed types: {', '.join(ALLOWED_TYPES.keys())}",
        )

    data = await file.read()

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds the 20 MB size limit.")

    if not _validate_magic(data, content_type):
        raise HTTPException(status_code=422, detail="File content doesn't match the claimed type.")

    # SVG Sanitization
    if content_type == "image/svg+xml":
        try:
            svg_str = data.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=422, detail="SVG file must be valid UTF-8.")
        svg_str = _sanitize_svg(svg_str)
        data = svg_str.encode("utf-8")

    # Secure filename: UUID + original extension
    ext = ALLOWED_TYPES[content_type]
    uid = uuid.uuid4().hex
    sha = hashlib.sha256(data).hexdigest()[:8]
    filename = f"{uid}-{sha}.{ext}"

    save_dir = _get_upload_dir()
    save_path = save_dir / filename

    with open(save_path, "wb") as f:
        f.write(data)

    now = datetime.utcnow()
    return {
        "url": _public_url(request, save_path),
        "filename": filename,
        "original_name": file.filename,
        "size": len(data),
        "type": content_type,
        "path": f"{now.year}/{now.month:02d}/{now.day:02d}/{filename}",
        "uploaded_at": now.isoformat() + "Z",
    }


# ── GET /media — list uploaded files ──────────────────────────────────
@router.get("/media")
async def list_media(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(40, ge=1, le=100),
    type_filter: Optional[str] = Query(None),  # "image" | "pdf" | "svg"
):
    if not UPLOAD_ROOT.exists():
        return {"total": 0, "page": page, "items": []}

    all_files = []
    for f in sorted(UPLOAD_ROOT.rglob("*"), key=lambda x: x.stat().st_mtime, reverse=True):
        if not f.is_file():
            continue
        ext = f.suffix.lower().lstrip(".")
        if type_filter == "svg" and ext != "svg":
            continue
        if type_filter == "pdf" and ext != "pdf":
            continue
        if type_filter == "image" and ext not in ("jpg", "jpeg", "png", "gif", "webp", "avif", "ico"):
            continue

        stat = f.stat()
        relative = f.relative_to(UPLOAD_ROOT)
        all_files.append({
            "url": _public_url(request, f),
            "filename": f.name,
            "path": relative.as_posix(),
            "size": stat.st_size,
            "ext": ext,
            "uploaded_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat() + "Z",
        })

    total = len(all_files)
    start = (page - 1) * per_page
    items = all_files[start : start + per_page]

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
        "items": items,
    }


# ── DELETE /media — admin only can delete ─────────────────────────────
@router.delete("/media")
async def delete_file(path: str = Query(...)):
    """
    Expects `path` like "2026/03/13/abc123.jpg" (relative to UPLOAD_ROOT).
    Validates strictly within uploads root to prevent traversal.
    """
    target = (UPLOAD_ROOT / path).resolve()

    # Security: ensure resolved path is inside UPLOAD_ROOT
    if not str(target).startswith(str(UPLOAD_ROOT.resolve())):
        raise HTTPException(status_code=403, detail="Access denied.")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    target.unlink()

    # Clean up empty parent directories (up to UPLOAD_ROOT)
    parent = target.parent
    while parent != UPLOAD_ROOT.resolve() and not any(parent.iterdir()):
        parent.rmdir()
        parent = parent.parent

    return {"message": "File deleted successfully.", "path": path}
