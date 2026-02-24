# Frontend — Campus404

> The React frontend is a **Vite + React** single-page application.
> It communicates with the backend exclusively through the `/api/*` Nginx proxy.

---

## Tech Stack

| Library                                | Purpose                                |
| -------------------------------------- | -------------------------------------- |
| React 18                               | Component framework                    |
| React Router v6                        | Client-side routing                    |
| Monaco Editor (`@monaco-editor/react`) | VS Code–style code editor in Workspace |
| Vanilla CSS (CSS variables)            | Design system in `index.css`           |

---

## Routing

Defined in `src/App.jsx`:

| Route          | Component   | Description                                  |
| -------------- | ----------- | -------------------------------------------- |
| `/`            | `Home`      | Landing/marketing page                       |
| `/login`       | `Login`     | Login form                                   |
| `/register`    | `Register`  | Registration form                            |
| `/dashboard`   | `Dashboard` | Student dashboard                            |
| `/labs`        | `Labs`      | Lab selection grid                           |
| `/labs/:labId` | `Lab`       | Modules + challenges for a specific lab      |
| `/workspace`   | `Workspace` | 3-pane challenge arena (via `?challenge=ID`) |

---

## Pages

### `Home.jsx`

Landing page placeholder. Currently a minimal stub — full hero/marketing content pending.

---

### `Login.jsx`

Login form page.

- Fields: username, password
- Submits to backend (auth endpoint pending)
- Redirects to `/dashboard` on success (stub)

---

### `Register.jsx`

Registration form page.

- Fields: username, email, password, confirm password
- Submits to backend (auth endpoint pending)
- Redirects to `/login` on success (stub)

---

### `Dashboard.jsx`

Student dashboard.

- Displays user info, XP progress, recent activity
- Links to Labs
- Auth integration pending

---

### `Labs.jsx`

Lab selection grid.

- `GET /api/labs` on mount → renders lab cards
- Each card navigates to `/labs/:labId`
- Shows lab name, description

---

### `Lab.jsx`

Modules and challenges for a specific lab.

- Reads `:labId` from route params
- `GET /api/labs/{labId}/modules` on mount → renders modules with nested challenge lists
- Each challenge links to `/workspace?challenge={id}`
- Shows challenge status (completed / locked / available) — gamification pending

---

### `Workspace.jsx` ⭐

The main challenge arena — the most complex page.

**Layout:** 3-pane horizontal split

**Left pane (40%) — The Briefing:**

- Challenge title
- Context / Description (rich HTML, rendered with `dangerouslySetInnerHTML`)
- Task / Instructions (rich HTML)
- Collapsible Hint panel (if `hint_text` available)
- Walkthrough Video link (if `walkthrough_video_url` available)
- Official Solution / Repo link (if `repo_link` available — unlocked after N failures)
- Exit button (back to `/levels`)

**Right pane (60%) — The Canvas:**

_Top: Monaco Editor_

- Language: `python` (fixed currently)
- Theme: `vs-dark`
- File tab header showing `challenge.editor_file_name`
- User types/edits starter code

_Bottom (30vh): Output Console_

- "Run Code" button → `POST /api/execute` with `{ source_code, language_id: 71 }`
- Shows execution output in `<pre>` terminal block
- `Running...` disabled state while executing

**Data flow:**

1. Mount: reads `?challenge=ID` from URL query params
2. `GET /api/challenges/{id}` → sets `challenge` state
3. Sets `code` state to `challenge.starter_code`
4. On Run: `POST /api/execute` → shows `output` in terminal

---

## Components

### `Header.jsx`

- Global top navigation bar
- Links: Home, Labs, Dashboard, Login/Register
- Auth-aware display pending

### `Footer.jsx`

- Minimal footer with copyright and links

### `AuthModal.jsx`

- Slide-in modal for Login/Register
- Used as an overlay alternative to dedicated pages
- Handles form state for both login and registration flows

---

## CSS Design System (`index.css`)

The entire design system is defined as CSS custom properties (variables).

### Color Tokens

| Token            | Usage                        |
| ---------------- | ---------------------------- |
| `--bg-base`      | Page background (darkest)    |
| `--bg-surface`   | Card/panel surface           |
| `--bg-card`      | Elevated card surface        |
| `--bg-hover`     | Hover state background       |
| `--border`       | Subtle border                |
| `--border-md`    | Medium emphasis border       |
| `--brand`        | Primary brand color (indigo) |
| `--brand-light`  | Light brand / accent text    |
| `--brand-border` | Brand-colored border         |
| `--text-1`       | Primary text                 |
| `--text-2`       | Secondary text               |
| `--text-3`       | Muted/tertiary text          |
| `--success`      | Success green                |
| `--danger`       | Error/danger red             |
| `--warning`      | Warning orange/yellow        |
| `--warning-soft` | Warning background tint      |
| `--info`         | Info blue                    |

### Typography Tokens

| Token         | Value                                       |
| ------------- | ------------------------------------------- |
| `--font`      | Primary UI font (Inter / system)            |
| `--font-mono` | Monospace font (JetBrains Mono / Fira Code) |

---

## API Communication Pattern

All API calls go through the Nginx proxy at `/api/*`:

```javascript
// Example: fetch a challenge
fetch(`/api/challenges/${challengeId}`)
  .then((res) => res.json())
  .then((data) => setChallenge(data));

// Example: execute code
fetch("/api/execute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ source_code: code, language_id: 71 }),
})
  .then((res) => res.json())
  .then((data) => setTerminalOutput(data.output));
```

Nginx strips the `/api` prefix: `GET /api/challenges` → `GET /challenges` on FastAPI.

---

## What's Pending (Frontend)

| Feature                                 | Status                              |
| --------------------------------------- | ----------------------------------- |
| Authentication (JWT or session)         | ❌ Not implemented                  |
| Submission grading (pass/fail feedback) | ❌ Not implemented                  |
| XP / badge display in Dashboard         | ❌ Stub only                        |
| Challenge completion state in Lab view  | ❌ Pending auth                     |
| Repo link unlock after N failures       | ❌ Pending auth + progress tracking |
| Home landing page full design           | ❌ Placeholder                      |
