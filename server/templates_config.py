"""
templates.py — Campus404
Shared Jinja2Templates instance with all registered global helpers.
ALL routers must import their `templates` from this module so helpers are available.
"""
import json

from fastapi.templating import Jinja2Templates

# Single shared instance — registered helpers flow to ALL routers
templates = Jinja2Templates(directory="templates")


# ── Jinja2 helper: human-readable file size ──────────────────────────
def _fmt_bytes(size: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.0f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


# ── Jinja2 helper: thumbnail URL from metadata_json ──────────────────
def _media_thumbnail(item) -> str:
    """Returns the thumbnail URL if available, else falls back to the original."""
    try:
        meta = json.loads(item.metadata_json or "{}")
        thumb = meta.get("sizes", {}).get("thumbnail", {}).get("file_path")
        if thumb:
            return thumb
    except Exception:
        pass
    return item.file_path


# ── Jinja2 helper: image dimensions from metadata_json ───────────────
def _media_dim(item) -> str:
    """Returns 'W × H px' if dimensions exist in metadata, else empty string."""
    try:
        meta = json.loads(item.metadata_json or "{}")
        if "width" in meta and "height" in meta:
            return f"{meta['width']} × {meta['height']} px"
    except Exception:
        pass
    return ""


# Register helpers on the shared instance
templates.env.globals["fmt_bytes"]       = _fmt_bytes
templates.env.globals["media_thumbnail"] = _media_thumbnail
templates.env.globals["media_dim"]       = _media_dim
