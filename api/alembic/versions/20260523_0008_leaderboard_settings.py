"""leaderboard settings

Revision ID: 20260523_0008
Revises: 20260523_0007
Create Date: 2026-05-23
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260523_0008"
down_revision = "20260523_0007"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_names(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def _add_column_if_missing(bind, table_name: str, column: sa.Column) -> None:
    if table_name not in _table_names(bind):
        return
    if column.name in _column_names(bind, table_name):
        return
    op.add_column(table_name, column)


def _create_index_if_missing(bind, name: str, table_name: str, columns: list[str]) -> None:
    if table_name not in _table_names(bind):
        return
    if name in _index_names(bind, table_name):
        return
    op.create_index(name, table_name, columns)


def upgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    if "leaderboard_settings" not in tables:
        op.create_table(
            "leaderboard_settings",
            sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
            sa.Column("global_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("default_range", sa.String(length=32), nullable=False, server_default="all_time"),
            sa.Column("page_size", sa.Integer(), nullable=False, server_default="25"),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    existing = bind.execute(sa.text("SELECT id FROM leaderboard_settings WHERE id = 1")).first()
    if not existing:
        op.bulk_insert(
            sa.table(
                "leaderboard_settings",
                sa.column("id", sa.Integer()),
                sa.column("global_enabled", sa.Boolean()),
                sa.column("default_range", sa.String()),
                sa.column("page_size", sa.Integer()),
            ),
            [{"id": 1, "global_enabled": True, "default_range": "all_time", "page_size": 25}],
        )

    _add_column_if_missing(
        bind,
        "tracks",
        sa.Column("leaderboard_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    _add_column_if_missing(
        bind,
        "tracks",
        sa.Column("leaderboard_default_range", sa.String(length=32), nullable=False, server_default="all_time"),
    )
    _add_column_if_missing(
        bind,
        "tracks",
        sa.Column("leaderboard_page_size", sa.Integer(), nullable=False, server_default="25"),
    )
    _create_index_if_missing(bind, "ix_xp_events_created", "xp_events", ["created_at"])


def downgrade() -> None:
    pass
