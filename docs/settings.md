# Platform Settings Reference — Campus404

> Settings are managed at `/admin/settings` and stored in the `platform_settings` table.
> All settings are seeded with defaults on first startup by `settings_seed.py`.
> Use `get_setting(db, "key", "default")` to read any setting from Python code.

---

## Gameplay Settings

| Key                | Default | Label                               | Description                                                            |
| ------------------ | ------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `max_fail_unlock`  | `5`     | Failed Attempts to Unlock Repo Link | How many failed attempts before `repo_link` is revealed to the student |
| `xp_per_level`     | `100`   | XP Awarded per Level Completion     | XP given when a student passes a challenge                             |
| `xp_per_first_try` | `50`    | Bonus XP for First-Try Pass         | Extra XP awarded if the student passes on their very first attempt     |

---

## Platform Settings

| Key                   | Default                     | Label               | Description                                       |
| --------------------- | --------------------------- | ------------------- | ------------------------------------------------- |
| `platform_name`       | `Campus404`                 | Platform Name       | Shown in browser title and student-facing pages   |
| `platform_tagline`    | `Learn by fixing bugs`      | Platform Tagline    | Short description on login/landing                |
| `maintenance_mode`    | `false`                     | Maintenance Mode    | When `true`, students see a maintenance page      |
| `default_starting_xp` | `0`                         | Default Starting XP | XP granted to every new user on registration      |
| `judge0_api_url`      | `http://judge0-server:2358` | Judge0 API URL      | Internal URL to the Judge0 code-execution sandbox |

---

## Access Settings

| Key                   | Default | Label                   | Description                                               |
| --------------------- | ------- | ----------------------- | --------------------------------------------------------- |
| `allow_registrations` | `true`  | Allow New Registrations | Set to `false` to prevent new accounts from being created |
| `ban_duration_days`   | `0`     | Ban Duration (days)     | How long a ban lasts. `0` = permanent ban                 |

---

## Media Settings

| Key                | Default | Label            | Description                                                                     |
| ------------------ | ------- | ---------------- | ------------------------------------------------------------------------------- |
| `media_thumb_w`    | `150`   | Thumbnail Width  | Maximum width of thumbnail in pixels                                            |
| `media_thumb_h`    | `150`   | Thumbnail Height | Maximum height of thumbnail in pixels                                           |
| `media_thumb_crop` | `true`  | Crop Thumbnails  | If `true`, thumbnails are hard-cropped to exact dimensions using `ImageOps.fit` |
| `media_medium_w`   | `300`   | Medium Width     | Maximum width of medium-sized image                                             |
| `media_medium_h`   | `300`   | Medium Height    | Maximum height of medium-sized image                                            |
| `media_large_w`    | `1024`  | Large Width      | Maximum width of large-sized image                                              |
| `media_large_h`    | `1024`  | Large Height     | Maximum height of large-sized image                                             |
| `media_organize`   | `true`  | Organize Uploads | If `true`, organizes uploads into `YYYY/MM/` subfolders                         |

---

## How to Read a Setting in Python

```python
from settings_seed import get_setting

# In a FastAPI route with DB dependency:
xp = int(get_setting(db, "xp_per_level", "100"))
max_fails = int(get_setting(db, "max_fail_unlock", "5"))
```

## How to Add a New Setting

1. Add an entry to `DEFAULT_SETTINGS` in `settings_seed.py`:

```python
("my_new_key", "default_value", "Human Label", "Description for admin.", "gameplay"),
```

2. On next startup, `seed_settings()` will insert the new row if it doesn't already exist.

3. Access it in code with `get_setting(db, "my_new_key", "fallback")`.
