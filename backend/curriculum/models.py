"""
curriculum/models.py — Campus404
SQLAlchemy ORM models for Labs, Modules, Challenges, and ChallengeFiles.

Architecture decisions:
- `banner_image_path` stores only the relative path — full URL built at API layer.
- `total_xp` on Lab is a dynamic @property backed by a DB query.
- Cascade deletes: Lab → Modules → Challenges → ChallengeFiles.
- `difficulty` removed — labs are categorised by language instead.
- Language (Judge0 ID) lives on Lab, not on individual Challenges.
- Multi-file code support via ChallengeFile: up to 5 files per challenge.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey,
    Integer, String, Text, func
)
from sqlalchemy.orm import relationship, Session
from database import Base


class Lab(Base):
    __tablename__ = "labs"

    id                = Column(Integer, primary_key=True, index=True)
    title             = Column(String(255), nullable=False)
    slug              = Column(String(255), unique=True, nullable=False, index=True)
    description       = Column(String(160), nullable=True)   # hard max 160 chars
    banner_image_path = Column(String(512), nullable=True)   # relative path ONLY
    language_id       = Column(Integer, default=71, nullable=False)  # Judge0 lang id (Python 3 default)
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
    lab_id      = Column(Integer, ForeignKey("labs.id", ondelete="CASCADE"), nullable=False, index=True)
    title       = Column(String(255), nullable=False)
    description = Column(String(160), nullable=True)   # hard max 160 chars
    order_index = Column(Integer, default=0, nullable=False)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    lab        = relationship("Lab", back_populates="modules")
    challenges = relationship(
        "Challenge",
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="Challenge.level_number",
    )


class Challenge(Base):
    __tablename__ = "challenges"

    id           = Column(Integer, primary_key=True, index=True)
    module_id    = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    level_number = Column(Integer, nullable=False)          # auto-calculated by service
    custom_title = Column(String(255), nullable=True)       # null → frontend shows "Level N"
    xp_reward    = Column(Integer, default=50, nullable=False)
    content_html = Column(Text, nullable=False)             # rich text problem statement
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


class ChallengeFile(Base):
    """
    Multi-file code support per Challenge.
    Up to 5 files per challenge (enforced at the service layer).
    One file must be marked is_main=True — the primary entry point shown in the editor.
    """
    __tablename__ = "challenge_files"

    id           = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True)
    filename     = Column(String(100), nullable=False)   # e.g. "solution.py", "index.html"
    content      = Column(Text, default="", nullable=False)
    is_main      = Column(Boolean, default=False, nullable=False)   # primary file
    order_index  = Column(Integer, default=0, nullable=False)

    challenge = relationship("Challenge", back_populates="files")


def compute_lab_total_xp(db: Session, lab_id: int) -> int:
    result = (
        db.query(func.coalesce(func.sum(Challenge.xp_reward), 0))
        .join(Module, Challenge.module_id == Module.id)
        .filter(Module.lab_id == lab_id)
        .scalar()
    )
    return int(result or 0)
