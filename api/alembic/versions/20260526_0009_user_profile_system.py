"""user profile system

Revision ID: 20260526_0009
Revises: 20260523_0008
Create Date: 2026-05-26
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260526_0009"
down_revision = "20260523_0008"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _index_names(bind, table_name: str) -> set[str]:
    if table_name not in _table_names(bind):
        return set()
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def _create_index_if_missing(bind, name: str, table_name: str, columns: list[str]) -> None:
    if table_name not in _table_names(bind) or name in _index_names(bind, table_name):
        return
    op.create_index(name, table_name, columns)


def upgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    if "user_profiles" not in tables:
        op.create_table(
            "user_profiles",
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("display_name", sa.String(length=160), nullable=True),
            sa.Column("headline", sa.String(length=180), nullable=True),
            sa.Column("bio", sa.Text(), nullable=True),
            sa.Column("location_text", sa.String(length=128), nullable=True),
            sa.Column("website_url", sa.String(length=512), nullable=True),
            sa.Column("github_url", sa.String(length=512), nullable=True),
            sa.Column("linkedin_url", sa.String(length=512), nullable=True),
            sa.Column("portfolio_url", sa.String(length=512), nullable=True),
            sa.Column("avatar_source", sa.String(length=32), nullable=False, server_default="selected"),
            sa.Column("selected_avatar_url", sa.String(length=512), nullable=True),
            sa.Column("provider_avatar_url", sa.String(length=512), nullable=True),
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("show_badges", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("show_certificates", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("show_activity", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("show_projects", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("show_rank", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("show_connections", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("user_id"),
        )

    if "user_connections" not in tables:
        op.create_table(
            "user_connections",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("connector_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("connected_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("connector_user_id", "connected_user_id", name="uq_user_connections_pair"),
        )

    if "user_project_pins" not in tables:
        op.create_table(
            "user_project_pins",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("project_url", sa.String(length=512), nullable=False),
            sa.Column("image_url", sa.String(length=512), nullable=True),
            sa.Column("tags", sa.JSON(), nullable=True),
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if "user_credit_ledger" not in tables:
        op.create_table(
            "user_credit_ledger",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("source_type", sa.String(length=64), nullable=False),
            sa.Column("source_id", sa.String(length=128), nullable=False),
            sa.Column("reason", sa.String(length=256), nullable=False),
            sa.Column("details", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("user_id", "source_type", "source_id", name="uq_user_credit_ledger_source"),
        )

    if "user_certificates" not in tables:
        op.create_table(
            "user_certificates",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("track_id", sa.Integer(), sa.ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False),
            sa.Column("certificate_code", sa.String(length=96), nullable=False),
            sa.Column("title", sa.String(length=256), nullable=False),
            sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.UniqueConstraint("user_id", "track_id", name="uq_user_certificates_user_track"),
            sa.UniqueConstraint("certificate_code", name="uq_user_certificates_code"),
        )

    if "account_change_requests" not in tables:
        op.create_table(
            "account_change_requests",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("request_type", sa.String(length=64), nullable=False),
            sa.Column("requested_email", sa.String(length=256), nullable=True),
            sa.Column("requested_provider", sa.String(length=32), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        )

    _create_index_if_missing(bind, "ix_user_connections_connector_created", "user_connections", ["connector_user_id", "created_at"])
    _create_index_if_missing(bind, "ix_user_connections_connected_created", "user_connections", ["connected_user_id", "created_at"])
    _create_index_if_missing(bind, "ix_user_project_pins_user_order", "user_project_pins", ["user_id", "order"])
    _create_index_if_missing(bind, "ix_user_project_pins_user_public", "user_project_pins", ["user_id", "is_public"])
    _create_index_if_missing(bind, "ix_user_credit_ledger_user_created", "user_credit_ledger", ["user_id", "created_at"])
    _create_index_if_missing(bind, "ix_user_certificates_user_issued", "user_certificates", ["user_id", "issued_at"])
    _create_index_if_missing(bind, "ix_account_change_requests_user_created", "account_change_requests", ["user_id", "created_at"])
    _create_index_if_missing(bind, "ix_account_change_requests_status", "account_change_requests", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    # Drop dependent tables before their referenced user/track records. Each
    # guard keeps rollback safe when upgrading from a partially-created schema.
    for table_name in (
        "account_change_requests",
        "user_certificates",
        "user_credit_ledger",
        "user_project_pins",
        "user_connections",
        "user_profiles",
    ):
        if table_name in tables:
            op.drop_table(table_name)
