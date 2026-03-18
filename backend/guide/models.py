"""
guide/models.py — Campus404
Custom Guide page type, linked to curriculum modules.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from database import Base

# Legacy table retained only for backward compatibility with older DB states.
# New systems use the one-to-one GuidePage.module_id linkage below.
guide_post_modules = Table(
    "learn_post_modules",
    Base.metadata,
    Column("learn_post_id", Integer, ForeignKey("learn_posts.id", ondelete="CASCADE"), primary_key=True),
    Column("module_id", Integer, ForeignKey("modules.id", ondelete="CASCADE"), primary_key=True),
)


class GuidePage(Base):
    __tablename__ = "learn_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    excerpt = Column(String(320), nullable=True)
    content_html = Column(Text, nullable=False)
    featured_image_path = Column(String(512), nullable=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="SET NULL"), nullable=True, unique=True, index=True)
    is_published = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    module = relationship("Module", back_populates="guide", uselist=False, foreign_keys=[module_id])
