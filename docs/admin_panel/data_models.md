# Data Models — Campus404 Admin Panel

All models are defined in `server/models.py` via SQLAlchemy ORM.
Tables are auto-created on startup: `Base.metadata.create_all(engine)`

---

## `users`

| Column      | Type       | Default | Notes             |
| ----------- | ---------- | ------- | ----------------- |
| `id`        | Integer    | —       | Primary Key       |
| `username`  | String(50) | —       | Unique            |
| `total_xp`  | Integer    | `0`     | Earned XP points  |
| `is_admin`  | Boolean    | `False` | Admin access flag |
| `is_banned` | Boolean    | `False` | Ban flag          |

**Relationships**

- `progress` → `UserProgress` (one-to-many)
- `submissions` → `Submission` (one-to-many)

---

## `labs`

| Column        | Type        | Default | Notes            |
| ------------- | ----------- | ------- | ---------------- |
| `id`          | Integer     | —       | Primary Key      |
| `name`        | String(100) | —       | Display name     |
| `description` | Text        | —       | Optional summary |

**Relationships**

- `levels` → `Level` (one-to-many)

---

## `levels`

| Column              | Type        | Default | Notes                            |
| ------------------- | ----------- | ------- | -------------------------------- |
| `id`                | Integer     | —       | Primary Key                      |
| `lab_id`            | Integer     | —       | FK → `labs.id`                   |
| `order_number`      | Integer     | —       | Controls unlock sequence         |
| `title`             | String(100) | —       | Level title                      |
| `broken_code`       | Text        | —       | Buggy code shown to student      |
| `expected_output`   | String(200) | —       | Output used for grading          |
| `hint_text`         | Text        | —       | Optional nudge                   |
| `official_solution` | Text        | —       | Shown after pass                 |
| `is_published`      | Boolean     | `False` | Hidden from students when False  |
| `repo_link`         | String(500) | `NULL`  | GitHub/resource URL (unlockable) |

> `repo_link` was added via `apply_migrations()` — safe for existing databases.

**Relationships**

- `lab` → `Lab` (many-to-one)
- `user_progress` → `UserProgress` (one-to-many)
- `submissions` → `Submission` (one-to-many)

---

## `submissions`

| Column           | Type       | Default | Notes                               |
| ---------------- | ---------- | ------- | ----------------------------------- |
| `id`             | Integer    | —       | Primary Key                         |
| `user_id`        | Integer    | —       | FK → `users.id`                     |
| `level_id`       | Integer    | —       | FK → `levels.id`                    |
| `submitted_code` | Text       | —       | Student's code                      |
| `status`         | String(50) | —       | `"Passed"` / `"Failed"` / `"Error"` |
| `timestamp`      | DateTime   | UTC now | Auto-set on insert                  |

**Relationships**

- `user` → `User` (many-to-one)
- `level` → `Level` (many-to-one)

> **Read-only in admin.** Created only by the game engine (Judge0 integration).

---

## `badges`

| Column        | Type        | Default | Notes               |
| ------------- | ----------- | ------- | ------------------- |
| `id`          | Integer     | —       | Primary Key         |
| `name`        | String(100) | —       | Badge display name  |
| `image_url`   | String(255) | —       | Optional image URL  |
| `required_xp` | Integer     | —       | XP needed to unlock |

---

## `user_progress`

| Column            | Type    | Default | Notes                   |
| ----------------- | ------- | ------- | ----------------------- |
| `id`              | Integer | —       | Primary Key             |
| `user_id`         | Integer | —       | FK → `users.id`         |
| `level_id`        | Integer | —       | FK → `levels.id`        |
| `is_completed`    | Boolean | `False` | Whether level is beaten |
| `failed_attempts` | Integer | `0`     | Attempt counter         |

**Relationships**

- `user` → `User` (many-to-one)
- `level` → `Level` (many-to-one)

---

## `platform_settings`

Key-value store for all platform-wide configuration. Admins change these at runtime without redeploying.

| Column        | Type           | Notes                                                      |
| ------------- | -------------- | ---------------------------------------------------------- |
| `key`         | String(100) PK | Setting identifier                                         |
| `value`       | Text           | Current value (always stored as string)                    |
| `label`       | String(200)    | Human-readable label shown in admin settings UI            |
| `description` | Text           | Helper text displayed below the field                      |
| `tab`         | String(50)     | Settings tab: `gameplay` / `platform` / `access` / `media` |

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
| `media_thumb_w`       | `150`                  | media    |
| `media_thumb_h`       | `150`                  | media    |
| `media_thumb_crop`    | `true`                 | media    |
| `media_medium_w`      | `300`                  | media    |
| `media_medium_h`      | `300`                  | media    |
| `media_large_w`       | `1024`                 | media    |
| `media_large_h`       | `1024`                 | media    |
| `media_organize`      | `true`                 | media    |

---

## `media_items`

Stores every uploaded file with rich WordPress-style metadata and responsive size references.

| Column          | Type        | Default | Notes                                             |
| --------------- | ----------- | ------- | ------------------------------------------------- |
| `id`            | Integer     | —       | Primary Key                                       |
| `filename`      | String(255) | —       | Unique disk filename (sanitized)                  |
| `original_name` | String(255) | —       | Original filename from the user's device          |
| `file_path`     | String(500) | —       | Relative URL: `/static/uploads/…`                 |
| `file_size`     | BigInteger  | `0`     | File size in bytes                                |
| `mime_type`     | String(100) | —       | e.g. `image/jpeg`                                 |
| `title`         | String(255) | `""`    | Admin-editable display title                      |
| `alt_text`      | String(500) | `""`    | Accessibility / SEO alt text                      |
| `caption`       | Text        | `""`    | Short caption for display                         |
| `description`   | Text        | `""`    | Internal note (not shown to students)             |
| `metadata_json` | Text        | `"{}"`  | JSON blob: original dimensions + responsive sizes |
| `uploaded_at`   | DateTime    | UTC now | Auto-set on insert                                |

### `metadata_json` structure

```json
{
  "width": 1920,
  "height": 1080,
  "sizes": {
    "thumbnail": {
      "file": "photo-150x150.jpg",
      "width": 150,
      "height": 150,
      "mime_type": "image/jpeg",
      "file_path": "/static/uploads/2026/02/photo-150x150.jpg"
    },
    "medium": { ... },
    "large":  { ... }
  }
}
```

> `metadata_json` was added via `apply_migrations()` — safe for existing databases.

---

## Entity Relationship Diagram

```
users ──────────────────┐
  │                     │
  │ one-to-many         │ one-to-many
  ▼                     ▼
user_progress      submissions
  │                     │
  │ many-to-one         │ many-to-one
  ▼                     ▼
levels ◄──── lab_id    levels
  │
  │ many-to-one
  ▼
labs

badges           (standalone — no FK relationships yet)
platform_settings (standalone key-value store)
media_items      (standalone — no FK relationships)
```
