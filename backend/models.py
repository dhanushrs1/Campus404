"""
models.py — Campus404
Only actively implemented SQLAlchemy models.
Add new models here as features are built.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
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

