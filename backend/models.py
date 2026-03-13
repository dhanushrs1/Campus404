"""
models.py — Campus404
All SQLAlchemy ORM model definitions. Imported by routers and main.py.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, BigInteger, Column, DateTime, ForeignKey,
    Integer, String, Text, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship

from database import Base  # shared declarative base

import re

def slugify(text: str) -> str:
    """Generate a URL-friendly slug from the given text."""
    text = text.lower().strip()
    # replace any sequence of non-alphanumeric characters with a single hyphen
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


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
    name         = Column(String(100), unique=True)
    slug         = Column(String(100), unique=True, nullable=False)
    description  = Column(Text)
    order_number = Column(Integer, default=0)
    modules      = relationship("Module", back_populates="lab")


class Module(Base):
    __tablename__ = "modules"
    __table_args__ = (UniqueConstraint('lab_id','slug', name='uq_module_lab_slug'),)

    id           = Column(Integer, primary_key=True)
    lab_id       = Column(Integer, ForeignKey("labs.id"))
    slug         = Column(String(100), nullable=False)
    order_number = Column(Integer)
    title        = Column(String(100))
    description  = Column(Text, nullable=True)
    lab          = relationship("Lab", back_populates="modules")
    challenges   = relationship("Challenge", back_populates="module")


class Challenge(Base):
    __tablename__ = "challenges"
    __table_args__ = (UniqueConstraint('module_id','slug', name='uq_challenge_module_slug'),)

    id                = Column(Integer, primary_key=True)
    module_id         = Column(Integer, ForeignKey("modules.id"))
    slug              = Column(String(150), nullable=False)
    order_number      = Column(Integer)
    title             = Column(String(100))
    description       = Column(Text, nullable=True)
    environment       = Column(String(50), default="standard_script")
    content_blocks    = Column(JSON, default=list)
    official_solution = Column(Text)
    is_published      = Column(Boolean, default=False)
    repo_link         = Column(String(500), nullable=True)
    xp_override       = Column(Integer, nullable=True)       # NULL = use global xp_per_level
    language_id       = Column(Integer, default=71)           # Judge0 language ID (71 = Python 3)
    module            = relationship("Module", back_populates="challenges")
    user_progress     = relationship("UserProgress", back_populates="challenge")
    submissions       = relationship("Submission", back_populates="challenge")
    files             = relationship("ChallengeFile", back_populates="challenge", cascade="all, delete-orphan")
    test_cases        = relationship("TestCase", back_populates="challenge", cascade="all, delete-orphan")


class ChallengeFile(Base):
    __tablename__ = "challenge_files"
    id             = Column(Integer, primary_key=True)
    challenge_id   = Column(Integer, ForeignKey("challenges.id"))
    name           = Column(String(255))
    language       = Column(String(50))
    content        = Column(Text)
    is_entry_point = Column(Boolean, default=False)
    challenge      = relationship("Challenge", back_populates="files")


class TestCase(Base):
    __tablename__ = "test_cases"
    id              = Column(Integer, primary_key=True)
    challenge_id    = Column(Integer, ForeignKey("challenges.id"))
    input_data      = Column(Text)
    expected_output = Column(Text)
    is_hidden       = Column(Boolean, default=False)
    challenge       = relationship("Challenge", back_populates="test_cases")


class Submission(Base):
    __tablename__ = "submissions"
    id             = Column(Integer, primary_key=True)
    user_id        = Column(Integer, ForeignKey("users.id"))
    challenge_id   = Column(Integer, ForeignKey("challenges.id"))
    submitted_code = Column(Text)
    status         = Column(String(50))
    timestamp      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user           = relationship("User", back_populates="submissions")
    challenge      = relationship("Challenge", back_populates="submissions")


class UserProgress(Base):
    __tablename__ = "user_progress"
    id              = Column(Integer, primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"))
    challenge_id    = Column(Integer, ForeignKey("challenges.id"))
    is_completed    = Column(Boolean, default=False)
    failed_attempts = Column(Integer, default=0)
    user            = relationship("User", back_populates="progress")
    challenge       = relationship("Challenge", back_populates="user_progress")



