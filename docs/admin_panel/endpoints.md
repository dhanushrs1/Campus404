# API Endpoints Reference — Campus404

> All endpoints are served by the FastAPI backend.
> **Nginx routes**: `GET/POST /api/*` → strips `/api` prefix → FastAPI receives the path without `/api`.
>
> Base URL (internal): `http://campus_backend:8000`  
> Base URL (via proxy): `http://localhost` (port 80 in production, port 3000 in dev via Nginx)

---

## Public API (React Frontend)

These endpoints are consumed by the React app and are **publicly accessible** (no auth currently).

### `GET /`

Health check.

**Response:**

```json
{ "message": "Campus404 Backend is Running!" }
```

---

### `GET /challenges`

Returns all **published** challenges, ordered by `module_id` then `order_number`.

**Response:** `Array<ChallengePublicResponse>`

```json
[
  {
    "id": 1,
    "title": "Fix the Off-By-One Error",
    "module_id": 2,
    "order_number": 1,
    "description": "<p>Context HTML...</p>",
    "editor_file_name": "main.py",
    "instructions": "<p>Fix the loop...</p>",
    "starter_code": "for i in range(0, 10):\n    ...",
    "hint_text": "Check the loop range.",
    "walkthrough_video_url": null,
    "repo_link": null
  }
]
```

> 🔒 `official_solution` and `TestCase.expected_output` are **never returned** to prevent cheating.

---

### `GET /challenges/{challenge_id}`

Returns a single published challenge by ID.

**Path params:** `challenge_id: int`

**Response:** `ChallengePublicResponse` (same schema as above)

**Errors:**

- `404` — Challenge not found or not published.

---

### `GET /labs`

Returns all labs, ordered by `order_number`.

**Response:**

```json
[
  {
    "id": 1,
    "name": "Python Fundamentals",
    "description": "...",
    "order_number": 1
  }
]
```

---

### `GET /labs/{lab_id}/modules`

Returns all modules and their **nested published challenges** for a specific lab.

**Path params:** `lab_id: int`

**Response:**

```json
[
  {
    "id": 1,
    "title": "Variables & Types",
    "lab_id": 1,
    "order_number": 1,
    "description": null,
    "challenges": [ { "id": 1, "title": "Fix the Loop", ... } ]
  }
]
```

**Errors:**

- `404` — Lab not found.

---

### `POST /execute`

Executes code against the Judge0 sandbox.

**Request body:**

```json
{
  "source_code": "print('Hello World')",
  "language_id": 71
}
```

| Field         | Type   | Default  | Notes                              |
| ------------- | ------ | -------- | ---------------------------------- |
| `source_code` | string | required | Code to execute                    |
| `language_id` | int    | `71`     | Judge0 language ID (71 = Python 3) |

**Response:**

```json
{ "output": "Hello World\n" }
```

**Fallback behavior:** If Judge0 returns an Internal Error for Python (language_id 71), the backend executes the code locally using `subprocess` with a 5-second timeout.

**Errors:**

- `500` — Execution failed; `detail` contains the error message.

---

## Admin Panel Endpoints (HTML Pages)

These serve server-rendered HTML templates via Jinja2. They are intended for admin use.

### Dashboard

| Method | Path     | Description                                                                                                        |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/admin` | Dashboard: metrics (users, labs, challenges, submissions, badges), system health (DB + Judge0), recent submissions |

---

### Users

| Method | Path                                    | Description                                          |
| ------ | --------------------------------------- | ---------------------------------------------------- |
| `GET`  | `/admin/users`                          | List all users                                       |
| `GET`  | `/admin/users/{user_id}`                | User detail: profile, progress, current challenge    |
| `POST` | `/admin/users/{user_id}/toggle-admin`   | Toggle `is_admin` flag                               |
| `POST` | `/admin/users/{user_id}/toggle-ban`     | Toggle `is_banned` flag                              |
| `POST` | `/admin/users/{user_id}/adjust-xp`      | Adjust `total_xp` by a delta (form: `xp_delta: int`) |
| `POST` | `/admin/users/{user_id}/reset-password` | Reset password (form: `new_password: str`)           |

---

### Labs

| Method | Path                          | Description                                              |
| ------ | ----------------------------- | -------------------------------------------------------- |
| `GET`  | `/admin/labs`                 | List all labs with module counts                         |
| `GET`  | `/admin/labs/new`             | Blank lab creation form                                  |
| `POST` | `/admin/labs/create`          | Create lab (form: `name`, `description`, `order_number`) |
| `GET`  | `/admin/labs/{lab_id}/edit`   | Edit form pre-filled with existing data                  |
| `POST` | `/admin/labs/{lab_id}/update` | Update lab                                               |
| `POST` | `/admin/labs/{lab_id}/delete` | Delete lab (cascades to modules and challenges)          |

---

### Modules

| Method | Path                                | Query Params  | Description                                                            |
| ------ | ----------------------------------- | ------------- | ---------------------------------------------------------------------- |
| `GET`  | `/admin/modules`                    | `lab_id: int` | List modules for a lab (redirects to /admin/labs if no lab_id)         |
| `GET`  | `/admin/modules/new`                | `lab_id: int` | New module form                                                        |
| `POST` | `/admin/modules/create`             | —             | Create module (form: `lab_id`, `order_number`, `title`, `description`) |
| `GET`  | `/admin/modules/{module_id}/edit`   | —             | Edit form                                                              |
| `POST` | `/admin/modules/{module_id}/update` | —             | Update module                                                          |
| `POST` | `/admin/modules/{module_id}/delete` | —             | Delete module                                                          |

---

### Challenges (UI)

| Method | Path                                      | Query Params     | Description                                |
| ------ | ----------------------------------------- | ---------------- | ------------------------------------------ |
| `GET`  | `/admin/challenges`                       | `module_id: int` | List challenges for a module               |
| `GET`  | `/admin/challenges/new`                   | `module_id: int` | Open drag-and-drop Challenge Builder (new) |
| `GET`  | `/admin/challenges/{challenge_id}/edit`   | —                | Open Challenge Builder (edit existing)     |
| `POST` | `/admin/challenges/{challenge_id}/delete` | —                | Delete challenge                           |

> **Note:** Creating and updating challenges goes through the **Admin REST API** (below), not raw form POSTs. The Builder UI calls `fetch()` to `POST /admin/challenges` or `PUT /admin/challenges/{id}`.

---

### Admin REST API — Challenge Builder

These are **JSON REST endpoints** that power the drag-and-drop Challenge Builder frontend.
All endpoints are prefixed with `/admin/challenges`.

| Method | Path                     | Description                                          |
| ------ | ------------------------ | ---------------------------------------------------- |
| `POST` | `/admin/challenges`      | Create challenge with files and test cases           |
| `GET`  | `/admin/challenges/{id}` | Get full challenge data including files + test cases |
| `PUT`  | `/admin/challenges/{id}` | Update challenge (replaces all files and test cases) |

**POST/PUT Request Body Schema:**

```json
{
  "title": "Fix the Loop",
  "module_id": 1,
  "order_number": 3,
  "description": "Story/context HTML string",
  "environment": "standard_script",
  "content_blocks": [{ "type": "text", "content": "..." }],
  "files": [
    {
      "name": "main.py",
      "language": "python",
      "content": "# starter code here",
      "is_entry_point": true
    }
  ],
  "test_cases": [
    {
      "input_data": "5",
      "expected_output": "25",
      "is_hidden": false
    }
  ]
}
```

**Response:** Full `ChallengeResponse` including `id`, `files[].id`, `test_cases[].id`.

---

### Submissions

| Method | Path                                          | Query Params                           | Description                                            |
| ------ | --------------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| `GET`  | `/admin/submissions`                          | `user_id?`, `challenge_id?`, `status?` | List all submissions with optional filters             |
| `GET`  | `/admin/submissions/{submission_id}/playback` | —                                      | View a specific submission's code (read-only playback) |

---

### Badges

| Method | Path                              | Description                                                            |
| ------ | --------------------------------- | ---------------------------------------------------------------------- |
| `GET`  | `/admin/badges`                   | List all badges ordered by `required_xp`                               |
| `GET`  | `/admin/badges/new`               | New badge form                                                         |
| `POST` | `/admin/badges/create`            | Create badge (form: `name`, `description`, `image_url`, `required_xp`) |
| `GET`  | `/admin/badges/{badge_id}/edit`   | Edit form                                                              |
| `POST` | `/admin/badges/{badge_id}/update` | Update badge                                                           |
| `POST` | `/admin/badges/{badge_id}/delete` | Delete badge                                                           |

---

### Settings

| Method | Path              | Query Params                 | Description                         |
| ------ | ----------------- | ---------------------------- | ----------------------------------- |
| `GET`  | `/admin/settings` | `tab?` (default: `gameplay`) | Show settings grouped by tab        |
| `POST` | `/admin/settings` | —                            | Save all changed values (form body) |

---

### Media Library

| Method | Path                            | Query Params        | Description                                                         |
| ------ | ------------------------------- | ------------------- | ------------------------------------------------------------------- |
| `GET`  | `/admin/media`                  | `q?` (search query) | Media library gallery; supports search by title/filename            |
| `POST` | `/admin/media/upload`           | —                   | Upload one or more images (multipart form, field: `files`)          |
| `GET`  | `/admin/media/{item_id}/edit`   | —                   | Edit media metadata                                                 |
| `POST` | `/admin/media/{item_id}/update` | —                   | Save metadata (`title`, `alt_text`, `caption`, `description`)       |
| `POST` | `/admin/media/{item_id}/delete` | —                   | Delete media item (removes original + resized files from disk + DB) |
| `GET`  | `/admin/api/media`              | `q?`                | **JSON** — returns media list for WYSIWYG Image Picker modal        |

**Upload behaviour:**

- Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `image/bmp`, `image/tiff`
- Files are sanitised (alphanumeric + `.-_`) and lowercased
- Pillow generates `thumbnail`, `medium`, and `large` variants automatically
- Sizes and dimensions are configurable via Platform Settings (media tab)
- Files organised into `YYYY/MM/` subfolders (configurable)

---

### Leaderboard

| Method | Path                 | Description                           |
| ------ | -------------------- | ------------------------------------- |
| `GET`  | `/admin/leaderboard` | Users ranked by `total_xp` descending |

---

### Analytics

| Method | Path               | Description                                                                                   |
| ------ | ------------------ | --------------------------------------------------------------------------------------------- |
| `GET`  | `/admin/analytics` | Level difficulty stats: pass rate per challenge, difficulty classification (easy/medium/hard) |

**Difficulty classification:**
| Pass Rate | Label |
|-----------|-------|
| ≥ 60% | `easy` |
| 20–59% | `medium` |
| < 20% | `hard` |
| No data | `no_data` |
| ≥ 10 attempts, 0 passes | ⚠️ Warn flag |

---

### System Logs

| Method | Path              | Query Params                         | Description                                 |
| ------ | ----------------- | ------------------------------------ | ------------------------------------------- |
| `GET`  | `/admin/logs`     | —                                    | Log viewer page (Docker socket based)       |
| `GET`  | `/admin/logs/api` | `container?`, `tail?` (default: 200) | **JSON** — last N log lines for a container |

**Available containers:**

| Container name          | Label                 |
| ----------------------- | --------------------- |
| `campus_backend`        | Backend API Server    |
| `campus_frontend`       | Frontend Vite Server  |
| `campus_sandbox_api`    | Judge0 Server API     |
| `campus_sandbox_worker` | Judge0 Worker         |
| `campus_db`             | MySQL Database        |
| `campus_nginx`          | Nginx Proxy           |
| `campus_sandbox_db`     | PostgreSQL Sandbox DB |
| `campus_sandbox_redis`  | Redis Sandbox Queue   |
