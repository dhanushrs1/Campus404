from __future__ import annotations

from time import monotonic
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.database import get_db
from auth.jwt_utils import _decode
from auth.models import User
from contact.models import ContactMessage
from contact.schemas import (
    ContactMessageCreate,
    ContactMessageListResponse,
    ContactMessageResponse,
    ContactMessageUpdate,
)

router = APIRouter(tags=["contact"])

ELEVATED_ROLES = {"ADMIN", "EDITOR"}
RATE_LIMIT_WINDOW_SECONDS = 600
RATE_LIMIT_MAX_MESSAGES = 5
_submission_attempts: dict[str, list[float]] = {}


def _normalize_role(role: str | None) -> str:
    return (role or "").strip().upper()


def _token_session_version(payload: dict[str, Any]) -> int:
    value = payload.get("sv", 1)
    try:
        version = int(value)
    except (TypeError, ValueError):
        version = 1
    return version if version > 0 else 1


async def _get_current_admin(request: Request, db: AsyncSession) -> User:
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required.")

    payload = _decode(auth_header[7:])
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.")

    user = await db.scalar(select(User).where(User.username == username))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is banned.")

    if _token_session_version(payload) != int(user.session_version or 1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )

    if _normalize_role(user.role) not in ELEVATED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can manage contact messages.",
        )

    return user


def _clean_text(value: str) -> str:
    return " ".join(value.strip().split())


def _extract_client_ip(request: Request) -> str | None:
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


def _assert_rate_limit(ip_address: str | None, email: str) -> None:
    key = f"{ip_address or 'unknown'}:{email.lower()}"
    now = monotonic()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    attempts = [
        timestamp
        for timestamp in _submission_attempts.get(key, [])
        if timestamp >= window_start
    ]

    if len(attempts) >= RATE_LIMIT_MAX_MESSAGES:
        _submission_attempts[key] = attempts
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many contact messages. Please wait a few minutes and try again.",
        )

    attempts.append(now)
    _submission_attempts[key] = attempts


@router.post(
    "/api/contact-messages",
    response_model=ContactMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a public contact message",
)
async def create_contact_message(
    request: Request,
    payload: ContactMessageCreate,
    db: AsyncSession = Depends(get_db),
) -> ContactMessage:
    if not payload.consent_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent is required before sending a contact message.",
        )

    ip_address = _extract_client_ip(request)
    email = str(payload.email).strip().lower()
    _assert_rate_limit(ip_address, email)

    item = ContactMessage(
        name=_clean_text(payload.name),
        email=email,
        subject=_clean_text(payload.subject),
        message=payload.message.strip(),
        consent_accepted=True,
        ip_address=ip_address,
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        status="unread",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get(
    "/api/admin/contact-messages",
    response_model=ContactMessageListResponse,
    summary="List contact messages for admin inbox",
)
async def list_contact_messages(
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: str | None = Query(default=None, max_length=24),
    search: str | None = Query(default=None, max_length=100),
) -> ContactMessageListResponse:
    await _get_current_admin(request, db)

    query = select(ContactMessage)
    count_query = select(func.count()).select_from(ContactMessage)
    unread_count_query = (
        select(func.count())
        .select_from(ContactMessage)
        .where(ContactMessage.status == "unread")
    )
    conditions = []

    if status_filter and status_filter != "all":
        conditions.append(ContactMessage.status == status_filter)

    if search:
        like_value = f"%{search.strip()}%"
        conditions.append(
            or_(
                ContactMessage.name.ilike(like_value),
                ContactMessage.email.ilike(like_value),
                ContactMessage.subject.ilike(like_value),
                ContactMessage.message.ilike(like_value),
            )
        )

    for condition in conditions:
        query = query.where(condition)
        count_query = count_query.where(condition)

    query = query.order_by(ContactMessage.created_at.desc()).offset(offset).limit(limit)

    items = (await db.scalars(query)).all()
    total = int((await db.scalar(count_query)) or 0)

    return ContactMessageListResponse(
        items=[ContactMessageResponse.model_validate(item) for item in items],
        total=total,
        unread_total=int((await db.scalar(unread_count_query)) or 0),
    )


@router.patch(
    "/api/admin/contact-messages/{message_id}",
    response_model=ContactMessageResponse,
    summary="Update contact message admin state",
)
async def update_contact_message(
    message_id: int,
    payload: ContactMessageUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ContactMessage:
    await _get_current_admin(request, db)

    item = await db.scalar(select(ContactMessage).where(ContactMessage.id == message_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact message not found.")

    if payload.status is not None:
        item.status = payload.status
    if payload.admin_note is not None:
        item.admin_note = payload.admin_note.strip() or None

    await db.commit()
    await db.refresh(item)
    return item
