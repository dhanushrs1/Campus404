import os
from datetime import datetime

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
import pytest_asyncio
from starlette.requests import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import curriculum.router as curriculum_router
from curriculum import models, schemas


def make_request(
    ip_address: str = "203.0.113.10",
    user_agent: str = "pytest",
    country_code: str | None = None,
) -> Request:
    headers = [
        (b"x-real-ip", ip_address.encode("ascii")),
        (b"user-agent", user_agent.encode("ascii")),
    ]
    if country_code:
        headers.append((b"cf-ipcountry", country_code.encode("ascii")))

    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/analytics/visit",
            "headers": headers,
            "client": (ip_address, 12345),
        }
    )


class FrozenDateTime(datetime):
    current = datetime(2026, 5, 14, 10, 0, 0)

    @classmethod
    def utcnow(cls):
        return cls.current


@pytest_asyncio.fixture()
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(models.SiteVisit.__table__.create)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_site_visit_increments_same_ip_repeat_visits(db_session, monkeypatch):
    FrozenDateTime.current = datetime(2026, 5, 14, 10, 0, 0)
    monkeypatch.setattr(curriculum_router, "datetime", FrozenDateTime)

    payload = schemas.SiteVisitRequest(path="/tracks", referrer=None)
    await curriculum_router.record_site_visit(payload, make_request("203.0.113.10", user_agent="Mozilla/5.0 iPhone", country_code="IN"), db_session)
    await curriculum_router.record_site_visit(payload, make_request("203.0.113.10", user_agent="Mozilla/5.0 iPhone", country_code="IN"), db_session)

    count = await db_session.scalar(select(func.count()).select_from(models.SiteVisit))
    visit = await db_session.scalar(select(models.SiteVisit))

    assert count == 1
    assert visit.first_path == "/tracks"
    assert visit.visit_count == 2
    assert visit.device_type == "mobile"
    assert visit.country_code == "IN"


@pytest.mark.asyncio
async def test_site_visit_counts_different_ips_and_next_day(db_session, monkeypatch):
    monkeypatch.setattr(curriculum_router, "datetime", FrozenDateTime)
    payload = schemas.SiteVisitRequest(path="/", referrer=None)

    FrozenDateTime.current = datetime(2026, 5, 14, 10, 0, 0)
    await curriculum_router.record_site_visit(payload, make_request("203.0.113.10"), db_session)
    await curriculum_router.record_site_visit(payload, make_request("203.0.113.11"), db_session)

    FrozenDateTime.current = datetime(2026, 5, 15, 10, 0, 0)
    await curriculum_router.record_site_visit(payload, make_request("203.0.113.10"), db_session)

    count = await db_session.scalar(select(func.count()).select_from(models.SiteVisit))

    assert count == 3
