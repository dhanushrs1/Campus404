# Backend Changelog — Campus404

> Running log of all significant backend additions after the initial admin panel build.
> For base architecture, see `admin_panel/architecture.md`.

---

## 2026-02 — Modular Router Refactor

**Scope:** Entire `server/` directory

The 819-line `main.py` monolith was split into a clean, feature-based module structure. No route URLs were changed — this is a pure internal reorganisation.

### New files created

| File                            | Purpose                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `server/database.py`            | DB engine, `Base`, `SessionLocal`, `get_db`, `apply_migrations()`                              |
| `server/models.py`              | All 8 SQLAlchemy ORM model classes                                                             |
| `server/settings_seed.py`       | `DEFAULT_SETTINGS` list, `seed_settings()`, `get_setting()`                                    |
| `server/templates_config.py`    | Single shared `Jinja2Templates` instance + `fmt_bytes`, `media_thumbnail`, `media_dim` globals |
| `server/routers/__init__.py`    | Package marker                                                                                 |
| `server/routers/dashboard.py`   | `GET /admin`                                                                                   |
| `server/routers/users.py`       | `GET/POST /admin/users`                                                                        |
| `server/routers/labs.py`        | CRUD `/admin/labs`                                                                             |
| `server/routers/levels.py`      | CRUD `/admin/levels`                                                                           |
| `server/routers/submissions.py` | `GET /admin/submissions`                                                                       |
| `server/routers/badges.py`      | CRUD `/admin/badges`                                                                           |
| `server/routers/settings.py`    | `GET/POST /admin/settings`                                                                     |
| `server/routers/media.py`       | Full media library CRUD + Pillow upload engine                                                 |
| `server/routers/api.py`         | `GET /` health check + `GET /levels` public API                                                |

### `main.py` reduced to ~55 lines

```python
# main.py — now only wires modules together
from database import Base, engine, apply_migrations, SessionLocal
from models import *
from settings_seed import seed_settings
from templates_config import templates   # shared Jinja2

from routers import dashboard, users, labs, levels, submissions, badges, settings, media, api

Base.metadata.create_all(engine)
apply_migrations()
# seed + app creation + include_router calls...
```

### Key design decision — shared Jinja2 instance

`templates_config.py` creates **one** `Jinja2Templates` object and registers
`fmt_bytes`, `media_thumbnail`, and `media_dim` on it. All routers import
this same instance. This is required because Jinja2 globals registered on
one instance are not visible to a different instance — a common gotcha when
splitting a FastAPI monolith.

---

## 2026-02 — Media Library

**File:** `server/routers/media.py` · **Model:** `media_items`

A WordPress-style media library was implemented end-to-end.

### New DB model: `MediaItem`

```python
class MediaItem(Base):
    __tablename__ = "media_items"
    id            = Column(Integer, primary_key=True)
    filename      = Column(String(255), unique=True)
    original_name = Column(String(255))
    file_path     = Column(String(500))   # /static/uploads/…
    file_size     = Column(BigInteger, default=0)
    mime_type     = Column(String(100))
    title         = Column(String(255), default="")
    alt_text      = Column(String(500), default="")
    caption       = Column(Text, default="")
    description   = Column(Text, default="")
    metadata_json = Column(Text, default="{}")  # original dims + responsive sizes
    uploaded_at   = Column(DateTime, default=UTC_now)
```

> `metadata_json` was added to existing databases via `apply_migrations()`.

### New endpoints

| Method | Path                       | Description                                |
| ------ | -------------------------- | ------------------------------------------ |
| `GET`  | `/admin/media`             | Media library grid with search             |
| `POST` | `/admin/media/upload`      | Multi-file upload with Pillow resizing     |
| `GET`  | `/admin/media/{id}/edit`   | Edit title, alt text, caption, description |
| `POST` | `/admin/media/{id}/update` | Save metadata                              |
| `POST` | `/admin/media/{id}/delete` | Delete files from disk + DB                |

### Pillow responsive image generation

On every upload, Pillow auto-generates up to 3 sizes:

- **thumbnail** — hard-crop or fit (configurable); default 150×150 px
- **medium** — fit inside bounding box; default 300×300 px
- **large** — fit inside bounding box; default 1024×1024 px

All dimensions are read live from `PlatformSetting` (`media_*` keys) so admins can change them without redeploying.

### File organisation

When `media_organize = "true"` (default), uploads land in `static/uploads/YYYY/MM/`.
Resized copies use the `{name}-{W}x{H}.{ext}` naming convention.

---

## 2026-02 — Media Settings (Admin Settings Tab)

**File:** `server/settings_seed.py` · **Template:** `server/templates/admin/settings.html`

8 new keys were added to `DEFAULT_SETTINGS` under the `media` tab:

| Key                | Default | Description                           |
| ------------------ | ------- | ------------------------------------- |
| `media_thumb_w`    | `150`   | Thumbnail max width (px)              |
| `media_thumb_h`    | `150`   | Thumbnail max height (px)             |
| `media_thumb_crop` | `true`  | Enable hard-crop for thumbnails       |
| `media_medium_w`   | `300`   | Medium image max width (px)           |
| `media_medium_h`   | `300`   | Medium image max height (px)          |
| `media_large_w`    | `1024`  | Large image max width (px)            |
| `media_large_h`    | `1024`  | Large image max height (px)           |
| `media_organize`   | `true`  | Organise uploads into YYYY/MM subdirs |

These are exposed in the **Settings › Media** tab in the admin panel.

---

## 2026-02 — Platform Settings System

**File:** `server/settings_seed.py` · **Table:** `platform_settings`

Key-value configuration store accessible at `GET /admin/settings`.

Three original tabs:

| Tab        | Keys                                                    |
| ---------- | ------------------------------------------------------- |
| `gameplay` | `max_fail_unlock`, `xp_per_level`, `xp_per_first_try`   |
| `platform` | `platform_name`, `platform_tagline`, `maintenance_mode` |
| `access`   | `allow_registrations`, `ban_duration_days`              |

Reading a setting in code:

```python
from settings_seed import get_setting
threshold = int(get_setting(db, "max_fail_unlock", default="5"))
```

---

## 2026-02 — Gamification Models

**Files:** `server/models.py`

Added to support the game engine and admin visibility:

- **`Submission`** — tracks every code submission with `status`, `timestamp`
- **`Badge`** — XP-gated achievements with optional image URL
- **`UserProgress`** — per-user-per-level completion + `failed_attempts` counter
- **`User.is_admin`** / **`User.is_banned`** — admin management flags

---

## 2026-02 — `Level.repo_link`

**Table:** `levels` · **Added via:** `apply_migrations()`

```python
repo_link = Column(String(500), nullable=True)
```

Optional GitHub or resource URL. The game engine uses `UserProgress.failed_attempts` vs
`max_fail_unlock` to decide when to reveal it to the student.

---

## 2026-02 — `apply_migrations()` — Incremental Schema Migration

**File:** `server/database.py`

SQLAlchemy's `create_all()` never alters existing tables. `apply_migrations()` uses
`INFORMATION_SCHEMA.COLUMNS` to safely `ALTER TABLE` only when a column is missing.

```python
migrations = [
    ("levels",      "repo_link",     "VARCHAR(500) NULL"),
    ("media_items", "metadata_json", "TEXT"),
]
```

**To add a future column:** append a tuple to `migrations`. The function is
idempotent — safe to run on an already-migrated database.

---

## 2026-02 — Nginx Proxy Routing

**File:** `infra/nginx.conf`

| Browser request        | Nginx rule                          | Backend receives           |
| ---------------------- | ----------------------------------- | -------------------------- |
| `/api/*`               | `proxy_pass http://backend:8000/;`  | Path with `/api/` stripped |
| `/*` (everything else) | `proxy_pass http://frontend:3000/;` | Original path              |

FastAPI routes must **not** include `/api/` in their path.
Example: browser calls `/api/levels` → FastAPI route is `GET /levels`.
