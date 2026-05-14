"""site visit analytics

Revision ID: 20260514_0003
Revises: 20260513_0002
Create Date: 2026-05-14
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260514_0003"
down_revision = "20260513_0002"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    if "site_visits" in _table_names(bind):
        return

    op.create_table(
        "site_visits",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("visit_date", sa.Date(), nullable=False),
        sa.Column("ip_hash", sa.String(length=128), nullable=False),
        sa.Column("user_agent_hash", sa.String(length=128), nullable=True),
        sa.Column("first_path", sa.String(length=512), nullable=True),
        sa.Column("referrer", sa.String(length=1024), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("visit_date", "ip_hash", name="uq_site_visits_date_ip"),
    )
    op.create_index("ix_site_visits_date", "site_visits", ["visit_date"])
    op.create_index("ix_site_visits_first_seen", "site_visits", ["first_seen_at"])
    op.create_index("ix_site_visits_first_path", "site_visits", ["first_path"])


def downgrade() -> None:
    pass
