import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
import pytest_asyncio
from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from auth.models import User
from diagnostics.endpoint_checks import probe_path_for_route, safe_probe_skip_reason
from diagnostics.models import EndpointCheckRun, ErrorGroup, ErrorOccurrence
from diagnostics.router import require_platform_admin
from diagnostics.service import ErrorEvent, record_error_event
from main import app


@pytest_asyncio.fixture()
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(User.__table__.create)
        await conn.run_sync(ErrorGroup.__table__.create)
        await conn.run_sync(ErrorOccurrence.__table__.create)
        await conn.run_sync(EndpointCheckRun.__table__.create)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_error_group_reopens_and_redacts_secret_text(db_session):
    first_group, first_occurrence = await record_error_event(
        db_session,
        ErrorEvent(
            source_service="client",
            error_kind="network_error",
            message="Upload failed with token=raw-secret",
            route_path="/admin/dashboard",
            operation="/api/admin/media/upload",
        ),
    )
    first_group.status = "resolved"
    await db_session.commit()

    second_group, second_occurrence = await record_error_event(
        db_session,
        ErrorEvent(
            source_service="client",
            error_kind="network_error",
            message="Upload failed with token=another-secret",
            route_path="/admin/dashboard",
            operation="/api/admin/media/upload",
            details={"authorization": "Bearer private", "safe": "kept"},
        ),
    )

    assert first_occurrence.group_id == second_occurrence.group_id
    assert second_group.id == first_group.id
    assert second_group.status == "open"
    assert second_group.occurrence_count == 2
    assert "another-secret" not in second_occurrence.message
    assert "[redacted]" in second_occurrence.message
    assert second_occurrence.details["authorization"] == "[redacted]"
    assert second_occurrence.details["safe"] == "kept"


def test_diagnostics_admin_gate_rejects_editor():
    with pytest.raises(HTTPException) as exc_info:
        require_platform_admin(User(username="editor", role="EDITOR"))

    assert exc_info.value.status_code == 403
    assert require_platform_admin(User(username="admin", role="ADMIN")).username == "admin"


def test_endpoint_probe_marks_safe_get_routes_active():
    api_routes = [route for route in app.routes if isinstance(route, APIRoute)]
    health = next(route for route in api_routes if route.path == "/health")
    create_track = next(route for route in api_routes if route.path == "/api/admin/tracks" and "POST" in route.methods)
    track_detail_tree = next(route for route in api_routes if route.path == "/api/tracks/{track_identifier}/tree")
    track_detail = next(route for route in api_routes if route.path == "/api/tracks/{track_identifier}")
    oauth_login = next(route for route in api_routes if route.path == "/auth/google/login")

    assert safe_probe_skip_reason("GET", health) is None
    assert "change data" in safe_probe_skip_reason("POST", create_track)
    assert safe_probe_skip_reason("GET", track_detail) is None
    assert "approved safe sample" in safe_probe_skip_reason("GET", track_detail_tree)
    assert "oauth" in safe_probe_skip_reason("GET", oauth_login)


def test_endpoint_probe_uses_queries_and_real_sample_ids():
    api_routes = [route for route in app.routes if isinstance(route, APIRoute)]
    username_check = next(route for route in api_routes if route.path == "/auth/check-username")
    track_detail = next(route for route in api_routes if route.path == "/api/tracks/{track_identifier}")

    username_probe, username_skip = probe_path_for_route(username_check, {})
    track_probe, track_skip = probe_path_for_route(track_detail, {"published_track": 7})
    missing_probe, missing_skip = probe_path_for_route(track_detail, {"published_track": None})

    assert username_probe == "/auth/check-username?username=campus404-endpoint-check"
    assert username_skip is None
    assert track_probe == "/api/tracks/7"
    assert track_skip is None
    assert missing_probe is None
    assert "published track" in missing_skip
