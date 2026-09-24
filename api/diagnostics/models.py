from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from auth.models import Base


class ErrorGroup(Base):
    __tablename__ = "error_groups"
    __table_args__ = (
        Index("ix_error_groups_last_seen_status", "last_seen_at", "status"),
        Index("ix_error_groups_source_kind", "source_service", "error_kind"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fingerprint = Column(String(64), nullable=False, unique=True, index=True)
    source_service = Column(String(64), nullable=False, index=True)
    error_kind = Column(String(64), nullable=False, index=True)
    severity = Column(String(32), nullable=False, default="error", index=True)
    status = Column(String(32), nullable=False, default="open", index=True)
    title = Column(String(512), nullable=False)
    last_message = Column(Text, nullable=False)
    route_template = Column(String(512), nullable=True, index=True)
    operation = Column(String(512), nullable=True)
    last_status_code = Column(Integer, nullable=True)
    occurrence_count = Column(Integer, nullable=False, default=1)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    triaged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    triaged_by_username = Column(String(64), nullable=True)
    triaged_at = Column(DateTime(timezone=True), nullable=True)

    occurrences = relationship(
        "ErrorOccurrence",
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ErrorOccurrence(Base):
    __tablename__ = "error_occurrences"
    __table_args__ = (
        Index("ix_error_occurrences_group_occurred", "group_id", "occurred_at"),
        Index("ix_error_occurrences_route_template", "route_template"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("error_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    source_service = Column(String(64), nullable=False, index=True)
    error_kind = Column(String(64), nullable=False, index=True)
    severity = Column(String(32), nullable=False, default="error", index=True)
    message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    component_stack = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    route_path = Column(String(512), nullable=True)
    route_template = Column(String(512), nullable=True)
    operation = Column(String(512), nullable=True)
    method = Column(String(16), nullable=True)
    status_code = Column(Integer, nullable=True)
    request_id = Column(String(96), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    username = Column(String(64), nullable=True, index=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    client_occurred_at = Column(DateTime(timezone=True), nullable=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    group = relationship("ErrorGroup", back_populates="occurrences")


class EndpointCheckRun(Base):
    __tablename__ = "endpoint_check_runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    started_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_by_username = Column(String(64), nullable=True)
    status = Column(String(32), nullable=False, default="completed", index=True)
    summary = Column(JSON, nullable=False)
    results = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=False)
