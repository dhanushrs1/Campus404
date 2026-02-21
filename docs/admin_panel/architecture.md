# Architecture — Campus404 Admin Panel

## Stack

| Layer         | Technology                            |
| ------------- | ------------------------------------- |
| Web Framework | FastAPI                               |
| ORM           | SQLAlchemy                            |
| Templating    | Jinja2                                |
| Database      | MySQL 8.0                             |
| Styling       | Pure CSS (no Bootstrap)               |
| Icons         | Inline SVG                            |
| Fonts         | Inter · JetBrains Mono (Google Fonts) |

## Request Flow

```
Browser
  │  GET /admin/labs
  ▼
FastAPI Router (main.py)
  │  Session = Depends(get_db)
  ▼
SQLAlchemy query → MySQL
  │  list[Lab]
  ▼
Jinja2 TemplateResponse
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

## File Layout

```
server/
├── main.py                     ← All routes, models, DB setup
├── requirements.txt
├── static/
│   └── admin.css               ← Custom admin stylesheet
└── templates/
    └── admin/
        ├── base.html           ← Master layout (sidebar + topbar)
        ├── dashboard.html
        ├── users.html
        ├── labs.html
        ├── lab_form.html
        ├── levels.html
        ├── level_form.html
        ├── submissions.html
        ├── badges.html
        └── badge_form.html
```

## DB Connection & Retry

`DATABASE_URL` is read from the environment (injected by Docker Compose).  
If the env var is missing, it falls back to a local dev connection string.

On startup, the app runs `create_engine_with_retry()` — it attempts to connect
up to **10 times with 3-second gaps**. Combined with the Docker Compose
MySQL `healthcheck` (condition: `service_healthy`), this permanently prevents
the race condition where FastAPI starts before MySQL is ready.
