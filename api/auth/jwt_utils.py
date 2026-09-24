"""
campus404 Auth — JWT utility functions.

Two token types:
  Access JWT : long-lived  — {sub: username, role, status: "active"}
    Setup JWT  : 15-min       — {email, full_name, provider, avatar_url, gender, status: "pending_username"}
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError, jwt

JWT_SECRET: str = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "30"))
SETUP_TOKEN_EXPIRE_MINUTES = 15


def _encode(payload: dict) -> str:
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )


def create_access_token(
    username: str,
    role: str,
    session_version: int = 1,
    session_id: int | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": username,
        "role": role,
        "status": "active",
        "typ": "access",
        "sv": int(session_version or 1),
        "exp": expire,
    }
    if session_id:
        payload["sid"] = int(session_id)
    return _encode(payload)


def create_refresh_token(
    username: str,
    session_version: int = 1,
    session_id: int | None = None,
    token_id: str | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": username,
        "status": "active",
        "typ": "refresh",
        "sv": int(session_version or 1),
        "exp": expire,
    }
    if session_id:
        payload["sid"] = int(session_id)
    if token_id:
        payload["jti"] = token_id
    return _encode(payload)


def create_setup_token(
    email: str,
    full_name: str,
    provider: str,
    avatar_url: str | None = None,
    gender: str | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=SETUP_TOKEN_EXPIRE_MINUTES)
    return _encode({
        "email": email,
        "full_name": full_name,
        "provider": provider,
        "avatar_url": avatar_url,
        "gender": gender,
        "status": "pending_username",
        "exp": expire,
    })


def verify_setup_token(token: str) -> dict:
    """Decode and validate a Setup JWT. Raises 401 if invalid/wrong status."""
    payload = _decode(token)
    if payload.get("status") != "pending_username":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired setup token.",
        )
    return payload


def verify_refresh_token(token: str) -> dict:
    """Decode and validate a Refresh JWT. Raises 401 if invalid/wrong status."""
    payload = _decode(token)
    if payload.get("typ") != "refresh" or payload.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )
    return payload
