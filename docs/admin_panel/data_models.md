# Data Models — Campus404 Admin Panel

All models are defined in `server/main.py` via SQLAlchemy ORM.  
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

| Column              | Type        | Default | Notes                           |
| ------------------- | ----------- | ------- | ------------------------------- |
| `id`                | Integer     | —       | Primary Key                     |
| `lab_id`            | Integer     | —       | FK → `labs.id`                  |
| `order_number`      | Integer     | —       | Controls unlock sequence        |
| `title`             | String(100) | —       | Level title                     |
| `broken_code`       | Text        | —       | Buggy code shown to student     |
| `expected_output`   | String(200) | —       | Output used for grading         |
| `hint_text`         | Text        | —       | Optional nudge                  |
| `official_solution` | Text        | —       | Shown after pass                |
| `is_published`      | Boolean     | `False` | Hidden from students when False |

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

badges  (standalone — no FK relationships yet)
```
