# Architecture — Campus404 Admin Panel

## Stack

| Layer            | Technology                            |
| ---------------- | ------------------------------------- |
| Web Framework    | FastAPI                               |
| ORM              | SQLAlchemy                            |
| Templating       | Jinja2                                |
| Database         | MySQL 8.0                             |
| Image Processing | Pillow (PIL)                          |
| Styling          | Pure CSS (no Bootstrap)               |
| Icons            | Inline SVG                            |
| Fonts            | Inter · JetBrains Mono (Google Fonts) |

---

## Modular File Layout

The server was refactored from a single `main.py` monolith into a clean feature-based module structure:

```
server/
├── main.py                  ← Entry point (~55 lines): wires all modules together
├── database.py              ← Engine, Base, SessionLocal, get_db, apply_migrations
├── models.py                ← All 8 SQLAlchemy ORM models
├── settings_seed.py         ← DEFAULT_SETTINGS list + seed_settings() + get_setting()
├── templates_config.py      ← Single shared Jinja2 instance + registered helpers
├── requirements.txt
├── static/
│   ├── admin.css            ← Custom admin stylesheet
│   └── uploads/             ← Uploaded media files (YYYY/MM/ subdirs)
├── templates/
│   └── admin/
│       ├── base.html        ← Master layout (sidebar + topbar)
│       ├── dashboard.html
│       ├── users.html
│       ├── labs.html
│       ├── lab_form.html
│       ├── levels.html
│       ├── level_form.html
│       ├── submissions.html
│       ├── badges.html
│       ├── badge_form.html
│       ├── settings.html
│       ├── media.html       ← Media library grid + drag-and-drop uploader
│       └── media_edit.html  ← Media item edit page
└── routers/
    ├── __init__.py
    ├── dashboard.py         ← GET /admin
    ├── users.py             ← GET/POST /admin/users
    ├── labs.py              ← CRUD /admin/labs
    ├── levels.py            ← CRUD /admin/levels
    ├── submissions.py       ← GET /admin/submissions
    ├── badges.py            ← CRUD /admin/badges
    ├── settings.py          ← GET/POST /admin/settings
    ├── media.py             ← CRUD + upload /admin/media
    └── api.py               ← GET / and GET /levels (public JSON)
```

---

## Request Flow

```
Browser
  │  GET /admin/labs
  ▼
FastAPI Router (routers/labs.py)
  │  db: Session = Depends(get_db)   ← from database.py
  ▼
SQLAlchemy query → MySQL
  │  list[Lab]                       ← model from models.py
  ▼
Jinja2 TemplateResponse              ← templates from templates_config.py
  │  templates/admin/labs.html → extends base.html
  ▼
HTML Response → Browser
```

Form mutations follow the **Post/Redirect/Get** pattern:

```
Browser
  │  POST /admin/labs/create  (form submit)
  ▼
FastAPI validates + writes to DB
  ▼
303 Redirect → GET /admin/labs
  ▼
Browser re-renders updated list
```

---

## Jinja2 Shared Templates

All routers import `templates` from `templates_config.py` — a **single shared instance** with global helpers registered on it:

| Global Helper           | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `fmt_bytes(size)`       | Converts bytes to human-readable string (KB, MB, etc.)    |
| `media_thumbnail(item)` | Returns thumbnail URL from metadata, fallback to original |
| `media_dim(item)`       | Returns `"W × H px"` string from metadata JSON            |

> **Critical:** All routers must `from templates_config import templates`. If each router creates its own `Jinja2Templates` instance, the global helpers won't be available and templates will throw `UndefinedError`.

---

## DB Connection & Retry

`DATABASE_URL` is read from the environment (injected by Docker Compose).
If the env var is missing, it falls back to a local dev connection string.

On startup, the app runs `create_engine_with_retry()` — it attempts to connect
up to **10 times with 3-second gaps**. Combined with the Docker Compose
MySQL `healthcheck` (condition: `service_healthy`), this permanently prevents
the race condition where FastAPI starts before MySQL is ready.

---

## Startup Sequence (`main.py`)

1. `Base.metadata.create_all(engine)` — creates any new tables
2. `apply_migrations()` — safely adds new columns to existing tables
3. `seed_settings()` — inserts default `PlatformSetting` rows if missing
4. `app = FastAPI(...)` — creates app, mounts `/static`
5. `app.include_router(...)` — registers all 9 feature routers
