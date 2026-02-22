"""
database.py — Campus404
Database engine, session factory, dependency injection, and schema migrations.
"""
import os
import time

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, Session, sessionmaker

# ── Connection ───────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://campus_dev:dev_password@db:3306/campus404"
)

def create_engine_with_retry(url: str, retries: int = 10, delay: int = 3):
    """Retry DB connection — permanent fix for Docker race condition."""
    for attempt in range(1, retries + 1):
        try:
            eng = create_engine(url, pool_pre_ping=True)
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[Campus404] ✅ Database connected on attempt {attempt}")
            return eng
        except Exception as e:
            print(f"[Campus404] ⏳ DB not ready (attempt {attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(delay)
    raise RuntimeError("[Campus404] ❌ Could not connect to database after retries.")

engine = create_engine_with_retry(DATABASE_URL)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── FastAPI dependency ───────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Incremental schema migrations (safe for existing DBs) ────────────
def apply_migrations():
    """
    Add new columns to existing tables without dropping data.
    SQLAlchemy's create_all() only creates NEW tables — it never
    alters existing ones. This runs raw SQL for each new column.
    """
    migrations = [
        # (table, column, definition)
        ("challenges",  "repo_link",    "VARCHAR(500) NULL"),
        ("media_items", "metadata_json", "TEXT"),
        # v2 — admin panel completion
        ("users",   "email",        "VARCHAR(255) NULL"),
        ("users",   "created_at",   "DATETIME NULL"),
        ("labs",    "order_number", "INT NOT NULL DEFAULT 0"),
        ("challenges",  "description",  "TEXT NULL"),
        ("badges",  "description",  "TEXT NULL"),
    ]
    with engine.connect() as conn:
        db_name = engine.url.database
        for table, column, definition in migrations:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl AND COLUMN_NAME = :col"
            ), {"db": db_name, "tbl": table, "col": column})
            exists = result.scalar()
            if not exists:
                conn.execute(text(
                    f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}"
                ))
                conn.commit()
                print(f"[Campus404] ✅ Migration: added `{column}` to `{table}`")
            else:
                print(f"[Campus404] ⏭  Migration: `{table}.{column}` already exists")
