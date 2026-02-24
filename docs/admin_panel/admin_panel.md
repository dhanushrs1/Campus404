# Admin Panel Guide — Campus404

> The admin panel is a **server-rendered Jinja2 application** accessible at `/admin`.
> It has no authentication currently — it is designed to be accessed on the local network or via VPN.

---

## Navigation

The sidebar contains these sections:

| Section     | Path                            | Description                               |
| ----------- | ------------------------------- | ----------------------------------------- |
| Dashboard   | `/admin`                        | System overview, metrics, recent activity |
| Users       | `/admin/users`                  | Manage all student accounts               |
| Labs        | `/admin/labs`                   | Top-level content containers              |
| Modules     | `/admin/modules?lab_id=N`       | Sections within a lab                     |
| Challenges  | `/admin/challenges?module_id=N` | Individual coding exercises               |
| Submissions | `/admin/submissions`            | All student code submissions              |
| Badges      | `/admin/badges`                 | Achievement badge management              |
| Leaderboard | `/admin/leaderboard`            | Students ranked by XP                     |
| Analytics   | `/admin/analytics`              | Challenge difficulty statistics           |
| Media       | `/admin/media`                  | Image/file upload library                 |
| Settings    | `/admin/settings`               | Platform configuration                    |
| Logs        | `/admin/logs`                   | Real-time Docker container logs           |

---

## Dashboard (`/admin`)

Displays:

- **Count cards**: Total users, admins, labs, challenges, submissions, badges
- **System health**: DB status (SELECT 1 ping), Judge0 status (`/about` ping)
- **Recent submissions**: Last 8 submissions with user, challenge, status, timestamp

---

## Users (`/admin/users`)

**List view:**

- All users in a table with: ID, username, email, XP, admin status, ban status, created date
- Action buttons per row: View, Toggle Admin, Toggle Ban

**Detail view (`/admin/users/{id}`):**

- User profile card (XP, status, joined date)
- Challenge progress table (completed vs. incomplete)
- "Currently stuck on" computed field (lowest incomplete challenge by order_number)
- **Adjust XP form**: Enter positive or negative integer to add/subtract XP
- **Reset password form**: Set a new hashed bcrypt password

---

## Labs → Modules → Challenges (Content Hierarchy)

Content is created top-down:

```
Lab  →  click "View Modules"  →  Module  →  click "View Challenges"  →  Challenge
```

### Labs (`/admin/labs`)

- List all labs with module counts
- Create / Edit / Delete
- Fields: `name` (unique), `description`, `order_number`

### Modules (`/admin/modules?lab_id=N`)

- List modules for a specific lab
- Create / Edit / Delete
- Fields: `lab_id`, `order_number`, `title`, `description`

### Challenges (`/admin/challenges?module_id=N`)

- List challenges for a specific module
- Delete a challenge
- **Create/Edit** opens the **Challenge Builder**

---

## Challenge Builder

The Challenge Builder is a **drag-and-drop WYSIWYG editor** that opens at:

- `GET /admin/challenges/new?module_id=N` (new)
- `GET /admin/challenges/{id}/edit` (edit)

### Builder Panels

**Left Panel — Content Blocks (Drag source)**  
Draggable block types:

- `Text Block` — Rich text editor (prose/instructions)
- `Code Block` — Syntax-highlighted code snippet
- `Image Block` — Image from Media Library
- `Hint Block` — Collapsed hint panel

**Center Panel — Canvas**

- Drop zone for blocks
- Blocks can be reordered by dragging
- Each block has an inline editor
- Has live preview of how the challenge will look

**Right Panel — Challenge Settings**

- Challenge Title
- Module selection
- Order number (auto-computed)
- Environment type (`standard_script`)
- Starter code / files
- Test cases (input/expected output, hidden toggle)
- Publish toggle

**Saving:** The Builder calls `POST /admin/challenges` (new) or `PUT /admin/challenges/{id}` (update) via `fetch()`, returns JSON.

---

## Submissions (`/admin/submissions`)

- Filter by: User, Challenge, Status (`passed` / `failed` / `error`)
- Shows: submission ID, username, challenge title, status badge, timestamp
- **Playback** button → `/admin/submissions/{id}/playback` — read-only code viewer

---

## Badges (`/admin/badges`)

- List ordered by `required_xp` (lowest first)
- CRUD: create/edit/delete
- Fields: `name`, `description`, `image_url`, `required_xp`

---

## Leaderboard (`/admin/leaderboard`)

- All users ranked by `total_xp` descending
- Tied XP → sorted alphabetically by username
- Shows rank, username, email, XP, badge count (future)

---

## Analytics (`/admin/analytics`)

Shows per-challenge statistics for all **published** challenges:

- Total submissions
- Total passes
- Pass rate (%)
- Difficulty label: `easy` / `medium` / `hard` / `no_data`
- ⚠️ Warning if ≥ 10 attempts with 0 passes (possible bad test case)

---

## Media Library (`/admin/media`)

A WordPress-inspired media manager.

**Gallery view:**

- Grid of uploaded images with thumbnail preview
- Search by title or filename
- Shows: filename, MIME type, file size, upload date

**Upload:**

- Drag or select multiple files
- Pillow auto-generates `thumbnail`, `medium`, and `large` variants
- Organized into `YYYY/MM/` folders (configurable in Settings)
- Duplicate filenames get `-1`, `-2` suffixes (WordPress-style)

**Edit (`/admin/media/{id}/edit`):**

- Update: title, alt text, caption, description
- View original dimensions and file path

**Delete:**

- Removes original file from disk
- Removes all Pillow-generated resized variants from disk
- Deletes DB record

**Image Picker (WYSIWYG):**

- `GET /admin/api/media` returns JSON for the Challenge Builder's image picker modal
- Supports `?q=` search filter

---

## Settings (`/admin/settings`)

Four tabs of configurable platform settings. See [settings.md](../settings.md) for full reference.

| Tab      | Settings                                                          |
| -------- | ----------------------------------------------------------------- |
| Gameplay | XP per level, XP per first try, max fails to unlock repo link     |
| Platform | Platform name, tagline, maintenance mode, starting XP, Judge0 URL |
| Access   | Allow registrations, ban duration                                 |
| Media    | Thumbnail/medium/large dimensions, crop mode, folder organisation |

---

## System Logs (`/admin/logs`)

Real-time log viewer powered by the **Docker SDK** (`docker.from_env()`).

- Select container from dropdown
- Set number of tail lines (default: 200)
- Logs auto-refresh by clicking "Fetch Logs"
- Falls back gracefully if Docker socket is not mounted

> **Requirement:** Docker socket must be mounted: `-v /var/run/docker.sock:/var/run/docker.sock`

---

## Template System

All admin templates live in `server/templates/admin/`.

| Template                   | Route                                                  |
| -------------------------- | ------------------------------------------------------ |
| `dashboard.html`           | `/admin`                                               |
| `users.html`               | `/admin/users`                                         |
| `user_detail.html`         | `/admin/users/{id}`                                    |
| `labs.html`                | `/admin/labs`                                          |
| `lab_form.html`            | `/admin/labs/new`, `/admin/labs/{id}/edit`             |
| `modules.html`             | `/admin/modules`                                       |
| `module_form.html`         | `/admin/modules/new`, `/admin/modules/{id}/edit`       |
| `challenges.html`          | `/admin/challenges`                                    |
| `challenge_form.html`      | `/admin/challenges/new`, `/admin/challenges/{id}/edit` |
| `submissions.html`         | `/admin/submissions`                                   |
| `submission_playback.html` | `/admin/submissions/{id}/playback`                     |
| `badges.html`              | `/admin/badges`                                        |
| `badge_form.html`          | `/admin/badges/new`, `/admin/badges/{id}/edit`         |
| `settings.html`            | `/admin/settings`                                      |
| `media.html`               | `/admin/media`                                         |
| `media_edit.html`          | `/admin/media/{id}/edit`                               |
| `leaderboard.html`         | `/admin/leaderboard`                                   |
| `analytics.html`           | `/admin/analytics`                                     |
| `logs.html`                | `/admin/logs`                                          |

All templates extend a shared `base.html` layout with the sidebar navigation.
Global Jinja2 helpers (e.g., `media_url()`) are registered in `templates_config.py`.
