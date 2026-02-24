# Architecture — Campus404

## Overview

Campus404 is a **three-tier web application** running entirely inside Docker Compose. Students access the React frontend, the frontend calls the FastAPI backend through the Nginx reverse proxy, and the backend executes code inside the isolated Judge0 sandbox.

---

## Docker Services

| Container               | Image              | Role                                                                    | Port            |
| ----------------------- | ------------------ | ----------------------------------------------------------------------- | --------------- |
| `campus_nginx`          | `nginx:alpine`     | Reverse proxy — routes `/api/*` to backend, everything else to frontend | 80              |
| `campus_backend`        | `python:3.11-slim` | FastAPI server (Uvicorn)                                                | 8000 (internal) |
| `campus_frontend`       | `node:20-alpine`   | Vite dev server for React                                               | 5173 (internal) |
| `campus_db`             | `mysql:8`          | Primary persistent database                                             | 3306 (internal) |
| `campus_sandbox_api`    | `judge0/judge0`    | Code-execution HTTP API                                                 | 2358 (internal) |
| `campus_sandbox_worker` | `judge0/judge0`    | Judge0 worker process                                                   | —               |
| `campus_sandbox_db`     | `postgres:14`      | Judge0's PostgreSQL storage                                             | 5432 (internal) |
| `campus_sandbox_redis`  | `redis:7`          | Judge0's job queue                                                      | 6379 (internal) |

---

## System Architecture Diagram

```
Browser
  │
  ▼
┌──────────────────────────────────────────────┐
│  Nginx (campus_nginx)  — port 80             │
│                                              │
│  /api/*   → FastAPI backend (port 8000)      │
│  /*       → React Vite frontend (port 5173)  │
└──────────────────────────────────────────────┘
       │                        │
       ▼                        ▼
┌─────────────┐        ┌──────────────────┐
│  FastAPI    │        │  React + Vite    │
│  (Python)   │        │  (JavaScript)    │
│             │        │                  │
│  models.py  │        │  Monaco Editor   │
│  routers/   │        │  React Router    │
└──────┬──────┘        └──────────────────┘
       │
  ┌────┴──────────────────────┐
  │                           │
  ▼                           ▼
MySQL 8                    Judge0
(campus_db)            (campus_sandbox_api)
                           │
                    ┌──────┴───────┐
                    │              │
                 Postgres       Redis
                 (sandbox_db)  (queue)
```

---

## Request Flow: Student Submitting Code

```
1. Student writes code in Monaco Editor (Workspace.jsx)
2. Clicks "Run Code"
3. POST /api/execute → Nginx strips /api → FastAPI /execute
4. FastAPI forwards to Judge0: POST http://judge0-server:2358/submissions
5. Judge0 executes in isolated container, returns stdout/stderr
6. FastAPI returns { "output": "..." } → frontend displays in terminal
```

> **Fallback**: If Judge0 returns an Internal Error for Python (language_id 71),
> the backend falls back to running `python` locally via `subprocess`. This handles
> Judge0's WSL2 crash on Docker Desktop.

---

## Backend Module Structure

```
server/
├── main.py               ← FastAPI app: mounts routers, runs migrations, seeds settings
├── database.py           ← Engine, SessionLocal, get_db(), apply_migrations()
├── models.py             ← All SQLAlchemy ORM models
├── settings_seed.py      ← DEFAULT_SETTINGS, seed_settings(), get_setting()
├── templates_config.py   ← Shared Jinja2 instance + global template helpers
├── requirements.txt
├── Dockerfile
└── routers/
    ├── dashboard.py      ← /admin
    ├── users.py          ← /admin/users
    ├── labs.py           ← /admin/labs
    ├── modules.py        ← /admin/modules
    ├── challenges.py     ← /admin/challenges
    ├── submissions.py    ← /admin/submissions
    ├── badges.py         ← /admin/badges
    ├── settings.py       ← /admin/settings
    ├── media.py          ← /admin/media (Pillow uploads)
    ├── leaderboard.py    ← /admin/leaderboard
    ├── analytics.py      ← /admin/analytics
    ├── syslogs.py        ← /admin/logs (Docker log viewer)
    ├── admin_api.py      ← /admin/challenges REST API (Challenge Builder)
    └── api.py            ← /challenges /labs /execute (public, consumed by React)
```

---

## Frontend Module Structure

```
client/src/
├── App.jsx               ← Router: defines all page routes
├── main.jsx              ← Entry point, wraps app in BrowserRouter
├── index.css             ← Full CSS design system (CSS variables, utilities)
├── pages/
│   ├── Home.jsx          ← Landing page (placeholder)
│   ├── Login.jsx         ← Login form (auth pending)
│   ├── Register.jsx      ← Registration form (auth pending)
│   ├── Dashboard.jsx     ← Student dashboard
│   ├── Labs.jsx          ← Lab selection grid
│   ├── Lab.jsx           ← Module + Challenge list for a lab
│   └── Workspace.jsx     ← 3-pane challenge arena + code editor + terminal
└── components/
    ├── Header.jsx        ← Global navigation header
    ├── Footer.jsx        ← Global footer
    └── AuthModal.jsx     ← Login/Register modal overlay
```

---

## Database Migrations Strategy

Campus404 **does not use Alembic**. Instead, `database.py` has a custom `apply_migrations()` function that:

1. On every startup, iterates a list of `(table, column, definition)` tuples.
2. Checks `INFORMATION_SCHEMA.COLUMNS` to see if the column exists.
3. If it doesn't exist, runs `ALTER TABLE ADD COLUMN`.
4. Safe to run repeatedly — idempotent.

New columns must be added to the `migrations` list in `database.py`.
