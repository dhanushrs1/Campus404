"""repair learning engine additive columns

Revision ID: 20260513_0002
Revises: 20260512_0001
Create Date: 2026-05-13
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260513_0002"
down_revision = "20260512_0001"
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

    # Existing dev/prod databases may already have revision 0001 stamped from an
    # older file. Re-run the additive safety net here so running containers get
    # the columns required by current models without dropping learner data.
    from auth.models import Base
    from contact import models as _contact_models  # noqa: F401
    from curriculum import models as _curriculum_models  # noqa: F401
    from media import models as _media_models  # noqa: F401

    Base.metadata.create_all(bind=bind, checkfirst=True)

    _add_column_if_missing(bind, "tracks", sa.Column("slug", sa.String(length=256), nullable=True))
    _add_column_if_missing(bind, "tracks", sa.Column("featured_image_url", sa.String(length=1024), nullable=True))
    _add_column_if_missing(
        bind,
        "tracks",
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    _add_column_if_missing(bind, "sections", sa.Column("slug", sa.String(length=256), nullable=True))
    _add_column_if_missing(bind, "sections", sa.Column("badge_url", sa.String(length=1024), nullable=True))

    _add_column_if_missing(bind, "exercises", sa.Column("slug", sa.String(length=256), nullable=True))
    _add_column_if_missing(bind, "exercises", sa.Column("instructions_md", sa.Text(), nullable=True))
    _add_column_if_missing(
        bind,
        "exercises",
        sa.Column("xp_reward", sa.Integer(), nullable=False, server_default="20"),
    )
    _add_column_if_missing(
        bind,
        "exercises",
        sa.Column("unlock_rule", sa.String(length=64), nullable=False, server_default="previous_completed"),
    )
    _add_column_if_missing(bind, "exercises", sa.Column("reference_solution_url", sa.String(length=1024), nullable=True))
    _add_column_if_missing(bind, "exercises", sa.Column("docs_url", sa.String(length=1024), nullable=True))
    _add_column_if_missing(
        bind,
        "exercises",
        sa.Column("passing_score_pct", sa.Integer(), nullable=False, server_default="70"),
    )
    _add_column_if_missing(bind, "exercises", sa.Column("attempts_allowed", sa.Integer(), nullable=True))
    _add_column_if_missing(bind, "exercises", sa.Column("validation_config", sa.JSON(), nullable=True))
    _add_column_if_missing(
        bind,
        "exercises",
        sa.Column("auto_submit_on_pass", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    _add_column_if_missing(
        bind,
        "exercises",
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    _add_column_if_missing(
        bind,
        "quiz_questions",
        sa.Column("question_type", sa.String(length=64), nullable=False, server_default="multiple_choice"),
    )
    _add_column_if_missing(bind, "quiz_questions", sa.Column("code_snippet", sa.Text(), nullable=True))
    _add_column_if_missing(bind, "quiz_questions", sa.Column("explanation_md", sa.Text(), nullable=True))
    _add_column_if_missing(bind, "quiz_options", sa.Column("explanation_md", sa.Text(), nullable=True))

    if "exercises" in _table_names(bind):
        bind.execute(sa.text("UPDATE exercises SET mode = 'code' WHERE mode = 'task' OR mode IS NULL"))


def downgrade() -> None:
    pass
