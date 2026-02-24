# Public API Reference — Campus404

> These are the **student-facing JSON endpoints** consumed by the React app.
> All calls go through the Nginx proxy: `Browser → /api/... → FastAPI /...`

---

## Base URL

| Environment        | Base URL                     |
| ------------------ | ---------------------------- |
| Development        | `http://localhost:3000/api`  |
| Docker             | `http://localhost/api`       |
| Internal (backend) | `http://campus_backend:8000` |

---

## Security Model

- **No authentication currently** — all public routes are open
- **`official_solution`** is never returned (excluded from Pydantic schema)
- **`expected_output`** (TestCase) is never returned
- Only **published** challenges (`is_published = True`) appear in results

---

## Endpoints

### Health Check

```
GET /api/
```

**Response:**

```json
{ "message": "Campus404 Backend is Running!" }
```

---

### Get All Labs

```
GET /api/labs
```

Returns all labs ordered by `order_number`.

**Response:**

```json
[
  {
    "id": 1,
    "name": "Python Fundamentals",
    "description": "Fix broken Python programs from the ground up.",
    "order_number": 1
  }
]
```

---

### Get Modules + Challenges for a Lab

```
GET /api/labs/{lab_id}/modules
```

Returns all modules with their nested **published** challenges.

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
    "challenges": [
      {
        "id": 3,
        "title": "Fix the Type Error",
        "module_id": 1,
        "order_number": 1,
        "description": "<p>The program crashes...</p>",
        "editor_file_name": "main.py",
        "instructions": "<p>Fix line 4...</p>",
        "starter_code": "x = '5'\nprint(x + 10)",
        "hint_text": "Look at the types.",
        "walkthrough_video_url": null,
        "repo_link": null
      }
    ]
  }
]
```

**Errors:** `404` if lab not found.

---

### Get All Published Challenges

```
GET /api/challenges
```

Returns a flat list of all published challenges.

**Response:** Array of `ChallengePublicResponse` (same schema as above).

---

### Get Single Challenge

```
GET /api/challenges/{challenge_id}
```

**Path params:** `challenge_id: int`

**Response:** Single `ChallengePublicResponse`

**Errors:** `404` if not found or not published.

---

### Execute Code

```
POST /api/execute
```

Runs code against the Judge0 sandbox.

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "source_code": "print('hello')",
  "language_id": 71
}
```

| Field         | Type    | Required | Default | Notes              |
| ------------- | ------- | -------- | ------- | ------------------ |
| `source_code` | string  | ✅       | —       | Code to run        |
| `language_id` | integer | ❌       | `71`    | Judge0 language ID |

**Common language IDs:**

- `71` = Python 3
- `63` = JavaScript (Node.js)
- `62` = Java
- `54` = C++ (GCC 9.2)

**Response:**

```json
{ "output": "hello\n" }
```

**Errors:**

- `500` — Execution error; check `detail` field.

---

## Response Schema: `ChallengePublicResponse`

```typescript
{
  id:                    number,
  title:                 string,
  module_id:             number,
  order_number:          number,
  description:           string | null,   // Rich HTML
  editor_file_name:      string,          // e.g. "main.py"
  instructions:          string | null,   // Rich HTML task description
  starter_code:          string | null,   // Pre-filled code in editor
  hint_text:             string | null,   // Revealed on demand
  walkthrough_video_url: string | null,   // YouTube/video link
  repo_link:             string | null    // Unlocked after N failures
}
```

> **Never included:** `official_solution`, `content_blocks`, `environment`, `is_published`, `TestCase.expected_output`
