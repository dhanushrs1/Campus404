# CSS Design System — Campus404 Admin Panel

**File:** `server/static/admin.css`  
**Fonts:** `Inter` (UI) · `JetBrains Mono` (code / mono data)

---

## Layout Structure

```
.admin-wrap          flex container, min-height:100vh
├── .sidebar         fixed 240px left panel
│   ├── .sb-brand    logo + name block
│   ├── .sb-nav      scrollable nav (overflow-y:auto)
│   │   ├── .sb-section   group label ("CONTENT", "PEOPLE")
│   │   └── .sb-link      nav anchor (.active = highlighted)
│   └── .sb-footer   version pill + status dot
└── .main            flex:1, margin-left:240px
    ├── .topbar      sticky 64px header bar
    └── .page-body   padding:28px — main content area
```

---

## CSS Custom Properties (Design Tokens)

### Backgrounds

```css
--bg-base: #070b11 /* page background */ --bg-surface: #0d1117
  /* sidebar, inputs */ --bg-card: #111827 /* card surfaces */
  --bg-hover: #161f2e /* hover rows */ --bg-active: #1a2744 /* active state */;
```

### Brand & Accent

```css
--brand: #6366f1 /* indigo primary */ --brand-light: #818cf8
  /* lighter indigo */ --brand-dark: #4f46e5 /* darker indigo */
  --brand-glow: rgba(99, 102, 241, 0.15) --brand-border: rgba(99, 102, 241, 0.3)
  --accent: #a78bfa /* violet */;
```

### Semantic Colors

```css
--success: #10b981 /* green */ --warning: #f59e0b /* amber */ --danger: #ef4444
  /* red */ --info: #3b82f6 /* blue */;
```

### Text

```css
--text-1: #f0f2f5 /* primary */ --text-2: #8d97a8 /* secondary / labels */
  --text-3: #4b5563 /* muted / timestamps */;
```

### Borders & Radii

```css
--border: rgba(255, 255, 255, 0.065) --border-md: rgba(255, 255, 255, 0.1)
  --radius-sm: 6px --radius-md: 10px --radius-lg: 14px --radius-xl: 20px;
```

### Layout Constants

```css
--sidebar-w: 240px --topbar-h: 64px;
```

---

## Component Classes

### Buttons

| Class                    | Look                      | When to use                |
| ------------------------ | ------------------------- | -------------------------- |
| `.btn .btn-primary`      | Indigo gradient + glow    | Primary CTA (Save, Create) |
| `.btn .btn-ghost`        | Dark bg + border          | Secondary (Back, Cancel)   |
| `.btn .btn-danger-soft`  | Soft red                  | Destructive (Delete)       |
| `.btn .btn-success-soft` | Soft green                | Positive action (Unban)    |
| `.btn .btn-warning-soft` | Soft amber                | Caution (Demote)           |
| `.btn-sm`                | Modifier: smaller padding | Table row actions          |
| `.btn-icon`              | Square aspect-ratio       | Icon-only button           |

### Badges / Pills

| Class                   | Color  | Use                  |
| ----------------------- | ------ | -------------------- |
| `.badge .badge-success` | Green  | Passed, Active, Live |
| `.badge .badge-danger`  | Red    | Failed, Banned       |
| `.badge .badge-warning` | Amber  | Error, Caution       |
| `.badge .badge-info`    | Blue   | Info, Level label    |
| `.badge .badge-brand`   | Indigo | Admin, Brand tags    |
| `.badge .badge-muted`   | Grey   | Neutral / no value   |

### Cards

```html
<div class="card">
  <div class="card-head">
    <div class="card-title">
      <svg>...</svg>
      <!-- optional icon -->
      Title
    </div>
    <!-- optional right slot -->
    <span class="badge badge-muted">N items</span>
  </div>
  <div class="card-body">
    <!-- content -->
  </div>
</div>
```

### Tables

```html
<div class="table-wrap">
  <!-- enables horizontal scroll -->
  <table>
    <thead>
      <tr>
        <th>Column</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="mono">id</td>
        <!-- monospace font -->
        <td class="muted">secondary</td>
        <!-- dimmed text -->
        <td>
          <div class="table-actions">
            <!-- flex row of buttons -->
            <a class="btn btn-ghost btn-sm">Edit</a>
            <form>
              <button class="btn btn-danger-soft btn-sm">Delete</button>
            </form>
          </div>
        </td>
      </tr>

      <!-- Empty state row -->
      <tr class="empty-row">
        <td colspan="N">
          <svg>...</svg>
          No items yet.
          <p><a href="...">Create one →</a></p>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Stat Cards (Dashboard)

```html
<div class="stats-grid">
  <!-- stats-grid uses: grid, auto-fit, minmax(200px, 1fr) -->
  <a href="/admin/..." class="stat-card">
    <div class="stat-icon brand">
      <!-- brand | green | yellow | blue | violet -->
      <svg>...</svg>
    </div>
    <div class="stat-info">
      <span class="stat-label">Label</span>
      <span class="stat-value">42</span>
    </div>
  </a>
</div>
```

### Forms

```html
<div class="form-grid">
  <!-- single-column -->
  <div class="form-group">
    <label for="f">Field</label>
    <input type="text" id="f" name="f" placeholder="..." />
    <span class="form-hint">Helper text</span>
  </div>
</div>

<div class="form-grid form-grid-2">
  <!-- two-column grid -->
  ...
</div>
```

### Sidebar Nav Link States

```css
.sb-link          /* default: text-2 colour */
.sb-link:hover    /* bg-hover + text-1 */
.sb-link.active   /* brand-soft bg + brand-light text + indicator dot */
```
