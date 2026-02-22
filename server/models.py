"""
models.py — Campus404
All SQLAlchemy ORM model definitions. Imported by routers and main.py.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, BigInteger, Column, DateTime, ForeignKey,
    Integer, String, Text,
)
from sqlalchemy.orm import relationship

from database import Base  # shared declarative base


class User(Base):
    __tablename__ = "users"
    id           = Column(Integer, primary_key=True)
    username     = Column(String(50), unique=True)
    email        = Column(String(255), nullable=True)
    total_xp     = Column(Integer, default=0)
    is_admin     = Column(Boolean, default=False)
    is_banned    = Column(Boolean, default=False)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    progress     = relationship("UserProgress", back_populates="user")
    submissions  = relationship("Submission", back_populates="user")


class Lab(Base):
    __tablename__ = "labs"
    id           = Column(Integer, primary_key=True)
    name         = Column(String(100))
    description  = Column(Text)
    order_number = Column(Integer, default=0)
    levels       = relationship("Level", back_populates="lab")


class Level(Base):
    __tablename__ = "levels"
    id                = Column(Integer, primary_key=True)
    lab_id            = Column(Integer, ForeignKey("labs.id"))
    order_number      = Column(Integer)
    title             = Column(String(100))
    description       = Column(Text, nullable=True)
    broken_code       = Column(Text)
    expected_output   = Column(String(200))
    hint_text         = Column(Text)
    official_solution = Column(Text)
    is_published      = Column(Boolean, default=False)
    repo_link         = Column(String(500), nullable=True)
    lab               = relationship("Lab", back_populates="levels")
    user_progress     = relationship("UserProgress", back_populates="level")
    submissions       = relationship("Submission", back_populates="level")


class Submission(Base):
    __tablename__ = "submissions"
    id             = Column(Integer, primary_key=True)
    user_id        = Column(Integer, ForeignKey("users.id"))
    level_id       = Column(Integer, ForeignKey("levels.id"))
    submitted_code = Column(Text)
    status         = Column(String(50))
    timestamp      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user           = relationship("User", back_populates="submissions")
    level          = relationship("Level", back_populates="submissions")


class Badge(Base):
    __tablename__ = "badges"
    id          = Column(Integer, primary_key=True)
    name        = Column(String(100))
    description = Column(Text, nullable=True)
    image_url   = Column(String(255))
    required_xp = Column(Integer)


class UserProgress(Base):
    __tablename__ = "user_progress"
    id              = Column(Integer, primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"))
    level_id        = Column(Integer, ForeignKey("levels.id"))
    is_completed    = Column(Boolean, default=False)
    failed_attempts = Column(Integer, default=0)
    user            = relationship("User", back_populates="progress")
    level           = relationship("Level", back_populates="user_progress")


class PlatformSetting(Base):
    """Key-value store for all platform-wide settings."""
    __tablename__ = "platform_settings"
    key         = Column(String(100), primary_key=True)
    value       = Column(Text, nullable=False)
    label       = Column(String(200))    # human-readable label for admin UI
    description = Column(Text)           # helper text shown in the form
    tab         = Column(String(50))     # which settings tab: gameplay|platform|access|media


class MediaItem(Base):
    """Media library — stores uploaded images/files with rich metadata."""
    __tablename__ = "media_items"
    id            = Column(Integer, primary_key=True)
    filename      = Column(String(255), unique=True)   # disk filename
    original_name = Column(String(255))                # original upload filename
    file_path     = Column(String(500))                # relative URL: /static/uploads/…
    file_size     = Column(BigInteger, default=0)      # bytes
    mime_type     = Column(String(100))
    title         = Column(String(255), default="")
    alt_text      = Column(String(500), default="")
    caption       = Column(Text, default="")
    description   = Column(Text, default="")
    metadata_json = Column(Text, default="{}")         # JSON: responsive sizes & dims
    uploaded_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
