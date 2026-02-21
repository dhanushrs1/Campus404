"""
settings_seed.py — Campus404
DEFAULT_SETTINGS list, seeder function, and get_setting() helper.
Imported once at startup by main.py.
"""
from sqlalchemy.orm import Session

from models import PlatformSetting

# ── Default values injected into DB on first startup ─────────────────
DEFAULT_SETTINGS = [
    # key                    value             label                                   description                                                         tab
    ("max_fail_unlock",      "5",              "Failed Attempts to Unlock Repo Link",  "How many failed attempts before the repo link is revealed.",        "gameplay"),
    ("xp_per_level",         "100",            "XP Awarded per Level Completion",      "XP given to a user when they pass a level.",                        "gameplay"),
    ("xp_per_first_try",     "50",             "Bonus XP for First-Try Pass",          "Extra XP awarded if the student passes on their very first attempt.","gameplay"),
    ("platform_name",        "Campus404",      "Platform Name",                        "Shown in the browser title and student-facing pages.",               "platform"),
    ("platform_tagline",     "Learn by fixing bugs", "Platform Tagline",              "Short description shown on the login / landing screen.",             "platform"),
    ("maintenance_mode",     "false",          "Maintenance Mode",                     "When enabled, students see a maintenance page instead of the platform.", "platform"),
    ("allow_registrations",  "true",           "Allow New Registrations",              "Disable to prevent new users from creating accounts.",               "access"),
    ("ban_duration_days",    "0",              "Ban Duration (days)",                  "How long a ban lasts. Set to 0 for permanent bans.",                 "access"),

    # Media processing settings
    ("media_thumb_w",        "150",            "Thumbnail Width",                      "Maximum width of a thumbnail (pixels).",                             "media"),
    ("media_thumb_h",        "150",            "Thumbnail Height",                     "Maximum height of a thumbnail (pixels).",                            "media"),
    ("media_thumb_crop",     "true",           "Crop Thumbnails",                      "If enabled, thumbnail images are cropped to exact dimensions.",      "media"),
    ("media_medium_w",       "300",            "Medium Width",                         "Maximum width of a medium-sized image (pixels).",                    "media"),
    ("media_medium_h",       "300",            "Medium Height",                        "Maximum height of a medium-sized image (pixels).",                   "media"),
    ("media_large_w",        "1024",           "Large Width",                          "Maximum width of a large-sized image (pixels).",                     "media"),
    ("media_large_h",        "1024",           "Large Height",                         "Maximum height of a large-sized image (pixels).",                    "media"),
    ("media_organize",       "true",           "Organize Uploads",                     "Organize media into month- and year-based folders.",                 "media"),
]


def seed_settings(db_session: Session) -> None:
    """Insert default settings if they don't already exist."""
    for key, value, label, description, tab in DEFAULT_SETTINGS:
        exists = db_session.query(PlatformSetting).filter_by(key=key).first()
        if not exists:
            db_session.add(PlatformSetting(
                key=key, value=value, label=label,
                description=description, tab=tab,
            ))
    db_session.commit()


def get_setting(db: Session, key: str, default: str = "") -> str:
    """Convenience helper — read a single setting value from the DB."""
    row = db.query(PlatformSetting).filter_by(key=key).first()
    return row.value if row else default
