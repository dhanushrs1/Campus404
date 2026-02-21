# Campus404 Admin Panel — Overview

> **Stack:** FastAPI · SQLAlchemy · Jinja2 · Pillow · Pure CSS · MySQL
> **URL:** `http://localhost:8000/admin`

## Documentation Index

| File                                           | Contents                                             |
| ---------------------------------------------- | ---------------------------------------------------- |
| [architecture.md](./architecture.md)           | System design, tech stack, file layout, flow diagram |
| [endpoints.md](./endpoints.md)                 | All HTTP routes, params, form fields, responses      |
| [data_models.md](./data_models.md)             | Database tables, columns, relationships              |
| [templates.md](./templates.md)                 | Jinja2 template map, blocks, context variables       |
| [css_design_system.md](./css_design_system.md) | CSS tokens, layout classes, component reference      |
| [extending.md](./extending.md)                 | How to add new sections, auth, local dev             |
| [../changelog.md](../changelog.md)             | Running log of all backend additions                 |
| [../public_api.md](../public_api.md)           | Public JSON API for the React frontend               |

---

## Quick Start

```bash
# Rebuild and start all containers
docker compose down && docker compose up --build

# Visit the admin panel
http://localhost:8000/admin
```

---

## Navigation

| Section     | URL                  | Router file              | CRUD               |
| ----------- | -------------------- | ------------------------ | ------------------ |
| Dashboard   | `/admin`             | `routers/dashboard.py`   | Read               |
| Users       | `/admin/users`       | `routers/users.py`       | Read + Toggle      |
| Labs        | `/admin/labs`        | `routers/labs.py`        | Full CRUD          |
| Levels      | `/admin/levels`      | `routers/levels.py`      | Full CRUD          |
| Submissions | `/admin/submissions` | `routers/submissions.py` | Read               |
| Badges      | `/admin/badges`      | `routers/badges.py`      | Create + Delete    |
| Settings    | `/admin/settings`    | `routers/settings.py`    | Read + Save        |
| Media       | `/admin/media`       | `routers/media.py`       | Full CRUD + Upload |

---

## Public JSON API

| Route         | External URL      | Description                         |
| ------------- | ----------------- | ----------------------------------- |
| `GET /`       | `GET /api/`       | Health check                        |
| `GET /levels` | `GET /api/levels` | Published levels for React frontend |
