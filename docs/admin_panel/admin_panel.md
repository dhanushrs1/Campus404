# Campus404 Admin Panel — Overview

> **Stack:** FastAPI · SQLAlchemy · Jinja2 · Pure CSS · MySQL  
> **URL:** `http://localhost:8000/admin`

## Documentation Index

| File                                           | Contents                                        |
| ---------------------------------------------- | ----------------------------------------------- |
| [architecture.md](./architecture.md)           | System design, tech stack, flow diagram         |
| [endpoints.md](./endpoints.md)                 | All HTTP routes, params, form fields, responses |
| [data_models.md](./data_models.md)             | Database tables, columns, relationships         |
| [templates.md](./templates.md)                 | Jinja2 template map, blocks, context variables  |
| [css_design_system.md](./css_design_system.md) | CSS tokens, layout classes, component reference |
| [extending.md](./extending.md)                 | How to add new sections, auth, local dev        |

## Quick Start

```bash
# Rebuild and start all containers
docker compose down && docker compose up --build

# Visit the admin panel
http://localhost:8000/admin
```

## Navigation

| Section     | URL                  | CRUD            |
| ----------- | -------------------- | --------------- |
| Dashboard   | `/admin`             | Read            |
| Users       | `/admin/users`       | Read + Toggle   |
| Labs        | `/admin/labs`        | Full CRUD       |
| Levels      | `/admin/levels`      | Full CRUD       |
| Submissions | `/admin/submissions` | Read            |
| Badges      | `/admin/badges`      | Create + Delete |
