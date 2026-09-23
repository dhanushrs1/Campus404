from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from auth.models import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    display_name = Column(String(160), nullable=True)
    headline = Column(String(180), nullable=True)
    bio = Column(Text, nullable=True)
    location_text = Column(String(128), nullable=True)
    website_url = Column(String(512), nullable=True)
    github_url = Column(String(512), nullable=True)
    linkedin_url = Column(String(512), nullable=True)
    portfolio_url = Column(String(512), nullable=True)
    avatar_source = Column(String(32), nullable=False, default="selected")
    selected_avatar_url = Column(String(512), nullable=True)
    provider_avatar_url = Column(String(512), nullable=True)
    is_public = Column(Boolean, nullable=False, default=True)
    show_badges = Column(Boolean, nullable=False, default=True)
    show_certificates = Column(Boolean, nullable=False, default=True)
    show_activity = Column(Boolean, nullable=False, default=True)
    show_projects = Column(Boolean, nullable=False, default=True)
    show_rank = Column(Boolean, nullable=False, default=True)
    show_connections = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User")


class UserConnection(Base):
    __tablename__ = "user_connections"
    __table_args__ = (
        UniqueConstraint("connector_user_id", "connected_user_id", name="uq_user_connections_pair"),
        Index("ix_user_connections_connector_created", "connector_user_id", "created_at"),
        Index("ix_user_connections_connected_created", "connected_user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    connector_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    connected_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserProjectPin(Base):
    __tablename__ = "user_project_pins"
    __table_args__ = (
        Index("ix_user_project_pins_user_order", "user_id", "order"),
        Index("ix_user_project_pins_user_public", "user_id", "is_public"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    project_url = Column(String(512), nullable=False)
    image_url = Column(String(512), nullable=True)
    tags = Column(JSON, nullable=True)
    is_public = Column(Boolean, nullable=False, default=True)
    order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class UserCreditLedger(Base):
    __tablename__ = "user_credit_ledger"
    __table_args__ = (
        UniqueConstraint("user_id", "source_type", "source_id", name="uq_user_credit_ledger_source"),
        Index("ix_user_credit_ledger_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    source_type = Column(String(64), nullable=False)
    source_id = Column(String(128), nullable=False)
    reason = Column(String(256), nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserCertificate(Base):
    __tablename__ = "user_certificates"
    __table_args__ = (
        UniqueConstraint("user_id", "track_id", name="uq_user_certificates_user_track"),
        Index("ix_user_certificates_user_issued", "user_id", "issued_at"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    certificate_code = Column(String(96), unique=True, nullable=False, index=True)
    title = Column(String(256), nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    metadata_json = Column(JSON, nullable=True)


class AccountChangeRequest(Base):
    __tablename__ = "account_change_requests"
    __table_args__ = (
        Index("ix_account_change_requests_user_created", "user_id", "created_at"),
        Index("ix_account_change_requests_status", "status"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    request_type = Column(String(64), nullable=False)
    requested_email = Column(String(256), nullable=True)
    requested_provider = Column(String(32), nullable=True)
    note = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
