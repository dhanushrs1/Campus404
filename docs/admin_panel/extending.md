# Extending the Admin Panel

---

## Adding a New Admin Section

The server uses a **FastAPI Router** pattern — each feature is an isolated module in `server/routers/`. Follow these steps to add a new section cleanly.

### 1. Add the Model (`server/models.py`)

```python
class Announcement(Base):
    __tablename__ = "announcements"
    id      = Column(Integer, primary_key=True)
    title   = Column(String(200))
    body    = Column(Text)
    created = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

Then register the table — `Base.metadata.create_all(engine)` in `main.py` will pick it up automatically on next restart.

> If you are adding a **new column to an existing table**, add an entry to the `migrations` list in `server/database.py` instead of altering the class definition directly.

### 2. Create a Router (`server/routers/announcements.py`)

```python
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Announcement
from templates_config import templates   # ← always import from here, never create a new instance

router = APIRouter()


@router.get("/admin/announcements", response_class=HTMLResponse)
async def admin_announcements(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/announcements.html", {
        "request": request,
        "active": "announcements",
        "items": db.query(Announcement).order_by(Announcement.created.desc()).all(),
    })


@router.post("/admin/announcements/create")
async def admin_announcements_create(
    title: str = Form(...),
    body: str = Form(""),
    db: Session = Depends(get_db),
):
    db.add(Announcement(title=title, body=body))
    db.commit()
    return RedirectResponse("/admin/announcements", status_code=303)


@router.post("/admin/announcements/{item_id}/delete")
async def admin_announcements_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Announcement).filter(Announcement.id == item_id).first()
    if item:
        db.delete(item)
        db.commit()
    return RedirectResponse("/admin/announcements", status_code=303)
```

> **Critical:** Always import `templates` from `templates_config`. Creating a new `Jinja2Templates` instance per router means Jinja2 globals (`fmt_bytes`, `media_thumbnail`, etc.) won't be available and templates will throw `UndefinedError`.

### 3. Register the Router (`server/main.py`)

```python
from routers import announcements   # add this import

app.include_router(announcements.router)   # add this line
```

### 4. Add a Sidebar Link (`templates/admin/base.html`)

```html
<span class="sb-section">Content</span>
<a
  href="/admin/announcements"
  class="sb-link {% if active == 'announcements' %}active{% endif %}"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- paste any inline SVG path here — heroicons.com -->
  </svg>
  <span>Announcements</span>
</a>
```

> **Icon source:** [heroicons.com](https://heroicons.com) — copy the SVG `<path>` into the template.

### 5. Create the Template (`templates/admin/announcements.html`)

```html
{% extends "admin/base.html" %} {% block title %}Announcements{% endblock %} {%
block breadcrumb %}Announcements{% endblock %} {% block page_title
%}Announcements{% endblock %} {% block header_actions %}
<a href="/admin/announcements/new" class="btn btn-primary">
  <svg><!-- plus icon --></svg>
  New Announcement
</a>
{% endblock %} {% block content %}
<div class="card">
  <div class="card-head"><div class="card-title">All Announcements</div></div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {% for item in items %}
        <tr>
          <td class="mono">{{ item.id }}</td>
          <td>{{ item.title }}</td>
          <td>
            <div class="table-actions">
              <form
                method="post"
                action="/admin/announcements/{{ item.id }}/delete"
                onsubmit="return confirm('Delete?')"
              >
                <button class="btn btn-danger-soft btn-sm">Delete</button>
              </form>
            </div>
          </td>
        </tr>
        {% else %}
        <tr class="empty-row">
          <td colspan="3">No announcements yet.</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>
</div>
{% endblock %}
```

---

## Adding a Column to an Existing Table

Do **not** just add to the model class — existing databases won't change.
Use `apply_migrations()` in `server/database.py`:

```python
migrations = [
    ("levels",      "repo_link",     "VARCHAR(500) NULL"),
    ("media_items", "metadata_json", "TEXT"),
    # ← append new entries here:
    ("announcements", "is_pinned", "BOOLEAN DEFAULT FALSE"),
]
```

The function uses `INFORMATION_SCHEMA.COLUMNS` to check if the column already exists before running `ALTER TABLE` — safe to run repeatedly.

---

## Adding a Jinja2 Global Helper

Add to `server/templates_config.py`:

```python
def my_helper(value) -> str:
    return str(value).upper()

templates.env.globals["my_helper"] = my_helper
```

The helper is then available in **all** templates as `{{ my_helper(item.field) }}`.

---

## Adding Authentication

FastAPI supports HTTP Basic Auth. To protect all `/admin` routes:

```python
# In any router file, or a shared auth.py module:
import secrets
from fastapi import Security
from fastapi.security import HTTPBasic, HTTPBasicCredentials

security = HTTPBasic()

def require_admin(credentials: HTTPBasicCredentials = Security(security)):
    valid = (
        secrets.compare_digest(credentials.username, "admin") and
        secrets.compare_digest(credentials.password, "your-password")
    )
    if not valid:
        raise HTTPException(status_code=401, headers={"WWW-Authenticate": "Basic"})
    return credentials

# Add to each route that needs protection:
@router.get("/admin/announcements", response_class=HTMLResponse)
async def admin_announcements(
    request: Request,
    _=Depends(require_admin),        # ← protect this route
    db: Session = Depends(get_db),
):
    ...
```

---

## Flash Messages

Pass flash messages after a mutation via query params:

```python
return RedirectResponse("/admin/labs?msg=Lab+created&msg_type=success", status_code=303)
```

Then accept them in the GET route:

```python
@router.get("/admin/labs", response_class=HTMLResponse)
async def admin_labs(
    request: Request,
    db: Session = Depends(get_db),
    msg: str = None,
    msg_type: str = "success",
):
    return templates.TemplateResponse("admin/labs.html", {
        "request": request, "active": "labs",
        "labs": db.query(Lab).all(),
        "msg": msg, "msg_type": msg_type,
    })
```

`base.html` already renders `msg` and `msg_type` automatically as a banner.

---

## Running Locally (Without Docker)

```bash
# 1. Install dependencies
pip install -r server/requirements.txt

# 2. Set your local DB URL
$env:DATABASE_URL = "mysql+pymysql://user:pass@localhost:3306/campus404"

# 3. Start dev server (auto-reload on file changes)
cd server
uvicorn main:app --reload --port 8000

# 4. Open in browser
http://localhost:8000/admin
```
