# Templates — Campus404 Admin Panel

All templates live in `server/templates/admin/` and extend `base.html`.

---

## Jinja2 Blocks (defined in `base.html`)

Every child template can override these blocks:

| Block            | Purpose                                     | Required |
| ---------------- | ------------------------------------------- | -------- |
| `title`          | Browser tab `<title>`                       | ✅       |
| `breadcrumb`     | Text in the topbar breadcrumb trail         | ✅       |
| `page_title`     | Large `<h1>` in the topbar                  | ✅       |
| `header_actions` | Buttons on the right of the topbar          | ❌       |
| `content`        | Main page body                              | ✅       |
| `head`           | Extra `<link>` / `<style>` tags in `<head>` | ❌       |
| `scripts`        | Extra `<script>` tags before `</body>`      | ❌       |

**Minimal template skeleton:**

```html
{% extends "admin/base.html" %} {% block title %}My Page{% endblock %} {% block
breadcrumb %}My Page{% endblock %} {% block page_title %}My Page{% endblock %}
{% block header_actions %}
<a href="/admin/..." class="btn btn-primary">+ New</a>
{% endblock %} {% block content %}
<!-- your content here -->
{% endblock %}
```

---

## `base.html` — Context Variables

These variables must be passed from every route:

| Variable   | Type            | Values                                                                 | Purpose                             |
| ---------- | --------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `active`   | `str`           | `"dashboard"` `"users"` `"labs"` `"levels"` `"submissions"` `"badges"` | Highlights the correct sidebar link |
| `msg`      | `str` \| `None` | Any string                                                             | Flash message text                  |
| `msg_type` | `str`           | `"success"` (default) \| `"error"`                                     | Flash message colour                |

---

## Template → Route Map

| Template           | Route(s)                                                |
| ------------------ | ------------------------------------------------------- |
| `dashboard.html`   | `GET /admin`                                            |
| `users.html`       | `GET /admin/users`                                      |
| `labs.html`        | `GET /admin/labs`                                       |
| `lab_form.html`    | `GET /admin/labs/new` · `GET /admin/labs/{id}/edit`     |
| `levels.html`      | `GET /admin/levels`                                     |
| `level_form.html`  | `GET /admin/levels/new` · `GET /admin/levels/{id}/edit` |
| `submissions.html` | `GET /admin/submissions`                                |
| `badges.html`      | `GET /admin/badges`                                     |
| `badge_form.html`  | `GET /admin/badges/new`                                 |

---

## Context Variables Per Template

### `dashboard.html`

```python
user_count, lab_count, level_count,
submission_count, badge_count: int
recent_submissions: list[Submission]   # last 8
```

### `users.html`

```python
users: list[User]
```

### `labs.html`

```python
labs: list[Lab]
```

### `lab_form.html`

```python
lab: Lab | None       # None → create mode
action: str           # form POST target
```

### `levels.html`

```python
levels: list[Level]   # ordered by lab_id, order_number
```

### `level_form.html`

```python
level: Level | None
labs: list[Lab]       # for the lab <select>
action: str
```

### `submissions.html`

```python
submissions: list[Submission]   # desc by timestamp
```

### `badges.html`

```python
badges: list[Badge]
```

### `badge_form.html`

```python
badge: Badge | None
action: str
```
