"""
models.py — Campus404
Only actively implemented SQLAlchemy models.
Add new models here as features are built.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from database import Base


class User(Base):
    __tablename__ = "users"

    # ── Identity ────────────────────────────────────────────────────────
    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(50), unique=True, nullable=False, index=True)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # ── Profile ─────────────────────────────────────────────────────────
    first_name      = Column(String(50), nullable=True)
    last_name       = Column(String(50), nullable=True)
    avatar_url      = Column(String(512), nullable=True)       # profile picture URL
    bio             = Column(Text, nullable=True)               # short about me

    # ── Gamification ────────────────────────────────────────────────────
    total_xp        = Column(Integer, default=0, nullable=False)
    current_streak  = Column(Integer, default=0, nullable=False)  # daily login streak (days)
    longest_streak  = Column(Integer, default=0, nullable=False)

    # ── Permissions & Status ────────────────────────────────────────────
    is_admin        = Column(Boolean, default=False, nullable=False)
    is_editor       = Column(Boolean, default=False, nullable=False)  # limited admin access
    is_banned       = Column(Boolean, default=False, nullable=False)
    is_verified     = Column(Boolean, default=False, nullable=False)  # email verification

    # ── Timestamps ──────────────────────────────────────────────────────
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    last_login_at   = Column(DateTime, nullable=True)          # tracks last successful login


class SiteSetting(Base):
    __tablename__ = "site_settings"

    id               = Column(Integer, primary_key=True, index=True)
    site_name        = Column(String(120), nullable=False, default="Campus404")
    meta_description = Column(String(320), nullable=True)

    # Public-facing assets used in navbar and browser tab.
    site_logo_url    = Column(String(512), nullable=True)
    site_logo_width  = Column(Integer, nullable=False, default=220)
    site_logo_height = Column(Integer, nullable=False, default=48)
    site_icon_url    = Column(String(512), nullable=True)

    # Guide display defaults
    guide_default_author     = Column(String(120), nullable=False, default="Campus404 Guide Team")
    guide_show_toc           = Column(Boolean, nullable=False, default=True)
    guide_toc_depth          = Column(Integer, nullable=False, default=3)
    guide_show_social_share  = Column(Boolean, nullable=False, default=True)

    updated_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                              onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    reason = Column(String(255), nullable=True)
    context_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

