"""
database.py — Campus404
Database engine configured for Docker MySQL with retry logic.
"""
import os
import time

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# ── Connection ───────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://campus_dev:dev_password@db:3306/campus404"
)

def create_engine_with_retry(url: str, retries: int = 10, delay: int = 3):
    """Retry DB connection for Docker startup."""
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
