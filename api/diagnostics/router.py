from __future__ import annotations

import hmac
import os
from datetime import timedelta
from time import monotonic
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from auth.database import get_db
from auth.models import User
from curriculum.router import JUDGE_URL, _require_platform_admin, get_current_admin
from diagnostics.endpoint_checks import endpoint_inventory_response, run_endpoint_checks, serialize_check_run
from diagnostics.models import ErrorGroup, ErrorOccurrence
from diagnostics.schemas import (
    ClientErrorReportRequest,
    ErrorGroupTriageUpdate,
    InternalErrorEventRequest,
)
from diagnostics.service import ErrorEvent, extract_client_ip, record_error_event, utc_now

router = APIRouter(tags=["diagnostics"])
INTERNAL_DIAGNOSTICS_TOKEN = os.getenv("DIAGNOSTICS_SERVICE_TOKEN", "").strip()
CLIENT_REPORT_WINDOW_SECONDS = 60
CLIENT_REPORT_MAX_PER_WINDOW = 30
_client_report_attempts: dict[str, list[float]] = {}


def require_platform_admin(admin: User = Depends(get_current_admin)) -> User:
    _require_platform_admin(admin)
    return admin


def event_from_payload(
    payload: ClientErrorReportRequest,
    *,
    source_service: str,
) -> ErrorEvent:
    return ErrorEvent(
        source_service=source_service,
        error_kind=payload.error_kind,
        severity=payload.severity,
        message=payload.message,
        stack_trace=payload.stack_trace,
        component_stack=payload.component_stack,
        details=payload.details,
        route_path=payload.route_path,
        route_template=payload.route_template,
        operation=payload.operation,
        method=payload.method,
        status_code=payload.status_code,
        request_id=payload.request_id,
        client_occurred_at=payload.client_occurred_at,
    )


def assert_client_report_rate_limit(request: Request) -> None:
    key = extract_client_ip(request) or "unknown"
    now = monotonic()
    window_start = now - CLIENT_REPORT_WINDOW_SECONDS
    attempts = [stamp for stamp in _client_report_attempts.get(key, []) if stamp >= window_start]
    if len(attempts) >= CLIENT_REPORT_MAX_PER_WINDOW:
        _client_report_attempts[key] = attempts
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many diagnostics reports.")
    attempts.append(now)
    _client_report_attempts[key] = attempts


@router.post("/api/diagnostics/client-errors", status_code=status.HTTP_202_ACCEPTED)
async def report_client_error(
    payload: ClientErrorReportRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    assert_client_report_rate_limit(request)
    group, occurrence = await record_error_event(
        db,
        event_from_payload(payload, source_service="client"),
        request=request,
    )
    return {"accepted": True, "group_id": group.id, "occurrence_id": occurrence.id}


@router.post("/api/internal/diagnostics/error-events", status_code=status.HTTP_202_ACCEPTED)
async def report_internal_error(
    payload: InternalErrorEventRequest,
    request: Request,
    x_diagnostics_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if not INTERNAL_DIAGNOSTICS_TOKEN:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Internal diagnostics ingestion is disabled.")
    if not x_diagnostics_token or not hmac.compare_digest(x_diagnostics_token, INTERNAL_DIAGNOSTICS_TOKEN):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid diagnostics service token.")

    group, occurrence = await record_error_event(
        db,
        event_from_payload(payload, source_service=payload.source_service),
        request=request,
    )
    return {"accepted": True, "group_id": group.id, "occurrence_id": occurrence.id}


async def service_health(db: AsyncSession) -> dict[str, dict[str, Any]]:
    checks: dict[str, dict[str, Any]] = {
        "api": {"status": "healthy", "detail": "Diagnostics API is responding."},
        "database": {"status": "unknown", "detail": "Database check has not completed."},
        "judge": {"status": "unknown", "detail": "Judge health has not completed."},
        "redis": {"status": "unknown", "detail": "Redis health is reported by Judge."},
    }

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = {"status": "healthy", "detail": "Database query succeeded."}
    except Exception as exc:
        checks["database"] = {"status": "unreachable", "detail": str(exc)[:240]}

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{JUDGE_URL}/health")
            payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            judge_status = "healthy" if response.status_code == 200 and payload.get("status") == "ok" else "degraded"
            checks["judge"] = {"status": judge_status, "detail": payload.get("service", "Judge health response received.")}
            redis_status = payload.get("redis", {}).get("status") if isinstance(payload.get("redis"), dict) else None
            if redis_status:
                checks["redis"] = {
                    "status": "healthy" if redis_status == "ok" else "degraded",
                    "detail": payload.get("redis", {}).get("detail") or "Judge Redis check reported.",
                }
    except Exception as exc:
        checks["judge"] = {"status": "unreachable", "detail": str(exc)[:240]}
        checks["redis"] = {"status": "unknown", "detail": "Judge was unreachable."}

    return checks


@router.get("/api/admin/error-handling/summary")
async def get_error_handling_summary(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_platform_admin),
) -> dict[str, Any]:
    statuses = dict(
        (
            await db.execute(
                select(ErrorGroup.status, func.count(ErrorGroup.id)).group_by(ErrorGroup.status)
            )
        ).all()
    )
    source_rows = (
        await db.execute(
            select(ErrorGroup.source_service, func.count(ErrorGroup.id))
            .group_by(ErrorGroup.source_service)
            .order_by(func.count(ErrorGroup.id).desc())
        )
    ).all()
    recent_cutoff = utc_now() - timedelta(days=1)
    recent_occurrences = int(
        (await db.scalar(select(func.count()).select_from(ErrorOccurrence).where(ErrorOccurrence.occurred_at >= recent_cutoff)))
        or 0
    )
    latest_occurrence_at = await db.scalar(select(func.max(ErrorOccurrence.occurred_at)))

    return {
        "groups": {
            "open": int(statuses.get("open", 0)),
            "acknowledged": int(statuses.get("acknowledged", 0)),
            "resolved": int(statuses.get("resolved", 0)),
            "total": int(sum(statuses.values())),
        },
        "recent_occurrences_24h": recent_occurrences,
        "latest_occurrence_at": latest_occurrence_at,
        "sources": [{"source_service": source, "groups": int(count)} for source, count in source_rows],
        "service_health": await service_health(db),
    }


def serialize_group(group: ErrorGroup) -> dict[str, Any]:
    return {
        "id": group.id,
        "fingerprint": group.fingerprint,
        "source_service": group.source_service,
        "error_kind": group.error_kind,
        "severity": group.severity,
        "status": group.status,
        "title": group.title,
        "last_message": group.last_message,
        "route_template": group.route_template,
        "operation": group.operation,
        "last_status_code": group.last_status_code,
        "occurrence_count": group.occurrence_count,
        "first_seen_at": group.first_seen_at,
        "last_seen_at": group.last_seen_at,
        "triaged_by_username": group.triaged_by_username,
        "triaged_at": group.triaged_at,
    }


def serialize_occurrence(occurrence: ErrorOccurrence) -> dict[str, Any]:
    return {
        "id": occurrence.id,
        "source_service": occurrence.source_service,
        "error_kind": occurrence.error_kind,
        "severity": occurrence.severity,
        "message": occurrence.message,
        "stack_trace": occurrence.stack_trace,
        "component_stack": occurrence.component_stack,
        "details": occurrence.details,
        "route_path": occurrence.route_path,
        "route_template": occurrence.route_template,
        "operation": occurrence.operation,
        "method": occurrence.method,
        "status_code": occurrence.status_code,
        "request_id": occurrence.request_id,
        "user_id": occurrence.user_id,
        "username": occurrence.username,
        "ip_address": occurrence.ip_address,
        "user_agent": occurrence.user_agent,
        "client_occurred_at": occurrence.client_occurred_at,
        "occurred_at": occurrence.occurred_at,
    }


@router.get("/api/admin/error-groups")
async def list_error_groups(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_platform_admin),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: str | None = Query(default=None, max_length=32),
    severity: str | None = Query(default=None, max_length=32),
    source_service: str | None = Query(default=None, max_length=64),
    search: str | None = Query(default=None, max_length=120),
    hours: int | None = Query(default=None, ge=1, le=24 * 30),
) -> dict[str, Any]:
    query = select(ErrorGroup)
    count_query = select(func.count()).select_from(ErrorGroup)
    conditions = []
    if status_filter and status_filter != "all":
        conditions.append(ErrorGroup.status == status_filter)
    if severity and severity != "all":
        conditions.append(ErrorGroup.severity == severity)
    if source_service and source_service != "all":
        conditions.append(ErrorGroup.source_service == source_service)
    if search:
        like = f"%{search.strip()}%"
        conditions.append(or_(ErrorGroup.title.ilike(like), ErrorGroup.last_message.ilike(like), ErrorGroup.route_template.ilike(like)))
    if hours:
        conditions.append(ErrorGroup.last_seen_at >= utc_now() - timedelta(hours=hours))

    for condition in conditions:
        query = query.where(condition)
        count_query = count_query.where(condition)

    groups = (
        await db.scalars(
            query.order_by(ErrorGroup.last_seen_at.desc()).offset(offset).limit(limit)
        )
    ).all()
    return {
        "items": [serialize_group(group) for group in groups],
        "total": int((await db.scalar(count_query)) or 0),
    }


@router.get("/api/admin/error-groups/{group_id}")
async def get_error_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_platform_admin),
) -> dict[str, Any]:
    group = await db.scalar(select(ErrorGroup).where(ErrorGroup.id == group_id))
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error group not found.")

    occurrences = (
        await db.scalars(
            select(ErrorOccurrence)
            .where(ErrorOccurrence.group_id == group.id)
            .order_by(ErrorOccurrence.occurred_at.desc())
            .limit(25)
        )
    ).all()
    return {"group": serialize_group(group), "occurrences": [serialize_occurrence(item) for item in occurrences]}


@router.patch("/api/admin/error-groups/{group_id}")
async def update_error_group_triage(
    group_id: int,
    payload: ErrorGroupTriageUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_platform_admin),
) -> dict[str, Any]:
    group = await db.scalar(select(ErrorGroup).where(ErrorGroup.id == group_id))
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error group not found.")

    group.status = payload.status
    group.triaged_at = utc_now()
    group.triaged_by_user_id = admin.id
    group.triaged_by_username = admin.username
    await db.commit()
    await db.refresh(group)
    return serialize_group(group)


@router.get("/api/admin/endpoint-checks")
async def get_endpoint_checks(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_platform_admin),
) -> dict[str, Any]:
    return await endpoint_inventory_response(db, request)


@router.post("/api/admin/endpoint-checks/run")
async def create_endpoint_check_run(
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_platform_admin),
) -> dict[str, Any]:
    run = await run_endpoint_checks(db, request, admin)
    inventory = await endpoint_inventory_response(db, request)
    return {"run": serialize_check_run(run), **inventory}
