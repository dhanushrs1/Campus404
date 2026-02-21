# Backend Changelog

> New additions made after the initial admin panel build.
> See `admin_panel/` for the base documentation.

---

## `Level` model — `repo_link` field

**File:** `server/main.py` · **Table:** `levels`

```python
repo_link = Column(String(500), nullable=True)
```

- Optional GitHub / resource URL attached to a level
- Stored as `NULL` when not provided
- Exposed via `LevelPublicResponse` to the frontend
- **Unlock logic (game engine):** compare `UserProgress.failed_attempts` against the `max_fail_unlock` platform setting (default: `5`). When `failed_attempts >= max_fail_unlock`, reveal the link in the UI

---

## `PlatformSetting` model

**File:** `server/main.py` · **Table:** `platform_settings`

Key-value store for config values that admins can change at runtime without redeploying.

| Column        | Type             | Purpose                                                  |
| ------------- | ---------------- | -------------------------------------------------------- |
| `key`         | `String(100)` PK | Setting identifier                                       |
| `value`       | `Text`           | Current value (always a string)                          |
| `label`       | `String(200)`    | Human label shown in admin UI                            |
| `description` | `Text`           | Hint text below the field                                |
| `tab`         | `String(50)`     | Which settings tab: `gameplay` \| `platform` \| `access` |

### Default settings seeded on startup

| Key                   | Default                | Tab      |
| --------------------- | ---------------------- | -------- |
| `max_fail_unlock`     | `5`                    | gameplay |
| `xp_per_level`        | `100`                  | gameplay |
| `xp_per_first_try`    | `50`                   | gameplay |
| `platform_name`       | `Campus404`            | platform |
| `platform_tagline`    | `Learn by fixing bugs` | platform |
| `maintenance_mode`    | `false`                | platform |
| `allow_registrations` | `true`                 | access   |
| `ban_duration_days`   | `0`                    | access   |

Seed runs on every startup but skips keys that already exist — **safe to restart repeatedly**.

### Reading a setting in code

```python
from main import get_setting

threshold = int(get_setting(db, "max_fail_unlock", default="5"))
```

### Admin UI

`GET /admin/settings?tab=gameplay` — tabbed settings page. `POST /admin/settings` saves all fields in the active tab. The active tab is preserved on redirect via the `tab` query param.

---

## `apply_migrations()` — incremental schema migration

**File:** `server/main.py`, runs immediately after `Base.metadata.create_all()`

SQLAlchemy's `create_all()` never alters existing tables. `apply_migrations()` uses `INFORMATION_SCHEMA.COLUMNS` to safely `ALTER TABLE` only when a column is missing.

```python
migrations = [
    # (table, column, SQL definition)
    ("levels", "repo_link", "VARCHAR(500) NULL"),
]
```

**To add a future column:** append a tuple to the `migrations` list. The function is idempotent — running it on an already-migrated DB is a no-op.

---

## Nginx proxy routing

**File:** `infra/nginx.conf`

| Browser request        | Nginx rule                          | Backend receives           |
| ---------------------- | ----------------------------------- | -------------------------- |
| `/api/*`               | `proxy_pass http://backend:8000/;`  | Path with `/api/` stripped |
| `/*` (everything else) | `proxy_pass http://frontend:3000/;` | Original path              |

**Important:** because Nginx strips `/api/`, FastAPI routes must **not** include `/api/` in their path. Example: browser calls `/api/levels` → FastAPI route is `GET /levels`.
