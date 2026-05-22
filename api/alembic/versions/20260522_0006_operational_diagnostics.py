"""operational diagnostics and endpoint checks

Revision ID: 20260522_0006
Revises: 20260519_0005
Create Date: 2026-05-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260522_0006"
down_revision = "20260519_0005"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    if "error_groups" not in tables:
        op.create_table(
            "error_groups",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("fingerprint", sa.String(length=64), nullable=False),
            sa.Column("source_service", sa.String(length=64), nullable=False),
            sa.Column("error_kind", sa.String(length=64), nullable=False),
            sa.Column("severity", sa.String(length=32), nullable=False, server_default="error"),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
            sa.Column("title", sa.String(length=512), nullable=False),
            sa.Column("last_message", sa.Text(), nullable=False),
            sa.Column("route_template", sa.String(length=512), nullable=True),
            sa.Column("operation", sa.String(length=512), nullable=True),
            sa.Column("last_status_code", sa.Integer(), nullable=True),
            sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("triaged_by_user_id", sa.Integer(), nullable=True),
            sa.Column("triaged_by_username", sa.String(length=64), nullable=True),
            sa.Column("triaged_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["triaged_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("fingerprint"),
        )
        op.create_index("ix_error_groups_id", "error_groups", ["id"])
        op.create_index("ix_error_groups_fingerprint", "error_groups", ["fingerprint"], unique=True)
        op.create_index("ix_error_groups_source_service", "error_groups", ["source_service"])
        op.create_index("ix_error_groups_error_kind", "error_groups", ["error_kind"])
        op.create_index("ix_error_groups_severity", "error_groups", ["severity"])
        op.create_index("ix_error_groups_status", "error_groups", ["status"])
        op.create_index("ix_error_groups_route_template", "error_groups", ["route_template"])
        op.create_index("ix_error_groups_first_seen_at", "error_groups", ["first_seen_at"])
        op.create_index("ix_error_groups_last_seen_at", "error_groups", ["last_seen_at"])
        op.create_index("ix_error_groups_last_seen_status", "error_groups", ["last_seen_at", "status"])
        op.create_index("ix_error_groups_source_kind", "error_groups", ["source_service", "error_kind"])

    tables = _table_names(bind)
    if "error_occurrences" not in tables:
        op.create_table(
            "error_occurrences",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("group_id", sa.Integer(), nullable=False),
            sa.Column("source_service", sa.String(length=64), nullable=False),
            sa.Column("error_kind", sa.String(length=64), nullable=False),
            sa.Column("severity", sa.String(length=32), nullable=False, server_default="error"),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("stack_trace", sa.Text(), nullable=True),
            sa.Column("component_stack", sa.Text(), nullable=True),
            sa.Column("details", sa.JSON(), nullable=True),
            sa.Column("route_path", sa.String(length=512), nullable=True),
            sa.Column("route_template", sa.String(length=512), nullable=True),
            sa.Column("operation", sa.String(length=512), nullable=True),
            sa.Column("method", sa.String(length=16), nullable=True),
            sa.Column("status_code", sa.Integer(), nullable=True),
            sa.Column("request_id", sa.String(length=96), nullable=True),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("username", sa.String(length=64), nullable=True),
            sa.Column("ip_address", sa.String(length=64), nullable=True),
            sa.Column("user_agent", sa.String(length=512), nullable=True),
            sa.Column("client_occurred_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["group_id"], ["error_groups.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_error_occurrences_id", "error_occurrences", ["id"])
        op.create_index("ix_error_occurrences_group_id", "error_occurrences", ["group_id"])
        op.create_index("ix_error_occurrences_source_service", "error_occurrences", ["source_service"])
        op.create_index("ix_error_occurrences_error_kind", "error_occurrences", ["error_kind"])
        op.create_index("ix_error_occurrences_severity", "error_occurrences", ["severity"])
        op.create_index("ix_error_occurrences_request_id", "error_occurrences", ["request_id"])
        op.create_index("ix_error_occurrences_user_id", "error_occurrences", ["user_id"])
        op.create_index("ix_error_occurrences_username", "error_occurrences", ["username"])
        op.create_index("ix_error_occurrences_occurred_at", "error_occurrences", ["occurred_at"])
        op.create_index("ix_error_occurrences_group_occurred", "error_occurrences", ["group_id", "occurred_at"])
        op.create_index("ix_error_occurrences_route_template", "error_occurrences", ["route_template"])

    tables = _table_names(bind)
    if "endpoint_check_runs" not in tables:
        op.create_table(
            "endpoint_check_runs",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("started_by_user_id", sa.Integer(), nullable=True),
            sa.Column("started_by_username", sa.String(length=64), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="completed"),
            sa.Column("summary", sa.JSON(), nullable=False),
            sa.Column("results", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["started_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_endpoint_check_runs_id", "endpoint_check_runs", ["id"])
        op.create_index("ix_endpoint_check_runs_status", "endpoint_check_runs", ["status"])
        op.create_index("ix_endpoint_check_runs_created_at", "endpoint_check_runs", ["created_at"])


def downgrade() -> None:
    pass
