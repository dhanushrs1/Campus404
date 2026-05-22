"""
campus404 Auth — Database engine, session factory, and table init.
Reads DATABASE_URL strictly from environment.
"""

from __future__ import annotations

import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from auth.models import Base

DATABASE_URL: str = os.environ["DATABASE_URL"]  # Hard-fail if not set

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    """Create all tables on startup if they don't already exist."""
    # Late import to avoid circular dependency:
    # auth.database -> media.models -> auth.models (fine)
    # BUT media.router -> auth.database (would deadlock at module load time)
    # Importing inside the function ensures auth.database is fully initialized first.
    from media.models import MediaFile as _MediaFile  # noqa: F401 — registers on Base.metadata
    from media.models import MediaStorageSettings as _MediaStorageSettings  # noqa: F401
    from contact.models import ContactMessage as _ContactMessage  # noqa: F401
    from curriculum import models as _CurriculumModels  # noqa: F401
    from diagnostics import models as _DiagnosticsModels  # noqa: F401

    async with engine.begin() as conn:
        # create_all is idempotent — only creates tables that don't already exist.
        # MediaFile is now registered on Base.metadata via the late import above.
        await conn.run_sync(Base.metadata.create_all)

        # ── Legacy migrations (safe to re-run; errors are swallowed) ─────────
        migrations = [
            # Users table additions
            "ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE users ADD COLUMN avatar VARCHAR(512) DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN ban_reason VARCHAR(256) DEFAULT NULL",
            # User session refresh-token additions
            "ALTER TABLE user_sessions ADD COLUMN refresh_token_hash VARCHAR(128) DEFAULT NULL",
            "ALTER TABLE user_sessions ADD COLUMN refresh_expires_at DATETIME DEFAULT NULL",
            # Exercises table additions
            "ALTER TABLE exercises ADD COLUMN mode VARCHAR(50) NOT NULL DEFAULT 'code'",
            "ALTER TABLE exercises ADD COLUMN theory_content TEXT NULL",
            "ALTER TABLE exercises ADD COLUMN instructions_md TEXT NULL",
            "ALTER TABLE exercises ADD COLUMN xp_reward INTEGER NOT NULL DEFAULT 20",
            "ALTER TABLE exercises ADD COLUMN unlock_rule VARCHAR(64) NOT NULL DEFAULT 'previous_completed'",
            "ALTER TABLE exercises ADD COLUMN reference_solution_url VARCHAR(1024) NULL",
            "ALTER TABLE exercises ADD COLUMN docs_url VARCHAR(1024) NULL",
            "ALTER TABLE exercises ADD COLUMN passing_score_pct INTEGER NOT NULL DEFAULT 70",
            "ALTER TABLE exercises ADD COLUMN attempts_allowed INTEGER NULL",
            "ALTER TABLE exercises ADD COLUMN validation_config JSON NULL",
            "ALTER TABLE exercises ADD COLUMN auto_submit_on_pass BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE exercises ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT 1",
            "UPDATE exercises SET mode = 'code' WHERE mode = 'task' OR mode IS NULL",
            # Tracks table additions
            "ALTER TABLE tracks ADD COLUMN featured_image_url VARCHAR(1024) NULL",
            "ALTER TABLE tracks ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT 0",
            # Media files table additions
            "ALTER TABLE media_files ADD COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT 'local'",
            "ALTER TABLE media_files ADD COLUMN cloud_public_id TEXT NULL",
            "ALTER TABLE media_files ADD COLUMN cloud_resource_type VARCHAR(32) NULL",
            # Contact message table additions
            "ALTER TABLE contact_messages ADD COLUMN consent_accepted BOOLEAN NOT NULL DEFAULT 1",
            "ALTER TABLE contact_messages ADD COLUMN ip_address VARCHAR(64) DEFAULT NULL",
            "ALTER TABLE contact_messages ADD COLUMN user_agent VARCHAR(512) DEFAULT NULL",
        ]
        for migration_sql in migrations:
            try:
                await conn.execute(text(migration_sql))
            except Exception:
                # Column already exists or table doesn't exist yet — either is safe.
                pass

        # ── media_files table ──────────────────────────────────────────────
        # create_all above already creates the media_files table if it doesn't
        # exist (SQLAlchemy generates the correct DDL for MySQL/SQLite/etc.).
        # No additional raw SQL is needed — removing the manual CREATE TABLE
        # fallback because it used SQLite-only AUTOINCREMENT syntax that breaks
        # on MySQL (which uses AUTO_INCREMENT handled by SQLAlchemy automatically).


async def get_db():  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        yield session
