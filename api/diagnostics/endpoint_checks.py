from __future__ import annotations

import re
import time
from datetime import timedelta
from typing import Any

import httpx
from fastapi import Request
from fastapi.routing import APIRoute
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.models import User
from curriculum.models import Exercise, Section, Track
from diagnostics.models import EndpointCheckRun, ErrorGroup
from diagnostics.service import prune_retained_diagnostics, utc_now

WEBSITE_PREFIXES = ("/api", "/auth", "/health")
SAFE_QUERY_PATHS = {
    "/auth/check-username": "/auth/check-username?username=campus404-endpoint-check",
}
SELF_CHECK_PREFIXES = (
    "/api/admin/endpoint-checks",
)
SAFE_DYNAMIC_SAMPLE_KINDS = {
    "/api/admin/error-groups/{group_id}": "error_group",
    "/api/admin/tracks/{track_id}/sections": "track",
    "/api/admin/sections/{section_id}/exercises": "section",
    "/api/admin/exercises/{exercise_id}/tasks": "exercise",
    "/api/admin/exercises/{exercise_id}/studio": "exercise",
    "/api/admin/exercises/{exercise_id}/files": "exercise",
    "/api/admin/exercises/{exercise_id}/hints": "exercise",
    "/api/admin/exercises/{exercise_id}/test-cases": "exercise",
    "/api/tracks/{track_identifier}/leaderboard": "published_track",
    "/api/tracks/{track_identifier}": "published_track",
    "/api/exercises/{exercise_identifier}": "exercise",
    "/api/exercises/{exercise_identifier}/workspace": "exercise",
    "/api/leaderboard/tracks/{track_id}": "track",
    "/auth/admin/users/{user_id}/sessions": "admin_user",
}
AUTH_PROVIDER_RE = re.compile(r"^/auth/(google|github)/(login|callback)$")
DYNAMIC_PARAM_RE = re.compile(r"\{[^}]+\}")


def route_category(route: APIRoute) -> str:
    if route.tags:
        return str(route.tags[0])
    if route.path == "/health":
        return "meta"
    return "api"


def route_id(method: str, path: str) -> str:
    return f"{method.upper()} {path}"


def website_routes(request: Request) -> list[tuple[str, APIRoute]]:
    routes: list[tuple[str, APIRoute]] = []
    seen: set[str] = set()
    for route in request.app.routes:
        if not isinstance(route, APIRoute):
            continue
        if not route.path.startswith(WEBSITE_PREFIXES):
            continue
        for method in sorted((route.methods or set()) - {"HEAD", "OPTIONS"}):
            key = route_id(method, route.path)
            if key in seen:
                continue
            seen.add(key)
            routes.append((method, route))
    return sorted(routes, key=lambda item: (item[1].path, item[0]))


def safe_probe_skip_reason(method: str, route: APIRoute) -> str | None:
    if method.upper() != "GET":
        return "write endpoint is not live-probed because it can change data"
    if "{" in route.path or "}" in route.path:
        if route.path not in SAFE_DYNAMIC_SAMPLE_KINDS:
            return "record-specific route has no approved safe sample check"
    if route.path.startswith(SELF_CHECK_PREFIXES):
        return "endpoint-check route is excluded from self-checks"
    if AUTH_PROVIDER_RE.match(route.path):
        return "oauth flow requires provider navigation"
    return None


def base_route_entry(method: str, route: APIRoute) -> dict[str, Any]:
    skip_reason = safe_probe_skip_reason(method, route)
    return {
        "route_id": route_id(method, route.path),
        "method": method,
        "path": route.path,
        "name": route.name,
        "category": route_category(route),
        "probe_mode": "safe_probe" if skip_reason is None else "registered_only",
        "probe_status": "not_checked" if skip_reason is None else "registered_only",
        "skip_reason": skip_reason,
        "checked_at": None,
        "http_status": None,
        "duration_ms": None,
        "error": None,
    }


async def safe_probe_samples(db: AsyncSession, admin: User) -> dict[str, int | None]:
    return {
        "admin_user": int(admin.id) if admin.id is not None else None,
        "error_group": await db.scalar(select(ErrorGroup.id).order_by(ErrorGroup.last_seen_at.desc()).limit(1)),
        "track": await db.scalar(select(Track.id).order_by(Track.id).limit(1)),
        "published_track": await db.scalar(
            select(Track.id).where(Track.is_published.is_(True)).order_by(Track.id).limit(1)
        ),
        "section": await db.scalar(select(Section.id).order_by(Section.id).limit(1)),
        "exercise": await db.scalar(select(Exercise.id).order_by(Exercise.id).limit(1)),
    }


def probe_path_for_route(route: APIRoute, samples: dict[str, int | None]) -> tuple[str | None, str | None]:
    if route.path in SAFE_QUERY_PATHS:
        return SAFE_QUERY_PATHS[route.path], None

    sample_kind = SAFE_DYNAMIC_SAMPLE_KINDS.get(route.path)
    if not sample_kind:
        return route.path, None

    sample_value = samples.get(sample_kind)
    if sample_value is None:
        return None, f"no {sample_kind.replace('_', ' ')} sample record is available"

    return DYNAMIC_PARAM_RE.sub(str(sample_value), route.path), None


async def run_endpoint_checks(
    db: AsyncSession,
    request: Request,
    admin: User,
) -> EndpointCheckRun:
    entries = [base_route_entry(method, route) for method, route in website_routes(request)]
    samples = await safe_probe_samples(db, admin)
    checked_at = utc_now().isoformat()
    probe_headers = {"user-agent": "campus404-endpoint-check/1.0"}
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header:
        probe_headers["authorization"] = auth_header

    transport = httpx.ASGITransport(app=request.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://endpoint-check.local", timeout=5.0) as client:
        route_by_id = {
            route_id(method, route.path): route
            for method, route in website_routes(request)
        }
        for entry in entries:
            if entry["probe_mode"] != "safe_probe":
                continue

            probe_path, skip_reason = probe_path_for_route(route_by_id[entry["route_id"]], samples)
            if skip_reason:
                entry["probe_mode"] = "registered_only"
                entry["probe_status"] = "registered_only"
                entry["skip_reason"] = skip_reason
                continue

            started = time.perf_counter()
            entry["checked_at"] = checked_at
            entry["probe_path"] = probe_path
            try:
                response = await client.request(entry["method"], probe_path or entry["path"], headers=probe_headers)
                entry["http_status"] = response.status_code
                entry["probe_status"] = "healthy" if 200 <= response.status_code < 400 else "failed"
                if entry["probe_status"] == "failed":
                    entry["error"] = f"HTTP {response.status_code}"
            except Exception as exc:
                entry["probe_status"] = "failed"
                entry["error"] = str(exc)[:512] or exc.__class__.__name__
            finally:
                entry["duration_ms"] = round((time.perf_counter() - started) * 1000, 1)

    summary = summarize_entries(entries)
    run = EndpointCheckRun(
        started_by_user_id=admin.id,
        started_by_username=admin.username,
        status="completed",
        summary=summary,
        results=entries,
        completed_at=utc_now(),
    )
    db.add(run)
    await prune_retained_diagnostics(db)
    await db.commit()
    await db.refresh(run)
    return run


def summarize_entries(entries: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "total": len(entries),
        "checked": sum(1 for entry in entries if entry["probe_mode"] == "safe_probe"),
        "healthy": sum(1 for entry in entries if entry["probe_status"] == "healthy"),
        "failed": sum(1 for entry in entries if entry["probe_status"] == "failed"),
        "registered_only": sum(1 for entry in entries if entry["probe_status"] == "registered_only"),
    }


async def recent_issue_map(db: AsyncSession) -> dict[str, dict[str, Any]]:
    recent_cutoff = utc_now() - timedelta(days=1)
    groups = (
        await db.scalars(
            select(ErrorGroup)
            .where(ErrorGroup.route_template.is_not(None))
            .where(ErrorGroup.last_seen_at >= recent_cutoff)
            .order_by(ErrorGroup.last_seen_at.desc())
        )
    ).all()
    issues: dict[str, dict[str, Any]] = {}
    for group in groups:
        if not group.route_template:
            continue
        issue = issues.setdefault(
            group.route_template,
            {
                "has_recent_issue": True,
                "open_groups": 0,
                "last_seen_at": group.last_seen_at,
                "latest_group_id": group.id,
            },
        )
        if group.status != "resolved":
            issue["open_groups"] += 1
    return issues


async def endpoint_inventory_response(db: AsyncSession, request: Request) -> dict[str, Any]:
    latest_run = await db.scalar(select(EndpointCheckRun).order_by(EndpointCheckRun.created_at.desc()))
    latest_by_route = {
        str(entry.get("route_id")): entry
        for entry in (latest_run.results if latest_run and isinstance(latest_run.results, list) else [])
        if isinstance(entry, dict)
    }
    issues = await recent_issue_map(db)
    routes = []
    for method, route in website_routes(request):
        base = base_route_entry(method, route)
        result = latest_by_route.get(base["route_id"], {})
        merged = {**base, **result}
        merged["recent_issue"] = issues.get(route.path)
        routes.append(merged)

    return {
        "routes": routes,
        "latest_run": serialize_check_run(latest_run),
    }


def serialize_check_run(run: EndpointCheckRun | None) -> dict[str, Any] | None:
    if run is None:
        return None
    return {
        "id": run.id,
        "status": run.status,
        "summary": run.summary,
        "started_by_username": run.started_by_username,
        "created_at": run.created_at,
        "completed_at": run.completed_at,
    }
