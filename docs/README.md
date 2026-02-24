# Campus404 — Documentation

> **A gamified, code-execution learning platform** where students fix intentionally broken programs (bugs) to progress through Labs → Modules → Challenges.

---

## Project Status (Feb 2026)

| Layer                | Progress | Notes                                                |
| -------------------- | -------- | ---------------------------------------------------- |
| Backend (FastAPI)    | ~70%     | All admin CRUD, public API, code execution done      |
| Admin Panel (Jinja2) | ~80%     | All pages built; media library, analytics, logs live |
| React Frontend       | ~40%     | Core pages built; auth, gamification loop pending    |
| Judge0 Integration   | ~60%     | Works locally & Docker; submission grading WIP       |
| Docker / Infra       | ~50%     | Compose file done; SSL / prod hardening pending      |

---

## Documentation Index

| File                                             | What It Covers                                     |
| ------------------------------------------------ | -------------------------------------------------- |
| [`architecture.md`](admin_panel/architecture.md) | System design, Docker services, data-flow diagrams |
| [`data_models.md`](admin_panel/data_models.md)   | All SQLAlchemy ORM models & database schema        |
| [`endpoints.md`](admin_panel/endpoints.md)       | Every HTTP endpoint (Admin + Public API)           |
| [`admin_panel.md`](admin_panel/admin_panel.md)   | Admin panel pages, navigation, features            |
| [`frontend.md`](frontend.md)                     | React pages, routing, component library            |
| [`judge0.md`](judge0/judge0.md)                  | Code execution sandbox integration                 |
| [`settings.md`](settings.md)                     | Platform settings reference                        |
| [`changelog.md`](changelog.md)                   | Version history and feature log                    |

---

## Quick-Start (Development)

```bash
# 1. Clone & launch everything
docker compose up --build

# 2. Backend API
http://localhost:8000        # FastAPI auto-docs
http://localhost:8000/admin  # Admin panel

# 3. Frontend (via Nginx proxy)
http://localhost:3000        # React app
```

## Tech Stack

| Component        | Technology                               |
| ---------------- | ---------------------------------------- |
| Backend          | FastAPI + SQLAlchemy (Python 3.11)       |
| Database         | MySQL 8 (via PyMySQL)                    |
| ORM Migration    | Custom `apply_migrations()` (no Alembic) |
| Admin UI         | Jinja2 HTML templates                    |
| Frontend         | React + Vite (JavaScript)                |
| Code Editor      | Monaco Editor (`@monaco-editor/react`)   |
| Code Execution   | Judge0 (self-hosted in Docker)           |
| Reverse Proxy    | Nginx                                    |
| Image Processing | Pillow                                   |
| Containerisation | Docker Compose                           |
