"""submission monitor cursor indexes

Revision ID: 20260523_0007
Revises: 20260522_0006
Create Date: 2026-05-23
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260523_0007"
down_revision = "20260522_0006"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _index_names(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def _create_index_if_missing(bind, name: str, table_name: str, columns: list[str]) -> None:
    if table_name not in _table_names(bind):
        return
    if name in _index_names(bind, table_name):
        return
    op.create_index(name, table_name, columns)


def upgrade() -> None:
    bind = op.get_bind()
    _create_index_if_missing(bind, "ix_exercise_attempts_created_id", "exercise_attempts", ["created_at", "id"])
    _create_index_if_missing(bind, "ix_exercise_attempts_status_created", "exercise_attempts", ["status", "created_at"])
    _create_index_if_missing(bind, "ix_exercise_attempts_mode_created", "exercise_attempts", ["mode", "created_at"])


def downgrade() -> None:
    pass
