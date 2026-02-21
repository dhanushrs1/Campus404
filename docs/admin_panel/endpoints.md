# API Endpoints — Campus404 Admin Panel

All routes return `text/html` (Jinja2 rendered pages).  
Mutation routes (POST) respond with **HTTP 303 redirect** on success.  
Base path: `http://localhost:8000`

---

## Dashboard

| Method | Path     | Response       |
| ------ | -------- | -------------- |
| `GET`  | `/admin` | Dashboard page |

**Template context:**

```python
{
  "active": "dashboard",
  "user_count": int,
  "lab_count": int,
  "level_count": int,
  "submission_count": int,
  "badge_count": int,
  "recent_submissions": list[Submission],  # latest 8, desc by timestamp
}
```

---

## Users

| Method | Path                                  | Description        |
| ------ | ------------------------------------- | ------------------ |
| `GET`  | `/admin/users`                        | List all users     |
| `POST` | `/admin/users/{user_id}/toggle-admin` | Toggle `is_admin`  |
| `POST` | `/admin/users/{user_id}/toggle-ban`   | Toggle `is_banned` |

**Path params:** `user_id: int`  
**Redirect on POST:** `303 → /admin/users`

**Template context (`users.html`):**

```python
{ "active": "users", "users": list[User] }
```

---

## Labs

| Method | Path                          | Description   |
| ------ | ----------------------------- | ------------- |
| `GET`  | `/admin/labs`                 | List all labs |
| `GET`  | `/admin/labs/new`             | New lab form  |
| `POST` | `/admin/labs/create`          | Create lab    |
| `GET`  | `/admin/labs/{lab_id}/edit`   | Edit lab form |
| `POST` | `/admin/labs/{lab_id}/update` | Update lab    |
| `POST` | `/admin/labs/{lab_id}/delete` | Delete lab    |

**Path params:** `lab_id: int`  
**Redirect on POST:** `303 → /admin/labs`

**Form fields (create & update):**

| Field         | Type  | Required |
| ------------- | ----- | -------- |
| `name`        | `str` | ✅       |
| `description` | `str` | ❌       |

**Template context (`lab_form.html`):**

```python
{
  "active": "labs",
  "lab": Lab | None,   # None = create mode
  "action": str,       # POST target URL
}
```

---

## Levels

| Method | Path                              | Description     |
| ------ | --------------------------------- | --------------- |
| `GET`  | `/admin/levels`                   | List all levels |
| `GET`  | `/admin/levels/new`               | New level form  |
| `POST` | `/admin/levels/create`            | Create level    |
| `GET`  | `/admin/levels/{level_id}/edit`   | Edit level form |
| `POST` | `/admin/levels/{level_id}/update` | Update level    |
| `POST` | `/admin/levels/{level_id}/delete` | Delete level    |

**Path params:** `level_id: int`  
**Redirect on POST:** `303 → /admin/levels`

**Form fields (create & update):**

| Field               | Type              | Required | Notes                  |
| ------------------- | ----------------- | -------- | ---------------------- |
| `lab_id`            | `int`             | ✅       | Selected from dropdown |
| `order_number`      | `int`             | ✅       | Lower = unlocks first  |
| `title`             | `str`             | ✅       |                        |
| `broken_code`       | `str`             | ❌       | Shown to student       |
| `expected_output`   | `str`             | ❌       | Used for auto-grading  |
| `hint_text`         | `str`             | ❌       |                        |
| `official_solution` | `str`             | ❌       | Revealed after pass    |
| `is_published`      | `"on"` \| omitted | ❌       | Checkbox value         |

**Template context (`level_form.html`):**

```python
{
  "active": "levels",
  "level": Level | None,
  "labs": list[Lab],   # for the lab dropdown
  "action": str,
}
```

---

## Submissions

| Method | Path                 | Description                      |
| ------ | -------------------- | -------------------------------- |
| `GET`  | `/admin/submissions` | List all submissions (read-only) |

**Template context:**

```python
{
  "active": "submissions",
  "submissions": list[Submission],  # desc by timestamp
}
```

> No create / edit / delete — submissions are written by the game engine only.

---

## Badges

| Method | Path                              | Description     |
| ------ | --------------------------------- | --------------- |
| `GET`  | `/admin/badges`                   | List all badges |
| `GET`  | `/admin/badges/new`               | New badge form  |
| `POST` | `/admin/badges/create`            | Create badge    |
| `POST` | `/admin/badges/{badge_id}/delete` | Delete badge    |

**Path params:** `badge_id: int`  
**Redirect on POST:** `303 → /admin/badges`

**Form fields (create):**

| Field         | Type  | Required | Notes              |
| ------------- | ----- | -------- | ------------------ |
| `name`        | `str` | ✅       |                    |
| `required_xp` | `int` | ❌       | Default `0`        |
| `image_url`   | `str` | ❌       | Must be a full URL |

**Template context (`badge_form.html`):**

```python
{
  "active": "badges",
  "badge": Badge | None,
  "action": str,
}
```

---

## Root API

| Method | Path | Content-Type       | Description  |
| ------ | ---- | ------------------ | ------------ |
| `GET`  | `/`  | `application/json` | Health check |

**Response:**

```json
{ "message": "Campus404 Backend is Running!" }
```
