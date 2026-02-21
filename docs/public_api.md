# Public API — Level Data

**Route:** `GET /levels`
**External URL (via Nginx):** `GET /api/levels`
**Router file:** `server/routers/api.py`
**Auth:** None (public)
**Content-Type:** `application/json`

---

## Purpose

Returns all **published** levels for the React frontend to render. Excludes sensitive fields (`expected_output`, `official_solution`) to prevent students from reading answers through the browser's network tab.

---

## Pydantic Schema — `LevelPublicResponse`

```python
class LevelPublicResponse(BaseModel):
    id:           int
    title:        str
    lab_id:       int
    order_number: int
    broken_code:  Optional[str] = None
    hint_text:    Optional[str] = None
    repo_link:    Optional[str] = None  # null if not set OR threshold not reached

    class Config:
        from_attributes = True  # SQLAlchemy ORM → Pydantic
```

**Deliberately excluded:**

- `expected_output` — used server-side for grading only
- `official_solution` — revealed only after passing, never sent raw
- `is_published` — backend concern, irrelevant to the client

---

## Query Logic

```python
db.query(Level)
  .filter(Level.is_published == True)
  .order_by(Level.lab_id, Level.order_number)
```

Only published levels are returned. Order respects the lab grouping and the admin-set sequence.

---

## Example Response

```json
[
  {
    "id": 1,
    "title": "Fix the Addition Bug",
    "lab_id": 1,
    "order_number": 1,
    "broken_code": "def add(a, b):\n    return a - b",
    "hint_text": "Check the operator.",
    "repo_link": null
  }
]
```

---

## Health Check

`GET /` (external: `GET /api/`)

```json
{ "message": "Campus404 Backend is Running!" }
```

---

## Repo Link — Unlock Logic

The `repo_link` field is safe to return even when locked — the **frontend** is responsible for hiding/showing it based on the student's attempt count. The backend just returns whatever is stored.

Game engine pattern (to implement in the Judge0 callback):

```python
from settings_seed import get_setting

threshold = int(get_setting(db, "max_fail_unlock", "5"))
progress  = db.query(UserProgress).filter_by(user_id=uid, level_id=lid).first()

repo_unlocked = (
    progress is not None and
    progress.failed_attempts >= threshold and
    level.repo_link is not None
)
```

---

## Adding More Public Endpoints

Follow the same pattern in `server/routers/api.py`:

1. Define a `*PublicResponse` Pydantic model — only include safe fields
2. Add `class Config: from_attributes = True`
3. Register with `@router.get("/your-route", response_model=List[YourPublicResponse])`
4. Frontend fetches `/api/your-route` — Nginx strips `/api/` → backend receives `/your-route`
