# API Endpoints — Campus404 Admin Panel

All routes return `text/html` (Jinja2 rendered pages).
Mutation routes (POST) respond with **HTTP 303 redirect** on success.
Base path: `http://localhost:8000`

Each feature lives in its own router file under `server/routers/`.

---

## Dashboard

**Router:** `routers/dashboard.py`

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

**Router:** `routers/users.py`

| Method | Path                                  | Description        |
| ------ | ------------------------------------- | ------------------ |
| `GET`  | `/admin/users`                        | List all users     |
| `POST` | `/admin/users/{user_id}/toggle-admin` | Toggle `is_admin`  |
| `POST` | `/admin/users/{user_id}/toggle-ban`   | Toggle `is_banned` |

**Path params:** `user_id: int`
**Redirect on POST:** `303 → /admin/users`

---

## Labs

**Router:** `routers/labs.py`

| Method | Path                          | Description   |
| ------ | ----------------------------- | ------------- |
| `GET`  | `/admin/labs`                 | List all labs |
| `GET`  | `/admin/labs/new`             | New lab form  |
| `POST` | `/admin/labs/create`          | Create lab    |
| `GET`  | `/admin/labs/{lab_id}/edit`   | Edit lab form |
| `POST` | `/admin/labs/{lab_id}/update` | Update lab    |
| `POST` | `/admin/labs/{lab_id}/delete` | Delete lab    |

**Form fields (create & update):**

| Field         | Type  | Required |
| ------------- | ----- | -------- |
| `name`        | `str` | ✅       |
| `description` | `str` | ❌       |

---

## Levels

**Router:** `routers/levels.py`

| Method | Path                              | Description     |
| ------ | --------------------------------- | --------------- |
| `GET`  | `/admin/levels`                   | List all levels |
| `GET`  | `/admin/levels/new`               | New level form  |
| `POST` | `/admin/levels/create`            | Create level    |
| `GET`  | `/admin/levels/{level_id}/edit`   | Edit level form |
| `POST` | `/admin/levels/{level_id}/update` | Update level    |
| `POST` | `/admin/levels/{level_id}/delete` | Delete level    |

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
| `repo_link`         | `str`             | ❌       | GitHub/resource URL    |

---

## Submissions

**Router:** `routers/submissions.py`

| Method | Path                 | Description                      |
| ------ | -------------------- | -------------------------------- |
| `GET`  | `/admin/submissions` | List all submissions (read-only) |

> No create / edit / delete — submissions are written by the game engine only.

---

## Badges

**Router:** `routers/badges.py`

| Method | Path                              | Description     |
| ------ | --------------------------------- | --------------- |
| `GET`  | `/admin/badges`                   | List all badges |
| `GET`  | `/admin/badges/new`               | New badge form  |
| `POST` | `/admin/badges/create`            | Create badge    |
| `POST` | `/admin/badges/{badge_id}/delete` | Delete badge    |

**Form fields (create):**

| Field         | Type  | Required | Notes              |
| ------------- | ----- | -------- | ------------------ |
| `name`        | `str` | ✅       |                    |
| `required_xp` | `int` | ❌       | Default `0`        |
| `image_url`   | `str` | ❌       | Must be a full URL |

---

## Settings

**Router:** `routers/settings.py`

| Method | Path              | Description                                    |
| ------ | ----------------- | ---------------------------------------------- |
| `GET`  | `/admin/settings` | Tabbed settings page (query param: `?tab=...`) |
| `POST` | `/admin/settings` | Save settings for the current tab              |

**Available tabs:** `gameplay` · `platform` · `access` · `media`

**POST form fields:** any `PlatformSetting.key` whose value changed.
Special field `_tab` is read to preserve the active tab on redirect.

**GET template context:**

```python
{
  "active": "settings",
  "by_tab": dict[str, list[PlatformSetting]],  # settings grouped by tab
  "active_tab": str,
  "msg": str | None,
  "msg_type": "success" | "error",
}
```

---

## Media Library

**Router:** `routers/media.py`

| Method | Path                            | Description                                |
| ------ | ------------------------------- | ------------------------------------------ |
| `GET`  | `/admin/media`                  | Media library grid                         |
| `POST` | `/admin/media/upload`           | Upload one or more image files             |
| `GET`  | `/admin/media/{item_id}/edit`   | Edit metadata for a media item             |
| `POST` | `/admin/media/{item_id}/update` | Save title, alt text, caption, description |
| `POST` | `/admin/media/{item_id}/delete` | Delete file from disk + DB                 |

### Upload — multipart form

- **Field name:** `files` (multiple `UploadFile`)
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `image/bmp`, `image/tiff`
- **Auto-generates** thumbnail, medium, and large responsive copies using Pillow
- **Resize dimensions** are read live from `PlatformSetting` (`media_*` keys)
- **Folder organization:** when `media_organize=true`, files go into `static/uploads/YYYY/MM/`

### Upload response sizes

Pillow generates up to 3 sizes based on admin settings:

| Size name   | Setting keys                        | Default        | Strategy                                |
| ----------- | ----------------------------------- | -------------- | --------------------------------------- |
| `thumbnail` | `media_thumb_w` / `media_thumb_h`   | 150 × 150 px   | Hard crop if `media_thumb_crop=true`    |
| `medium`    | `media_medium_w` / `media_medium_h` | 300 × 300 px   | Fit inside box (aspect ratio preserved) |
| `large`     | `media_large_w` / `media_large_h`   | 1024 × 1024 px | Fit inside box (aspect ratio preserved) |

> Setting any dimension to `0` disables that size from being generated.

### Delete behaviour

- Removes the **original file** from disk
- Removes **all responsive size files** listed in `metadata_json.sizes`
- Deletes the **DB record**
- Redirects `303 → /admin/media?msg=Deleted`

### Search

`GET /admin/media?q=term` — filters by `title` or `original_name` (SQL `LIKE`).

### GET `/admin/media` template context:

```python
{
  "active": "media",
  "items": list[MediaItem],   # filtered + ordered by uploaded_at desc
  "total": int,               # total count (before filter)
  "q": str | None,
  "msg": str | None,
  "msg_type": "success" | "error",
}
```

---

## Public API

**Router:** `routers/api.py`

| Method | Path      | Content-Type       | Description                         |
| ------ | --------- | ------------------ | ----------------------------------- |
| `GET`  | `/`       | `application/json` | API health check                    |
| `GET`  | `/levels` | `application/json` | Published levels (safe for browser) |

> Browser calls `/api/levels` → Nginx strips `/api/` → FastAPI receives `/levels`.

See [`public_api.md`](../public_api.md) for full schema details.
