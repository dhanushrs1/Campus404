# Data Models — Campus404

> All models live in `server/models.py`. The database is **MySQL 8** managed by SQLAlchemy ORM.
> New columns are added via `apply_migrations()` in `database.py` — never drop/recreate tables.

---

## Entity Relationship Overview

```
Lab ──< Module ──< Challenge ──< ChallengeFile
                            ──< TestCase
                            ──< Submission ──> User
                            ──< UserProgress ──> User

User ──< Submission
User ──< UserProgress

Badge          (standalone, XP thresholds)
PlatformSetting (key-value config store)
MediaItem       (uploaded files/images)
```

---

## Model Reference

### `User`

**Table:** `users`

| Column       | Type        | Constraints   | Notes                 |
| ------------ | ----------- | ------------- | --------------------- |
| `id`         | Integer     | PK            | Auto-increment        |
| `username`   | String(50)  | Unique        | Login identifier      |
| `email`      | String(255) | Nullable      | Optional email        |
| `total_xp`   | Integer     | Default 0     | Accumulated XP        |
| `is_admin`   | Boolean     | Default False | Admin panel access    |
| `is_banned`  | Boolean     | Default False | Blocks student access |
| `created_at` | DateTime    | UTC default   | Registration time     |

**Relationships:**

- `progress` → List of `UserProgress` records
- `submissions` → List of `Submission` records

---

### `Lab`

**Table:** `labs`

| Column         | Type        | Constraints | Notes                      |
| -------------- | ----------- | ----------- | -------------------------- |
| `id`           | Integer     | PK          |                            |
| `name`         | String(100) | Unique      | e.g. "Python Fundamentals" |
| `description`  | Text        |             | Shown on Lab card          |
| `order_number` | Integer     | Default 0   | Sort order in UI           |

**Relationships:**

- `modules` → List of `Module` records

---

### `Module`

**Table:** `modules`

| Column         | Type        | Constraints  | Notes                    |
| -------------- | ----------- | ------------ | ------------------------ |
| `id`           | Integer     | PK           |                          |
| `lab_id`       | Integer     | FK → labs.id | Parent lab               |
| `order_number` | Integer     |              | Sort order within lab    |
| `title`        | String(100) |              | e.g. "Variables & Types" |
| `description`  | Text        | Nullable     |                          |

**Relationships:**

- `lab` → Parent `Lab`
- `challenges` → List of `Challenge` records

---

### `Challenge`

**Table:** `challenges`

The central content model. Each challenge is a coding exercise inside a module.

| Column              | Type        | Constraints               | Notes                                          |
| ------------------- | ----------- | ------------------------- | ---------------------------------------------- |
| `id`                | Integer     | PK                        |                                                |
| `module_id`         | Integer     | FK → modules.id           | Parent module                                  |
| `order_number`      | Integer     |                           | Sort order within module                       |
| `title`             | String(100) |                           | e.g. "Fix the Loop"                            |
| `description`       | Text        | Nullable                  | Rich HTML context/story                        |
| `environment`       | String(50)  | Default "standard_script" | Execution env type                             |
| `content_blocks`    | JSON        | Default `[]`              | Drag-and-drop builder blocks                   |
| `official_solution` | Text        |                           | **Never exposed to students via public API**   |
| `is_published`      | Boolean     | Default False             | Only published challenges appear in public API |
| `repo_link`         | String(500) | Nullable                  | Unlocked after N failed attempts               |

> **Security note:** `official_solution` and `TestCase.expected_output` are filtered out from the `ChallengePublicResponse` Pydantic schema to prevent cheating via `/api/challenges`.

**Relationships:**

- `module` → Parent `Module`
- `user_progress` → List of `UserProgress`
- `submissions` → List of `Submission`
- `files` → List of `ChallengeFile` (cascade delete)
- `test_cases` → List of `TestCase` (cascade delete)

---

### `ChallengeFile`

**Table:** `challenge_files`

Starter code files attached to a challenge. Multiple files are supported per challenge.

| Column           | Type        | Constraints        | Notes                                       |
| ---------------- | ----------- | ------------------ | ------------------------------------------- |
| `id`             | Integer     | PK                 |                                             |
| `challenge_id`   | Integer     | FK → challenges.id |                                             |
| `name`           | String(255) |                    | Filename shown in editor tab e.g. `main.py` |
| `language`       | String(50)  |                    | e.g. `python`, `javascript`                 |
| `content`        | Text        |                    | The actual code (starter or broken code)    |
| `is_entry_point` | Boolean     | Default False      | Which file gets executed                    |

---

### `TestCase`

**Table:** `test_cases`

Input/output pairs used to grade submissions.

| Column            | Type    | Constraints        | Notes                              |
| ----------------- | ------- | ------------------ | ---------------------------------- |
| `id`              | Integer | PK                 |                                    |
| `challenge_id`    | Integer | FK → challenges.id |                                    |
| `input_data`      | Text    |                    | stdin input for the program        |
| `expected_output` | Text    |                    | **Hidden from public API**         |
| `is_hidden`       | Boolean | Default False      | Hidden tests not shown to students |

---

### `Submission`

**Table:** `submissions`

Tracks every time a student submits code for a challenge.

| Column           | Type       | Constraints        | Notes                         |
| ---------------- | ---------- | ------------------ | ----------------------------- |
| `id`             | Integer    | PK                 |                               |
| `user_id`        | Integer    | FK → users.id      |                               |
| `challenge_id`   | Integer    | FK → challenges.id |                               |
| `submitted_code` | Text       |                    | The code submitted            |
| `status`         | String(50) |                    | `passed` / `failed` / `error` |
| `timestamp`      | DateTime   | UTC default        | When submitted                |

---

### `Badge`

**Table:** `badges`

Achievement badges awarded based on XP milestones.

| Column        | Type        | Constraints | Notes                           |
| ------------- | ----------- | ----------- | ------------------------------- |
| `id`          | Integer     | PK          |                                 |
| `name`        | String(100) |             | e.g. "Bug Hunter"               |
| `description` | Text        | Nullable    | Tooltip text                    |
| `image_url`   | String(255) |             | Badge icon URL                  |
| `required_xp` | Integer     |             | XP threshold to earn this badge |

---

### `UserProgress`

**Table:** `user_progress`

Junction table tracking which challenges a user has attempted/completed.

| Column            | Type    | Constraints        | Notes                              |
| ----------------- | ------- | ------------------ | ---------------------------------- |
| `id`              | Integer | PK                 |                                    |
| `user_id`         | Integer | FK → users.id      |                                    |
| `challenge_id`    | Integer | FK → challenges.id |                                    |
| `is_completed`    | Boolean | Default False      | True when status = "passed"        |
| `failed_attempts` | Integer | Default 0          | Counter; triggers repo_link reveal |

---

### `PlatformSetting`

**Table:** `platform_settings`

Key-value configuration store. All settings are seeded on startup by `settings_seed.py`.

| Column        | Type        | Constraints | Notes                                                         |
| ------------- | ----------- | ----------- | ------------------------------------------------------------- |
| `key`         | String(100) | PK          | Unique setting key                                            |
| `value`       | Text        | Not Null    | Current value                                                 |
| `label`       | String(200) |             | Human-readable label in admin UI                              |
| `description` | Text        |             | Helper text in admin settings form                            |
| `tab`         | String(50)  |             | Groups settings: `gameplay` / `platform` / `access` / `media` |

See [settings.md](../settings.md) for all available keys and defaults.

---

### `MediaItem`

**Table:** `media_items`

Uploaded images/files managed by the Media Library.

| Column          | Type        | Constraints  | Notes                                                                                                 |
| --------------- | ----------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| `id`            | Integer     | PK           |                                                                                                       |
| `filename`      | String(255) | Unique       | Sanitised disk filename                                                                               |
| `original_name` | String(255) |              | Original upload filename                                                                              |
| `file_path`     | String(500) |              | Relative URL: `/static/uploads/YYYY/MM/file.jpg`                                                      |
| `file_size`     | BigInteger  | Default 0    | Size in bytes                                                                                         |
| `mime_type`     | String(100) |              | e.g. `image/jpeg`                                                                                     |
| `title`         | String(255) | Default ""   | Editable display title                                                                                |
| `alt_text`      | String(500) | Default ""   | Accessibility alt text                                                                                |
| `caption`       | Text        | Default ""   | Image caption                                                                                         |
| `description`   | Text        | Default ""   | Admin notes                                                                                           |
| `metadata_json` | Text        | Default "{}" | JSON: `{ "width": N, "height": N, "sizes": { "thumbnail": {...}, "medium": {...}, "large": {...} } }` |
| `uploaded_at`   | DateTime    | UTC default  | Upload timestamp                                                                                      |

**Responsive sizes stored in `metadata_json.sizes`:**

```json
{
  "width": 1920,
  "height": 1080,
  "sizes": {
    "thumbnail": {
      "file": "img-150x150.jpg",
      "width": 150,
      "height": 150,
      "file_path": "/static/uploads/2026/02/img-150x150.jpg"
    },
    "medium": {
      "file": "img-300x169.jpg",
      "width": 300,
      "height": 169,
      "file_path": "/static/uploads/2026/02/img-300x169.jpg"
    },
    "large": {
      "file": "img-1024x576.jpg",
      "width": 1024,
      "height": 576,
      "file_path": "/static/uploads/2026/02/img-1024x576.jpg"
    }
  }
}
```
