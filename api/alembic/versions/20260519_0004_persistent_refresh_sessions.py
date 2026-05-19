"""persistent refresh sessions

Revision ID: 20260519_0004
Revises: 20260514_0003
Create Date: 2026-05-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260519_0004"
down_revision = "20260514_0003"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_names(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _add_column_if_missing(bind, table_name: str, column: sa.Column) -> None:
    if table_name not in _table_names(bind):
        return
    if column.name in _column_names(bind, table_name):
        return
    op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    _add_column_if_missing(bind, "user_sessions", sa.Column("refresh_token_hash", sa.String(length=128), nullable=True))
    _add_column_if_missing(bind, "user_sessions", sa.Column("refresh_expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    pass
