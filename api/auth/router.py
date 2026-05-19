"""
campus404 Auth — OAuth2 Router (Google & GitHub).

All callback URIs are built dynamically from the incoming request object,
so this works across local, staging, and production hosts.

Endpoints:
  GET  /auth/google/login
  GET  /auth/google/callback
  GET  /auth/github/login
  GET  /auth/github/callback
  GET  /auth/check-username
  POST /auth/complete-profile
    GET  /auth/account/profile
    PATCH /auth/account/profile
    GET  /auth/account/sessions
    POST /auth/account/sessions/revoke-all
  POST /auth/logout
  POST /auth/admin-activity
  GET  /auth/admin-activity
"""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth.database import get_db
from auth.jwt_utils import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    _decode,
    create_access_token,
    create_refresh_token,
    create_setup_token,
    verify_refresh_token,
    verify_setup_token,
)
from auth.models import AdminActivityLog, User, UserSession
from auth.schemas import (
    AccessTokenResponse,
    AdminAccountProfileResponse,
    AdminAccountProfileUpdateRequest,
    AdminAccountSessionsRevokeResponse,
    AuthenticatedUserResponse,
    AdminActivityEventRequest,
    AdminActivityLogItem,
    AdminActivityLogListResponse,
    CompleteProfileRequest,
    SetupTokenResponse,
    AdminUserResponse,
    UserSessionResponse,
    RoleUpdateRequest,
    BanUpdateRequest,
)

# ---------------------------------------------------------------------------
# OAuth App credentials — use getenv so missing GitHub doesn't crash startup
# ---------------------------------------------------------------------------

GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")

# Frontend URL — where browser is redirected after OAuth completes
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

ELEVATED_ROLES = {"ADMIN", "EDITOR"}
REFRESH_COOKIE_NAME = os.getenv("AUTH_REFRESH_COOKIE_NAME", "campus404_refresh")
REFRESH_COOKIE_PATH = "/auth"
REFRESH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN") or None


# ---------------------------------------------------------------------------
# Dynamic URL helpers
# ---------------------------------------------------------------------------

def _base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def _google_callback_uri(request: Request) -> str:
    return f"{_base_url(request)}/auth/google/callback"


def _github_callback_uri(request: Request) -> str:
    return f"{_base_url(request)}/auth/github/callback"


# ---------------------------------------------------------------------------
# Request metadata helpers
# ---------------------------------------------------------------------------

def _normalize_role(role: str | None) -> str:
    return (role or "").strip().upper()


def _canonical_role(role: str | None) -> str:
    normalized = (role or "").strip().lower()
    if normalized in {"admin", "editor"}:
        return normalized
    if normalized in {"student", "user"}:
        return "student"
    return "student"


def _is_elevated_role(role: str | None) -> bool:
    return _normalize_role(role) in ELEVATED_ROLES


def _normalize_gender_hint(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    if normalized in {"male", "m", "man", "boy"}:
        return "male"
    if normalized in {"female", "f", "woman", "girl"}:
        return "female"
    return None


def _extract_gender_hint(profile: dict[str, Any]) -> str | None:
    for key in ("gender", "gender_hint", "sex"):
        hint = _normalize_gender_hint(profile.get(key))
        if hint:
            return hint
    return None


def _is_campus_avatar_url(value: str | None) -> bool:
    avatar = (value or "").strip()
    return "assets/avatars/" in avatar or "/avatars/" in avatar


def _serialize_admin_user(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=int(user.id or 0),
        email=((user.email or "").strip() or "unknown@example.com"),
        first_name=((user.first_name or "").strip() or "Unknown"),
        last_name=((user.last_name or "").strip() or None),
        username=((user.username or "").strip() or f"user_{user.id or 0}"),
        auth_provider=((user.auth_provider or "oauth").strip() or "oauth"),
        role=_canonical_role(user.role),
        is_active=bool(user.is_active),
        ban_reason=(user.ban_reason or None),
        created_at=user.created_at or datetime.utcnow(),
        last_login=user.last_login,
        avatar=user.avatar,
    )


def _serialize_account_profile(user: User, normalized_role: str) -> AdminAccountProfileResponse:
    return AdminAccountProfileResponse(
        id=int(user.id or 0),
        username=((user.username or "").strip() or "unknown"),
        role=(normalized_role or _normalize_role(user.role or "student")),
        email=((user.email or "").strip() or "unknown@example.com"),
        first_name=((user.first_name or "").strip() or "Unknown"),
        last_name=((user.last_name or "").strip() or None),
        auth_provider=((user.auth_provider or "oauth").strip() or "oauth"),
        avatar=(user.avatar or None),
        is_active=bool(user.is_active),
        created_at=user.created_at or datetime.utcnow(),
        last_login=user.last_login,
        session_version=int(user.session_version or 1),
    )


def _token_session_version(payload: dict[str, Any]) -> int:
    value = payload.get("sv", 1)
    try:
        version = int(value)
    except (TypeError, ValueError):
        version = 1
    return version if version > 0 else 1


def _token_session_id(payload: dict[str, Any]) -> int | None:
    value = payload.get("sid")
    try:
        session_id = int(value)
    except (TypeError, ValueError):
        return None
    return session_id if session_id > 0 else None


def _refresh_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


def _hash_refresh_token_id(token_id: str) -> str:
    return hashlib.sha256(token_id.encode("utf-8")).hexdigest()


def _cookie_is_secure(request: Request) -> bool:
    explicit = (os.getenv("AUTH_COOKIE_SECURE") or "").strip().lower()
    if explicit in {"1", "true", "yes", "on"}:
        return True
    if explicit in {"0", "false", "no", "off"}:
        return False
    return (
        request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip().lower() == "https"
        or request.url.scheme == "https"
    )


def _set_refresh_cookie(response: Response, request: Request, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=_cookie_is_secure(request),
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
        domain=REFRESH_COOKIE_DOMAIN,
    )


def _clear_refresh_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        domain=REFRESH_COOKIE_DOMAIN,
        secure=_cookie_is_secure(request),
        httponly=True,
        samesite="lax",
    )


async def _create_login_session(
    *,
    db: AsyncSession,
    user: User,
    request: Request,
) -> tuple[UserSession, str]:
    token_id = secrets.token_urlsafe(32)
    session = UserSession(
        user_id=user.id,
        ip_address=_extract_client_ip(request),
        device_info=(request.headers.get("user-agent") or "")[:500] or None,
        refresh_token_hash=_hash_refresh_token_id(token_id),
        refresh_expires_at=_refresh_expires_at(),
    )
    db.add(session)
    await db.flush()
    refresh_token = create_refresh_token(
        user.username,
        int(user.session_version or 1),
        int(session.id),
        token_id,
    )
    return session, refresh_token


def _extract_client_ip(request: Request) -> str | None:
    # Prefer X-Real-IP — NGINX sets this to $remote_addr (the actual client IP)
    # before any X-Forwarded-For chain is appended, so it is the most reliable.
    for header_name in ("x-real-ip", "cf-connecting-ip", "x-client-ip"):
        value = request.headers.get(header_name)
        if value:
            return value.strip()

    # Fall back to X-Forwarded-For first hop (only if the above headers are absent)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()

    if request.client:
        return request.client.host

    return None


# Private/loopback CIDRs — skip geo lookup for these
_PRIVATE_IP_PREFIXES = (
    "127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
    "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
    "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.",
    "172.31.", "::1", "fc", "fd",
)


def _is_private_ip(ip: str | None) -> bool:
    if not ip:
        return True
    return any(ip.startswith(prefix) for prefix in _PRIVATE_IP_PREFIXES)


async def _lookup_geo(ip: str | None) -> dict[str, str | None]:
    """Resolve an IP to country/region/city via ip-api.com (free, no key needed).

    Returns a dict with keys country, region, city — all possibly None.
    Always safe: any network/parse error returns Nones.
    """
    empty: dict[str, str | None] = {"country": None, "region": None, "city": None}

    if _is_private_ip(ip):
        return empty

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,country,regionName,city"},
            )
            if resp.status_code != 200:
                return empty
            data = resp.json()
            if data.get("status") != "success":
                return empty
            return {
                "country": data.get("country") or None,
                "region": data.get("regionName") or None,
                "city": data.get("city") or None,
            }
    except Exception:
        return empty


async def _get_authenticated_user(
    request: Request,
    db: AsyncSession,
) -> tuple[User, str]:
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
    
    token_version = _token_session_version(payload)
    user_version = int(user.session_version or 1)
    if token_version != user_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )

    session_id = _token_session_id(payload)
    if session_id:
        login_session = await db.scalar(
            select(UserSession)
            .where(UserSession.id == session_id)
            .where(UserSession.user_id == user.id)
        )
        if not login_session or login_session.logout_time is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please log in again.",
            )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is banned.")

    return user, _normalize_role(user.role or payload.get("role"))


async def _record_activity(
    *,
    db: AsyncSession,
    request: Request,
    user: User | None,
    role: str | None,
    activity_type: str,
    activity_context: str | None = None,
    target_path: str | None = None,
    details: dict[str, Any] | None = None,
    state: str | None = None,
    timezone: str | None = None,
    resolve_geo: bool = False,
    commit: bool = True,
) -> AdminActivityLog:
    ip = _extract_client_ip(request)
    geo: dict[str, str | None] = {"country": None, "region": None, "city": None}
    if resolve_geo:
        geo = await _lookup_geo(ip)

    sanitized_details = details if isinstance(details, dict) else None

    log = AdminActivityLog(
        user_id=user.id if user else None,
        username=user.username if user else None,
        role=_normalize_role(role) or None,
        activity_type=activity_type,
        activity_context=activity_context,
        target_path=target_path,
        ip_address=ip,
        country=geo["country"],
        region=geo["region"],
        city=geo["city"],
        state=state or geo["region"],
        timezone=timezone,
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        details=sanitized_details,
    )

    db.add(log)

    if commit:
        await db.commit()
        await db.refresh(log)

    return log


async def _invalidate_user_sessions(db: AsyncSession, user: User) -> None:
    now = datetime.utcnow()
    active_sessions = (
        await db.scalars(
            select(UserSession)
            .where(UserSession.user_id == user.id)
            .where(UserSession.logout_time.is_(None))
        )
    ).all()

    for session in active_sessions:
        session.logout_time = now
        session.refresh_token_hash = None
        session.refresh_expires_at = None

    user.session_version = int(user.session_version or 1) + 1


# ---------------------------------------------------------------------------
# Shared intercept logic — always redirects browser to frontend
# ---------------------------------------------------------------------------

async def _handle_oauth_profile(
    email: str,
    full_name: str,
    provider: str,
    avatar_url: str | None,
    gender_hint: str | None,
    db: AsyncSession,
    request: Request,
) -> RedirectResponse:
    user = await db.scalar(select(User).where(User.email == email))

    if user:
        if not user.is_active:
            import urllib.parse
            reason = urllib.parse.quote(user.ban_reason or "Violation of terms.")
            return RedirectResponse(
                url=f"{FRONTEND_URL}/auth/callback?error=banned&reason={reason}"
            )

        user.last_login = datetime.utcnow()
        if avatar_url and user.avatar != avatar_url and not _is_campus_avatar_url(user.avatar):
            user.avatar = avatar_url

        login_session, refresh_token = await _create_login_session(db=db, user=user, request=request)

        normalized_role = _normalize_role(user.role)
        if _is_elevated_role(normalized_role):
            await _record_activity(
                db=db,
                request=request,
                user=user,
                role=normalized_role,
                activity_type="auth_login",
                activity_context="oauth_callback",
                target_path="/auth/callback",
                resolve_geo=True,
                commit=False,
            )

        await db.commit()
        await db.refresh(user)

        token = create_access_token(
            user.username,
            user.role,
            int(user.session_version or 1),
            int(login_session.id),
        )
        params = urlencode(
            {
                "status": "active",
                "token": token,
                "role": user.role,
                "username": user.username,
                "avatar_url": user.avatar or avatar_url or "",
            }
        )
        response = RedirectResponse(f"{FRONTEND_URL}/auth/callback?{params}")
        _set_refresh_cookie(response, request, refresh_token)
        return response

    setup_token = create_setup_token(email, full_name, provider, avatar_url, gender_hint)
    params = urlencode(
        {
            "status": "pending_username",
            "setup_token": setup_token,
        }
    )
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{params}")


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Google ────────────────────────────────────────────────────────────────

@router.get("/google/login", summary="Redirect to Google OAuth consent screen")
async def google_login(request: Request) -> RedirectResponse:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on this server.")

    params = urlencode(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": _google_callback_uri(request),
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "include_granted_scopes": "true",
        }
    )
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback", summary="Google OAuth callback")
async def google_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": _google_callback_uri(request),
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()

            profile_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token_resp.json()['access_token']}"},
            )
            profile_resp.raise_for_status()
            profile = profile_resp.json()

        email: str = profile.get("email", "")
        if not email:
            raise HTTPException(status_code=400, detail="Google did not return an email address.")

        full_name: str = profile.get("name", email.split("@")[0])
        avatar_url: str | None = profile.get("picture") or None
        gender_hint = _extract_gender_hint(profile)

        return await _handle_oauth_profile(email, full_name, "google", avatar_url, gender_hint, db, request)
    except HTTPException:
        raise
    except Exception as exc:
        error_params = urlencode({"error": str(exc)})
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{error_params}")


# ── GitHub ────────────────────────────────────────────────────────────────

@router.get("/github/login", summary="Redirect to GitHub OAuth consent screen")
async def github_login(request: Request) -> RedirectResponse:
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured on this server.")

    params = urlencode(
        {
            "client_id": GITHUB_CLIENT_ID,
            "redirect_uri": _github_callback_uri(request),
            "scope": "read:user user:email",
        }
    )
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@router.get("/github/callback", summary="GitHub OAuth callback")
async def github_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": _github_callback_uri(request),
                },
                headers={"Accept": "application/json"},
            )
            token_resp.raise_for_status()
            gh_token = token_resp.json().get("access_token", "")

            if not gh_token:
                raise HTTPException(status_code=400, detail="GitHub did not return an access token.")

            gh_headers = {
                "Authorization": f"Bearer {gh_token}",
                "Accept": "application/vnd.github+json",
            }

            profile_resp = await client.get("https://api.github.com/user", headers=gh_headers)
            profile_resp.raise_for_status()
            profile = profile_resp.json()

            email: str = profile.get("email") or ""
            if not email:
                emails_resp = await client.get("https://api.github.com/user/emails", headers=gh_headers)
                emails_resp.raise_for_status()
                primary = next(
                    (item for item in emails_resp.json() if item.get("primary") and item.get("verified")),
                    None,
                )
                email = primary["email"] if primary else ""

        if not email:
            raise HTTPException(status_code=400, detail="GitHub did not return a verified email address.")

        full_name: str = profile.get("name") or profile.get("login", email.split("@")[0])
        avatar_url: str | None = profile.get("avatar_url") or None
        gender_hint = _extract_gender_hint(profile)

        return await _handle_oauth_profile(email, full_name, "github", avatar_url, gender_hint, db, request)
    except HTTPException:
        raise
    except Exception as exc:
        error_params = urlencode({"error": str(exc)})
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{error_params}")


# ── Username Check ────────────────────────────────────────────────────────

@router.get("/check-username", summary="Check if a username is available")
async def check_username(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    if not username:
        return {"available": False}

    user = await db.scalar(select(User).where(User.username == username))
    return {"available": user is None}


# ── Complete Profile ───────────────────────────────────────────────────────

@router.post(
    "/complete-profile",
    response_model=AccessTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Choose username — finalises new user registration",
)
async def complete_profile(
    payload: CompleteProfileRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AccessTokenResponse:
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required in Authorization header.")

    claims = verify_setup_token(auth_header[7:])

    email: str = claims["email"]
    provider: str = claims["provider"]
    avatar_url: str | None = claims.get("avatar_url")
    selected_avatar_url = payload.avatar.strip() if payload.avatar else None
    final_avatar_url = selected_avatar_url or avatar_url

    if await db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken. Please choose another.",
        )

    if await db.scalar(select(User).where(User.email == email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in.",
        )

    new_user = User(
        email=email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        username=payload.username,
        auth_provider=provider,
        role="student",
        last_login=datetime.utcnow(),
        avatar=final_avatar_url,
    )
    db.add(new_user)

    try:
        await db.commit()
        await db.refresh(new_user)

        login_session, refresh_token = await _create_login_session(db=db, user=new_user, request=request)
        await db.commit()
        await db.refresh(new_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email conflict. Please try again.",
        )

    token = create_access_token(
        new_user.username,
        new_user.role,
        int(new_user.session_version or 1),
        int(login_session.id),
    )
    _set_refresh_cookie(response, request, refresh_token)
    return AccessTokenResponse(
        access_token=token,
        status="active",
        role=new_user.role,
        username=new_user.username,
        avatar_url=final_avatar_url,
    )


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Refresh an authenticated browser session",
)
async def refresh_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AccessTokenResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session required.")

    payload = verify_refresh_token(refresh_token)
    username = payload.get("sub")
    session_id = _token_session_id(payload)
    token_id = str(payload.get("jti") or "")
    if not username or not session_id or not token_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh session.")

    user = await db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is not available.")

    if _token_session_version(payload) != int(user.session_version or 1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked.")

    login_session = await db.scalar(
        select(UserSession)
        .where(UserSession.id == session_id)
        .where(UserSession.user_id == user.id)
    )
    if (
        not login_session
        or login_session.logout_time is not None
        or not login_session.refresh_token_hash
        or login_session.refresh_token_hash != _hash_refresh_token_id(token_id)
        or (
            login_session.refresh_expires_at is not None
            and login_session.refresh_expires_at <= datetime.utcnow()
        )
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session has expired.")

    access_token = create_access_token(
        user.username,
        user.role,
        int(user.session_version or 1),
        int(login_session.id),
    )
    _set_refresh_cookie(response, request, refresh_token)

    return AccessTokenResponse(
        access_token=access_token,
        status="active",
        role=user.role,
        username=user.username,
        avatar_url=user.avatar,
    )


@router.get(
    "/me",
    response_model=AuthenticatedUserResponse,
    summary="Get current authenticated user",
)
async def get_authenticated_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthenticatedUserResponse:
    user, normalized_role = await _get_authenticated_user(request, db)

    return AuthenticatedUserResponse(
        username=user.username,
        role=normalized_role,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=bool(user.is_active),
        avatar=user.avatar,
    )


@router.get(
    "/account/profile",
    response_model=AdminAccountProfileResponse,
    summary="Get current admin/editor account profile",
)
async def get_account_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminAccountProfileResponse:
    user, normalized_role = await _get_authenticated_user(request, db)

    if not _is_elevated_role(normalized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can access account profile.",
        )

    return _serialize_account_profile(user, normalized_role)


@router.patch(
    "/account/profile",
    response_model=AdminAccountProfileResponse,
    summary="Update current admin/editor profile fields",
)
async def update_account_profile(
    payload: AdminAccountProfileUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminAccountProfileResponse:
    user, normalized_role = await _get_authenticated_user(request, db)

    if not _is_elevated_role(normalized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can update account profile.",
        )

    changed_fields: list[str] = []

    if payload.first_name is not None:
        first_name = payload.first_name.strip()
        if not first_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="first_name cannot be blank.",
            )
        if first_name != (user.first_name or ""):
            user.first_name = first_name
            changed_fields.append("first_name")

    if payload.last_name is not None:
        last_name = payload.last_name.strip() or None
        if last_name != (user.last_name or None):
            user.last_name = last_name
            changed_fields.append("last_name")

    if payload.avatar is not None:
        avatar = payload.avatar.strip() or None
        if avatar != (user.avatar or None):
            user.avatar = avatar
            changed_fields.append("avatar")

    if not changed_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile changes submitted.",
        )

    await _record_activity(
        db=db,
        request=request,
        user=user,
        role=normalized_role,
        activity_type="account_profile_updated",
        activity_context="my_account_panel",
        target_path="/auth/account/profile",
        details={"fields": changed_fields},
        commit=False,
    )

    await db.commit()
    await db.refresh(user)

    return _serialize_account_profile(user, normalized_role)


@router.get(
    "/account/sessions",
    response_model=list[UserSessionResponse],
    summary="Get current admin/editor login sessions",
)
async def list_account_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=25, ge=1, le=100),
) -> list[UserSessionResponse]:
    user, normalized_role = await _get_authenticated_user(request, db)

    if not _is_elevated_role(normalized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can view account sessions.",
        )

    sessions = (
        await db.scalars(
            select(UserSession)
            .where(UserSession.user_id == user.id)
            .order_by(desc(UserSession.login_time))
            .limit(limit)
        )
    ).all()

    return [UserSessionResponse.model_validate(session) for session in sessions]


@router.post(
    "/account/sessions/revoke-all",
    response_model=AdminAccountSessionsRevokeResponse,
    summary="Revoke all current admin/editor sessions",
)
async def revoke_account_sessions(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AdminAccountSessionsRevokeResponse:
    user, normalized_role = await _get_authenticated_user(request, db)

    if not _is_elevated_role(normalized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can revoke account sessions.",
        )

    active_sessions = (
        await db.scalars(
            select(UserSession)
            .where(UserSession.user_id == user.id)
            .where(UserSession.logout_time.is_(None))
        )
    ).all()
    revoked_count = len(active_sessions)

    await _invalidate_user_sessions(db, user)

    await _record_activity(
        db=db,
        request=request,
        user=user,
        role=normalized_role,
        activity_type="account_sessions_revoked",
        activity_context="my_account_panel",
        target_path="/auth/account/sessions/revoke-all",
        details={"revoked_sessions": revoked_count},
        resolve_geo=True,
        commit=False,
    )

    await db.commit()
    await db.refresh(user)
    _clear_refresh_cookie(response, request)

    return AdminAccountSessionsRevokeResponse(
        revoked_sessions=revoked_count,
        session_version=int(user.session_version or 1),
        message="All active sessions were revoked. Please sign in again.",
    )


# ── Logout ────────────────────────────────────────────────────────────────

@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout user and record logout time",
)
async def logout_user(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    _clear_refresh_cookie(response, request)
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization") or ""

    try:
        payload: dict[str, Any] = {}
        if auth_header.lower().startswith("bearer "):
            try:
                payload = _decode(auth_header[7:])
            except Exception:
                payload = {}

        if not payload:
            refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
            if refresh_token:
                try:
                    payload = verify_refresh_token(refresh_token)
                except Exception:
                    payload = {}

        username = payload.get("sub")
        if not username:
            return

        user = await db.scalar(select(User).where(User.username == username))
        if not user:
            return

        session_id = _token_session_id(payload)
        if session_id:
            recent_session = await db.scalar(
                select(UserSession)
                .where(UserSession.id == session_id)
                .where(UserSession.user_id == user.id)
                .limit(1)
            )
        else:
            recent_session = await db.scalar(
                select(UserSession)
                .where(UserSession.user_id == user.id)
                .where(UserSession.logout_time.is_(None))
                .order_by(desc(UserSession.login_time))
                .limit(1)
            )

        if recent_session:
            if recent_session.logout_time is None:
                recent_session.logout_time = datetime.utcnow()
            recent_session.refresh_token_hash = None
            recent_session.refresh_expires_at = None

        normalized_role = _normalize_role(user.role)
        if _is_elevated_role(normalized_role):
            await _record_activity(
                db=db,
                request=request,
                user=user,
                role=normalized_role,
                activity_type="auth_logout",
                activity_context="header_profile_menu",
                target_path="/auth/logout",
                resolve_geo=True,
                commit=False,
            )

        await db.commit()
    except Exception:
        # Ignore token decode and db issues so frontend can always clear local session.
        pass


# ── Admin Activity Tracking ────────────────────────────────────────────────

@router.post(
    "/admin-activity",
    status_code=status.HTTP_201_CREATED,
    summary="Record admin/editor activity event",
)
async def create_admin_activity_event(
    payload: AdminActivityEventRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    user, normalized_role = await _get_authenticated_user(request, db)

    if not _is_elevated_role(normalized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor activity is accepted for this endpoint.",
        )

    log = await _record_activity(
        db=db,
        request=request,
        user=user,
        role=normalized_role,
        activity_type=payload.activity_type,
        activity_context=payload.activity_context,
        target_path=payload.target_path,
        details=payload.details,
        state=payload.state,
        timezone=payload.timezone,
    )

    return {
        "logged": True,
        "id": log.id,
        "created_at": log.created_at.isoformat(),
    }


@router.get(
    "/admin-activity",
    response_model=AdminActivityLogListResponse,
    summary="List admin/editor activity logs",
)
async def list_admin_activity_logs(
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    role: str | None = Query(default=None, max_length=32),
    activity_type: str | None = Query(default=None, max_length=64),
    username: str | None = Query(default=None, max_length=64),
) -> AdminActivityLogListResponse:
    _, normalized_role = await _get_authenticated_user(request, db)

    if not _is_elevated_role(normalized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can view activity logs.",
        )

    query = select(AdminActivityLog)
    count_query = select(func.count()).select_from(AdminActivityLog)

    if role:
        normalized_filter_role = _normalize_role(role)
        query = query.where(AdminActivityLog.role == normalized_filter_role)
        count_query = count_query.where(AdminActivityLog.role == normalized_filter_role)

    if activity_type:
        query = query.where(AdminActivityLog.activity_type == activity_type)
        count_query = count_query.where(AdminActivityLog.activity_type == activity_type)

    if username:
        query = query.where(AdminActivityLog.username == username)
        count_query = count_query.where(AdminActivityLog.username == username)

    query = query.order_by(AdminActivityLog.created_at.desc()).offset(offset).limit(limit)

    items = (await db.scalars(query)).all()
    total = (await db.scalar(count_query)) or 0

    return AdminActivityLogListResponse(
        items=[AdminActivityLogItem.model_validate(item) for item in items],
        total=total,
    )


# ── Admin User Management ──────────────────────────────────────────────────

@router.get(
    "/admin/users",
    response_model=list[AdminUserResponse],
    summary="List users for admin panel",
)
async def list_admin_users(
    request: Request,
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(default=None, max_length=64),
    role: str | None = Query(default=None, max_length=32),
) -> list[AdminUserResponse]:
    _, normalized_role = await _get_authenticated_user(request, db)

    if not _is_elevated_role(normalized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can view the user list.",
        )

    query = select(User)

    if role:
        requested_role = _canonical_role(role)
        query = query.where(func.lower(User.role) == requested_role)

    if search:
        s = f"%{search}%"
        query = query.where(
            (User.username.ilike(s)) | (User.email.ilike(s)) | (User.first_name.ilike(s))
        )

    query = query.order_by(User.created_at.desc()).limit(200)

    users = (await db.scalars(query)).all()
    return [_serialize_admin_user(u) for u in users]


@router.get(
    "/admin/users/{user_id}/sessions",
    response_model=list[UserSessionResponse],
    summary="Get user activity logs (sessions) for admin panel",
)
async def get_user_sessions(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[UserSessionResponse]:
    _, normalized_role = await _get_authenticated_user(request, db)

    if not _is_elevated_role(normalized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/editor users can view user sessions.",
        )

    query = (
        select(UserSession)
        .where(UserSession.user_id == user_id)
        .order_by(desc(UserSession.login_time))
        .limit(limit)
    )
    sessions = (await db.scalars(query)).all()
    return [UserSessionResponse.model_validate(s) for s in sessions]


@router.post(
    "/admin/users/{user_id}/role",
    response_model=AdminUserResponse,
    summary="Update user role",
)
async def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    admin_user, admin_role = await _get_authenticated_user(request, db)

    if admin_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can modify user roles.",
        )

    if admin_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role.",
        )

    target_user = await db.scalar(select(User).where(User.id == user_id))
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    target_user.role = _canonical_role(payload.role)

    await _record_activity(
        db=db, request=request, user=admin_user, role=admin_role,
        activity_type="admin_update_role", activity_context=f"User {target_user.username}", target_path=f"/users/{user_id}",
        details={"new_role": target_user.role},
        commit=False,
    )

    await _invalidate_user_sessions(db, target_user)

    await db.commit()
    await db.refresh(target_user)
    return _serialize_admin_user(target_user)


@router.post(
    "/admin/users/{user_id}/status",
    response_model=AdminUserResponse,
    summary="Update user ban status",
)
async def update_user_status(
    user_id: int,
    payload: BanUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    admin_user, admin_role = await _get_authenticated_user(request, db)

    if admin_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can ban/unban users.",
        )

    if admin_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot ban yourself.",
        )

    target_user = await db.scalar(select(User).where(User.id == user_id))
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    target_user.is_active = payload.is_active
    target_user.ban_reason = payload.ban_reason if not payload.is_active else None

    await _record_activity(
        db=db, request=request, user=admin_user, role=admin_role,
        activity_type="admin_ban_user" if not payload.is_active else "admin_unban_user",
        activity_context=f"User {target_user.username}", target_path=f"/users/{user_id}",
        details={"reason": payload.ban_reason},
        commit=False,
    )

    await _invalidate_user_sessions(db, target_user)

    await db.commit()
    await db.refresh(target_user)
    return _serialize_admin_user(target_user)
