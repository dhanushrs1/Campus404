# Changelog — Campus404

All major changes, additions, and fixes — newest first.

---

## [Unreleased / Active Development]

### Added

- Drag-and-drop **Challenge Builder** with React canvas (`challenge_form.html` + `admin_api.py`)
  - Content block types: Text, Code, Image, Hint
  - Rich text editor (Quill/prose) for instructions and description
  - File editor (Monaco-style) for starter code / multiple files
  - Test case manager (input/output, hidden toggle)
  - Saves via `POST /admin/challenges` and `PUT /admin/challenges/{id}`
- **`ChallengeFile`** model — multiple code files per challenge (`challenge_files` table)
- **`TestCase`** model — graded input/output pairs (`test_cases` table)
- **`content_blocks` JSON field** on `Challenge` — stores drag-and-drop builder state
- **Admin REST API** (`routers/admin_api.py`): `POST`, `GET`, `PUT /admin/challenges/{id}` — JSON endpoints for the Builder
- `challenge.editor_file_name` property returned in `ChallengePublicResponse`

---

## v0.7 — Frontend Workspace & Code Execution (Feb 2026)

### Added

- **`Workspace.jsx`** — 3-pane challenge arena (Briefing | Monaco Editor | Terminal)
  - Monaco Editor (`@monaco-editor/react`) with `vs-dark` theme
  - Output Console panel with "Run Code" button
  - Hint reveal (collapsible), Walkthrough Video link, Repo Link display
- **`POST /execute`** endpoint (`routers/api.py`) — forwards to Judge0
  - Subprocess fallback for Python when Judge0 crashes on WSL2 Docker Desktop
- **`GET /labs/{lab_id}/modules`** — nested modules + published challenges
- **`GET /challenges/{id}`** — single challenge detail endpoint
- `starter_code`, `hint_text`, `walkthrough_video_url`, `instructions` fields added to `ChallengePublicResponse`

---

## v0.6 — React Frontend Core Pages (Feb 2026)

### Added

- **Vite + React** client setup (`client/`)
- **React Router** with routes: `/`, `/login`, `/register`, `/dashboard`, `/labs`, `/labs/:labId`, `/workspace`
- **`Labs.jsx`** — fetches `/api/labs`, renders lab cards
- **`Lab.jsx`** — fetches `/api/labs/{labId}/modules`, renders module tree with challenge links
- **`Dashboard.jsx`** — student dashboard stub
- **`Login.jsx`** and **`Register.jsx`** — form stubs
- **`Header.jsx`**, **`Footer.jsx`**, **`AuthModal.jsx`** components
- Full CSS design system in `index.css` (CSS custom properties)
- Nginx reverse proxy config (`/api/*` → backend, `/*` → frontend)

---

## v0.5 — Backend Modular Refactor (Feb 2026)

### Changed

- **Monolithic `main.py` split into `routers/` directory** — 13 separate router modules:
  - `dashboard.py`, `users.py`, `labs.py`, `modules.py`, `challenges.py`
  - `submissions.py`, `badges.py`, `settings.py`, `media.py`, `api.py`
  - `leaderboard.py`, `analytics.py`, `syslogs.py`
- `templates_config.py` created — shared Jinja2 instance with global helpers
- `settings_seed.py` extracted — `DEFAULT_SETTINGS`, `seed_settings()`, `get_setting()`
- `database.py` updated — `apply_migrations()` added for safe column additions

---

## v0.4 — Media Library (Feb 2026)

### Added

- **`MediaItem`** model (`media_items` table)
- **Media Library** admin section (`routers/media.py`)
  - Multi-file upload via Pillow
  - Auto-generates `thumbnail`, `medium`, `large` image variants
  - `YYYY/MM/` folder organisation (configurable)
  - Duplicate filename handling (`-1`, `-2` suffix)
  - Edit metadata: title, alt text, caption, description
  - Delete: removes original + all resized variants from disk
- **`GET /admin/api/media`** — JSON endpoint for WYSIWYG image picker modal
- Media settings tab in Platform Settings (8 new keys)

---

## v0.3 — Gamification & Submissions (Feb 2026)

### Added

- **`Submission`** model (`submissions` table)
- **`UserProgress`** model (`user_progress` table)
- **`Badge`** model (`badges` table)
- **Submissions admin** (`/admin/submissions`) — filter by user/challenge/status, code playback
- **Badges admin** (`/admin/badges`) — CRUD for achievement badges
- **Leaderboard** (`/admin/leaderboard`) — users ranked by `total_xp`
- **Analytics** (`/admin/analytics`) — per-challenge pass rate, difficulty labels
- **System Logs** (`/admin/logs`) — Docker SDK log viewer for all containers
- `is_admin`, `is_banned`, `total_xp` fields on User
- User detail page with progress tracking and current challenge detection
- XP adjust form and password reset in user detail

---

## v0.2 — Platform Settings (Feb 2026)

### Added

- **`PlatformSetting`** model (`platform_settings` table)
- **Settings admin** (`/admin/settings`) — tabbed UI: Gameplay / Platform / Access / Media
- `settings_seed.py` with 18 default settings
- `get_setting()` helper for reading settings in Python code
- `judge0_api_url` setting — makes Judge0 URL hot-configurable
- Dashboard health check for DB and Judge0 using settings

---

## v0.1 — Core Content CRUD (Feb 2026)

### Added

- FastAPI backend with SQLAlchemy + MySQL
- **`User`**, **`Lab`**, **`Module`**, **`Challenge`** models
- Admin panel:
  - Dashboard with count metrics
  - Labs CRUD
  - Modules CRUD
  - Challenges CRUD (pre-Builder era, basic form)
  - Users list, toggle admin/ban
- **Public API** (`routers/api.py`):
  - `GET /` — health check
  - `GET /challenges` — all published challenges
  - `GET /labs` — all labs
- Jinja2 template system
- Docker Compose setup (backend + frontend + MySQL + Judge0 + Nginx)
- `database.py` with retry connection logic for Docker race condition
