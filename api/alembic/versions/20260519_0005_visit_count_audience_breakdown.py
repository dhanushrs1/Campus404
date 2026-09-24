"""visit count audience breakdown

Revision ID: 20260519_0005
Revises: 20260519_0004
Create Date: 2026-05-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260519_0005"
down_revision = "20260519_0004"
branch_labels = None
depends_on = None


def _column_names(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())
    if "site_visits" not in table_names:
        return

    columns = _column_names(bind, "site_visits")
    if "visit_count" not in columns:
        op.add_column("site_visits", sa.Column("visit_count", sa.Integer(), nullable=False, server_default="1"))
    if "device_type" not in columns:
        op.add_column("site_visits", sa.Column("device_type", sa.String(length=32), nullable=True))
    if "country_code" not in columns:
        op.add_column("site_visits", sa.Column("country_code", sa.String(length=8), nullable=True))


def downgrade() -> None:
    pass
