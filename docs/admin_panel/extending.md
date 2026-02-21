# Extending the Admin Panel

---

## Adding a New Admin Section

### 1. Define the Model (`main.py`)

```python
class MyModel(Base):
    __tablename__ = "my_table"
    id   = Column(Integer, primary_key=True)
    name = Column(String(100))
    # add more columns as needed
```

### 2. Add Routes (`main.py`)

```python
@app.get("/admin/my-model", response_class=HTMLResponse)
async def admin_mymodel_list(request: Request, db: Session = Depends(get_db)):
    items = db.query(MyModel).all()
    return templates.TemplateResponse("admin/mymodel.html", {
        "request": request,
        "active": "mymodel",   # must match sidebar check
        "items": items,
    })

@app.post("/admin/my-model/{item_id}/delete")
async def admin_mymodel_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.query(MyModel).filter(MyModel.id == item_id).first()
    if item:
        db.delete(item)
        db.commit()
    return RedirectResponse("/admin/my-model", status_code=303)
```

### 3. Add a Sidebar Link (`base.html`)

```html
<span class="sb-section">My Section</span>
<a
  href="/admin/my-model"
  class="sb-link {% if active == 'mymodel' %}active{% endif %}"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- paste any inline SVG path here -->
  </svg>
  <span>My Model</span>
</a>
```

> **Icon source:** [heroicons.com](https://heroicons.com) — copy the SVG `<path>` into the template.

### 4. Create the Template (`templates/admin/mymodel.html`)

```html
{% extends "admin/base.html" %} {% block title %}My Model{% endblock %} {% block
breadcrumb %}My Model{% endblock %} {% block page_title %}My Model{% endblock %}
{% block header_actions %}
<a href="/admin/my-model/new" class="btn btn-primary">
  <svg><!-- plus icon --></svg>
  New Item
</a>
{% endblock %} {% block content %}
<div class="card">
  <div class="card-head">
    <div class="card-title">All Items</div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {% for item in items %}
        <tr>
          <td class="mono">{{ item.id }}</td>
          <td>{{ item.name }}</td>
          <td>
            <div class="table-actions">
              <form
                method="post"
                action="/admin/my-model/{{ item.id }}/delete"
                onsubmit="return confirm('Delete?')"
              >
                <button class="btn btn-danger-soft btn-sm">Delete</button>
              </form>
            </div>
          </td>
        </tr>
        {% else %}
        <tr class="empty-row">
          <td colspan="3">No items yet.</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>
</div>
{% endblock %}
```

---

## Adding Authentication

FastAPI supports HTTP Basic Auth. To protect all `/admin` routes:

```python
# main.py
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
        raise HTTPException(
            status_code=401,
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials

# Add to each admin route:
@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    _=Depends(require_admin),        # ← add this
    db: Session = Depends(get_db),
):
    ...
```

---

## Flash Messages

To pass a flash message after a redirect, use query params:

```python
# In a route after a mutation:
return RedirectResponse("/admin/labs?msg=Lab+created&msg_type=success", status_code=303)
```

Then update the route to accept and forward them:

```python
@app.get("/admin/labs", response_class=HTMLResponse)
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

`base.html` already renders `msg` and `msg_type` automatically.

---

## Running Locally (Without Docker)

```bash
# 1. Install dependencies
pip install -r server/requirements.txt

# 2. Set your local DB URL
$env:DATABASE_URL = "mysql+pymysql://user:pass@localhost:3306/campus404"

# 3. Start dev server (auto-reload on file changes)
uvicorn main:app --reload --port 8000

# 4. Open in browser
# http://localhost:8000/admin
```
