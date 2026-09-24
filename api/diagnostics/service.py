from __future__ import annotations

import hashlib
import re
import traceback
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.database import AsyncSessionLocal
from auth.jwt_utils import _decode
from auth.models import User
from diagnostics.models import EndpointCheckRun, ErrorGroup, ErrorOccurrence

RETENTION_DAYS = 30
MAX_MESSAGE_LENGTH = 4096
MAX_STACK_LENGTH = 24000
MAX_DETAIL_TEXT_LENGTH = 2048
MAX_DETAIL_LIST_ITEMS = 40
REDACTED = "[redacted]"
SECRET_KEY_RE = re.compile(r"(authorization|cookie|token|secret|password|jwt|api[_-]?key|source[_-]?code)", re.I)
BEARER_RE = re.compile(r"(?i)\bbearer\s+[a-z0-9._~+/=-]+")
JWT_RE = re.compile(r"\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b")
SECRET_ASSIGNMENT_RE = re.compile(
    r"(?i)\b(token|secret|password|jwt|api[_-]?key)\b(\s*[:=]\s*)([^\s,;]+)"
)
UUID_RE = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)
LONG_HEX_RE = re.compile(r"\b[0-9a-f]{16,}\b", re.I)
NUMBER_RE = re.compile(r"\b\d+\b")
SPACE_RE = re.compile(r"\s+")


@dataclass
class ErrorEvent:
    source_service: str
    error_kind: str
    message: str
    severity: str = "error"
    stack_trace: str | None = None
    component_stack: str | None = None
    details: dict[str, Any] | None = None
    route_path: str | None = None
    route_template: str | None = None
    operation: str | None = None
    method: str | None = None
    status_code: int | None = None
    request_id: str | None = None
    user_id: int | None = None
    username: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    client_occurred_at: datetime | None = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def extract_client_ip(request: Request) -> str | None:
    for header_name in ("x-real-ip", "cf-connecting-ip", "x-client-ip"):
        value = request.headers.get(header_name)
        if value:
            return value.strip()[:64]

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]

    if request.client:
        return request.client.host[:64]

    return None


def route_template_from_request(request: Request) -> str | None:
    route = request.scope.get("route")
    raw_path = getattr(route, "path", None)
    return str(raw_path)[:512] if raw_path else None


def request_id_from_request(request: Request) -> str | None:
    state_request_id = getattr(request.state, "request_id", None)
    raw = state_request_id or request.headers.get("x-request-id")
    return str(raw)[:96] if raw else None


def redact_text(value: Any, *, limit: int = MAX_DETAIL_TEXT_LENGTH) -> str | None:
    if value is None:
        return None

    text = str(value)
    text = BEARER_RE.sub(f"Bearer {REDACTED}", text)
    text = JWT_RE.sub(REDACTED, text)
    text = SECRET_ASSIGNMENT_RE.sub(lambda match: f"{match.group(1)}{match.group(2)}{REDACTED}", text)
    return text[:limit]


def sanitize_details(value: Any, *, depth: int = 0) -> Any:
    if depth > 4:
        return "[truncated]"

    if isinstance(value, dict):
        cleaned: dict[str, Any] = {}
        for raw_key, raw_value in list(value.items())[:MAX_DETAIL_LIST_ITEMS]:
            key = str(raw_key)[:128]
            cleaned[key] = REDACTED if SECRET_KEY_RE.search(key) else sanitize_details(raw_value, depth=depth + 1)
        return cleaned

    if isinstance(value, list):
        return [sanitize_details(item, depth=depth + 1) for item in value[:MAX_DETAIL_LIST_ITEMS]]

    if isinstance(value, (bool, int, float)) or value is None:
        return value

    return redact_text(value)


def normalize_message(value: str | None) -> str:
    text = SPACE_RE.sub(" ", redact_text(value or "Operational error", limit=MAX_MESSAGE_LENGTH) or "").strip().lower()
    text = UUID_RE.sub("{uuid}", text)
    text = LONG_HEX_RE.sub("{hex}", text)
    text = NUMBER_RE.sub("{n}", text)
    return text[:1024] or "operational error"


def stack_signal(value: str | None) -> str:
    if not value:
        return ""

    for line in value.splitlines():
        normalized = normalize_message(line)
        if normalized and "traceback" not in normalized:
            return normalized[:512]
    return ""


def fingerprint_for_event(event: ErrorEvent) -> str:
    material = "|".join(
        [
            event.source_service.strip().lower(),
            event.error_kind.strip().lower(),
            normalize_message(event.message),
            normalize_message(event.route_template or event.operation or event.route_path or ""),
            stack_signal(event.stack_trace or event.component_stack),
        ]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def title_for_event(event: ErrorEvent) -> str:
    message = redact_text(event.message, limit=512) or "Operational error"
    return SPACE_RE.sub(" ", message).strip()[:512] or "Operational error"


def is_diagnostics_path(path: str) -> bool:
    return path.startswith(
        (
            "/api/diagnostics",
            "/api/internal/diagnostics",
            "/api/admin/error-",
            "/api/admin/error-handling",
            "/api/admin/endpoint-checks",
        )
    )


def exception_stack(exc: Exception) -> str:
    return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))


async def optional_request_user(db: AsyncSession, request: Request) -> User | None:
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None

    try:
        payload = _decode(auth_header[7:])
    except HTTPException:
        return None

    username = str(payload.get("sub") or "").strip()
    if not username:
        return None

    return await db.scalar(select(User).where(User.username == username))


async def enrich_event_from_request(db: AsyncSession, event: ErrorEvent, request: Request) -> ErrorEvent:
    event.route_path = event.route_path or str(request.url.path)[:512]
    event.route_template = event.route_template or route_template_from_request(request)
    event.method = event.method or request.method[:16]
    event.request_id = event.request_id or request_id_from_request(request)
    event.ip_address = event.ip_address or extract_client_ip(request)
    event.user_agent = event.user_agent or (request.headers.get("user-agent") or "")[:512] or None

    if event.user_id is None and event.username is None:
        user = await optional_request_user(db, request)
        if user:
            event.user_id = user.id
            event.username = user.username

    return event


async def prune_retained_diagnostics(db: AsyncSession, *, now: datetime | None = None) -> None:
    cutoff = (now or utc_now()) - timedelta(days=RETENTION_DAYS)
    await db.execute(
        delete(ErrorOccurrence)
        .where(ErrorOccurrence.occurred_at < cutoff)
        .execution_options(synchronize_session=False)
    )
    await db.execute(
        delete(ErrorGroup)
        .where(ErrorGroup.last_seen_at < cutoff)
        .execution_options(synchronize_session=False)
    )
    await db.execute(
        delete(EndpointCheckRun)
        .where(EndpointCheckRun.created_at < cutoff)
        .execution_options(synchronize_session=False)
    )


async def record_error_event(
    db: AsyncSession,
    event: ErrorEvent,
    *,
    request: Request | None = None,
    commit: bool = True,
) -> tuple[ErrorGroup, ErrorOccurrence]:
    if request is not None:
        event = await enrich_event_from_request(db, event, request)

    event.source_service = (redact_text(event.source_service, limit=64) or "unknown").strip().lower()
    event.error_kind = (redact_text(event.error_kind, limit=64) or "operational_error").strip().lower()
    event.severity = (redact_text(event.severity, limit=32) or "error").strip().lower()
    event.message = redact_text(event.message, limit=MAX_MESSAGE_LENGTH) or "Operational error"
    event.stack_trace = redact_text(event.stack_trace, limit=MAX_STACK_LENGTH)
    event.component_stack = redact_text(event.component_stack, limit=MAX_STACK_LENGTH)
    event.details = sanitize_details(event.details) if event.details else None
    event.route_path = redact_text(event.route_path, limit=512)
    event.route_template = redact_text(event.route_template, limit=512)
    event.operation = redact_text(event.operation, limit=512)
    event.method = redact_text(event.method, limit=16)
    event.request_id = redact_text(event.request_id, limit=96)
    event.username = redact_text(event.username, limit=64)
    event.ip_address = redact_text(event.ip_address, limit=64)
    event.user_agent = redact_text(event.user_agent, limit=512)
    now = utc_now()
    fingerprint = fingerprint_for_event(event)

    group = await db.scalar(select(ErrorGroup).where(ErrorGroup.fingerprint == fingerprint))
    if group is None:
        group = ErrorGroup(
            fingerprint=fingerprint,
            source_service=event.source_service,
            error_kind=event.error_kind,
            severity=event.severity,
            status="open",
            title=title_for_event(event),
            last_message=event.message,
            route_template=event.route_template,
            operation=event.operation,
            last_status_code=event.status_code,
            occurrence_count=1,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(group)
        await db.flush()
    else:
        group.occurrence_count = int(group.occurrence_count or 0) + 1
        group.last_seen_at = now
        group.last_message = event.message
        group.last_status_code = event.status_code
        group.severity = event.severity
        group.route_template = event.route_template or group.route_template
        group.operation = event.operation or group.operation
        if group.status == "resolved":
            group.status = "open"
            group.triaged_at = None
            group.triaged_by_user_id = None
            group.triaged_by_username = None

    occurrence = ErrorOccurrence(
        group_id=group.id,
        source_service=event.source_service,
        error_kind=event.error_kind,
        severity=event.severity,
        message=event.message,
        stack_trace=event.stack_trace,
        component_stack=event.component_stack,
        details=event.details,
        route_path=event.route_path,
        route_template=event.route_template,
        operation=event.operation,
        method=event.method,
        status_code=event.status_code,
        request_id=event.request_id,
        user_id=event.user_id,
        username=event.username,
        ip_address=event.ip_address,
        user_agent=event.user_agent,
        client_occurred_at=event.client_occurred_at,
        occurred_at=now,
    )
    db.add(occurrence)
    await prune_retained_diagnostics(db, now=now)

    if commit:
        await db.commit()
        await db.refresh(group)
        await db.refresh(occurrence)
    else:
        await db.flush()

    return group, occurrence


async def record_error_best_effort(event: ErrorEvent, *, request: Request | None = None) -> None:
    try:
        async with AsyncSessionLocal() as db:
            await record_error_event(db, event, request=request)
    except Exception:
        # Diagnostics must not turn a broken request into a second failure.
        return
