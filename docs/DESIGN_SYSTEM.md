# campus404 Design System Guide

This document defines how to apply the global design system from `client/src/styles/base.css`.

## 1. Source Of Truth

- All app-level tokens are defined in `:root` inside `client/src/styles/base.css`.
- Do not hard-code hex values in component CSS when a token exists.
- Prefer semantic tokens (`--text-secondary`, `--border-light`, `--accent-primary`) over raw color values.

## 2. Typography Rules

- Headings: `font-family: var(--font-heading)`
- Body content: `font-family: var(--font-body)`
- Code areas: `font-family: var(--font-code)`

Use fluid text variables so typography scales automatically:

- `--text-xs`, `--text-sm`, `--text-base`
- `--text-lg`, `--text-xl`, `--text-2xl`, `--text-4xl`

Example:

```css
.heroTitle {
  font-size: var(--text-4xl);
}
```

## 3. Layout And Pane Styling

For workspace-like layouts (sidebar, guide, editor):

- App canvas background: `var(--bg-base)`
- Pane/card background: `var(--bg-surface)`
- Pane separation: `border-right: 1px solid var(--border-light)`
- Avoid heavy shadows for pane separation; use borders first.

## 4. Buttons And CTA

Primary action buttons:

```css
.primaryButton {
  background: var(--accent-primary);
  color: #ffffff;
  border-radius: var(--radius-sm);
}

.primaryButton:hover {
  background: var(--accent-hover);
}
```

Secondary actions should use neutral surfaces and border tokens.

## 5. Card Pattern

Base card style:

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-md);
  border-radius: var(--radius-md);
  transition: box-shadow var(--transition-smooth), transform var(--transition-smooth);
}

.card:hover {
  box-shadow: var(--shadow-float);
  transform: translateY(-2px);
}
```

## 6. Status Color Usage

- Success text/icon: `var(--state-success)`
- Success background: `var(--state-success-bg)`
- Error text/icon: `var(--state-error)`
- Error background: `var(--state-error-bg)`

## 7. Applied In Current Frontend

The design system is already applied to:

- Home page
- Shared login page
- 404 page
- User dashboard page
- Admin dashboard page

These files now consume global tokens for colors, typography, radius, and elevation.

## 8. Migration Checklist For New Screens

- Import `client/src/styles/base.css` once from app entry.
- Build styles with tokens only.
- Use fluid font tokens instead of fixed `px` font sizes.
- Use `--border-light` for structure and keep surfaces clean.
- Use `--accent-primary` for primary actions.
- Keep card hover behavior consistent with shared card pattern.
