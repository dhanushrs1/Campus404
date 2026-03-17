"""
curriculum/models.py — Campus404
SQLAlchemy ORM models for Labs, Modules, Challenges, ChallengeFiles, Badges, and UserProgress.
"""
from datetime import datetime, timezone
import random, string
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey,
    Integer, String, Text, func, UniqueConstraint
)
from sqlalchemy.orm import relationship, Session
from database import Base


def _gen_uid(length=4):
    """Generate a short alphanumeric unique ID (e.g. 'a3k9')."""
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choices(chars, k=length))


class Lab(Base):
    __tablename__ = "labs"

    id                = Column(Integer, primary_key=True, index=True)
    title             = Column(String(255), nullable=False)
    slug              = Column(String(255), unique=True, nullable=False, index=True)
    description       = Column(String(160), nullable=True)
    banner_image_path = Column(String(512), nullable=True)
    hero_image_url    = Column(String(512), nullable=True)  # external hero/cover image URL
    language_id       = Column(Integer, default=71, nullable=False)
    is_published      = Column(Boolean, default=False, nullable=False)
    created_at        = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at        = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                                onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    modules = relationship(
        "Module",
        back_populates="lab",
        cascade="all, delete-orphan",
        order_by="Module.order_index",
    )


class Module(Base):
    __tablename__ = "modules"

    id          = Column(Integer, primary_key=True, index=True)
    unique_id   = Column(String(8), unique=True, nullable=False, index=True)  # short uid e.g. 'a3k9'
    lab_id      = Column(Integer, ForeignKey("labs.id", ondelete="CASCADE"), nullable=False, index=True)
    title       = Column(String(255), nullable=False)
    slug        = Column(String(300), unique=True, nullable=False, index=True)  # e.g. "intro-to-python-a3k9"
    description = Column(String(160), nullable=True)
    banner_image_path = Column(String(512), nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    lab        = relationship("Lab", back_populates="modules")
    challenges = relationship(
        "Challenge",
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="Challenge.level_number",
    )
    badge = relationship("Badge", back_populates="module", uselist=False)


class Challenge(Base):
    __tablename__ = "challenges"

    id           = Column(Integer, primary_key=True, index=True)
    module_id    = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    level_number = Column(Integer, nullable=False)
    custom_title = Column(String(255), nullable=True)
    xp_reward    = Column(Integer, default=50, nullable=False)
    content_html = Column(Text, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    module = relationship("Module", back_populates="challenges")
    files  = relationship(
        "ChallengeFile",
        back_populates="challenge",
        cascade="all, delete-orphan",
        order_by="ChallengeFile.order_index",
    )
    completions = relationship("ChallengeCompletion", back_populates="challenge", cascade="all, delete-orphan")


class ChallengeFile(Base):
    __tablename__ = "challenge_files"

    id           = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True)
    filename     = Column(String(100), nullable=False)
    content      = Column(Text, default="", nullable=False)
    is_main      = Column(Boolean, default=False, nullable=False)
    order_index  = Column(Integer, default=0, nullable=False)

    challenge = relationship("Challenge", back_populates="files")


# ── Badges ─────────────────────────────────────────────────────────────────────
class Badge(Base):
    """
    Each Badge is optionally linked to a Module.
    Earning the badge requires completing ALL published challenges in that module.
    Badges can also be standalone (module_id = null) for platform-level achievements.
    """
    __tablename__ = "badges"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(255), nullable=False)
    description   = Column(String(255), nullable=True)
    image_path    = Column(String(512), nullable=True)   # relative path, served from /uploads
    image_url     = Column(String(512), nullable=True)   # OR external URL override
    module_id     = Column(Integer, ForeignKey("modules.id", ondelete="SET NULL"), nullable=True, unique=True, index=True)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    module        = relationship("Module", back_populates="badge")
    earned_by     = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")


class UserBadge(Base):
    """Tracks which users have earned which badges."""
    __tablename__ = "user_badges"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id   = Column(Integer, ForeignKey("badges.id", ondelete="CASCADE"), nullable=False, index=True)
    earned_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    badge = relationship("Badge", back_populates="earned_by")

    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),)


class ChallengeCompletion(Base):
    """Tracks which challenges a user has completed."""
    __tablename__ = "challenge_completions"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id  = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True)
    xp_awarded    = Column(Integer, nullable=False)
    completed_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    challenge = relationship("Challenge", back_populates="completions")

    __table_args__ = (UniqueConstraint("user_id", "challenge_id", name="uq_user_challenge"),)


# ── Helpers ─────────────────────────────────────────────────────────────────────
def compute_lab_total_xp(db: Session, lab_id: int) -> int:
    result = (
        db.query(func.coalesce(func.sum(Challenge.xp_reward), 0))
        .join(Module, Challenge.module_id == Module.id)
        .filter(Module.lab_id == lab_id)
        .scalar()
    )
    return int(result or 0)


def compute_module_total_xp(db: Session, module_id: int) -> int:
    result = (
        db.query(func.coalesce(func.sum(Challenge.xp_reward), 0))
        .filter(Challenge.module_id == module_id)
        .scalar()
    )
    return int(result or 0)
