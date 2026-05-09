"""
campus404 Auth — Pydantic schemas for OAuth2 request/response validation.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CompleteProfileRequest(BaseModel):
    """Payload for POST /auth/complete-profile after OAuth intercept."""
    username: str = Field(
        ...,
        min_length=3,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_\-]+$",
    )
    first_name: str = Field(..., min_length=1, max_length=128)
    last_name: str | None = Field(None, max_length=128)
    avatar: str | None = Field(default=None, max_length=512)

    model_config = {"extra": "forbid"}


class AccessTokenResponse(BaseModel):
    """Returned for existing users or after profile completion."""
    access_token: str
    token_type: str = "bearer"
    status: str       # "active"
    role: str
    username: str
    avatar_url: str | None = None


class AuthenticatedUserResponse(BaseModel):
    """Current authenticated user details for session validation."""

    username: str
    role: str
    email: str
    first_name: str
    last_name: str | None = None
    is_active: bool
    avatar: str | None = None


class AdminAccountProfileResponse(BaseModel):
    """Authenticated admin/editor account profile payload."""

    id: int
    username: str
    role: str
    email: str
    first_name: str
    last_name: str | None = None
    auth_provider: str
    avatar: str | None = None
    is_active: bool
    created_at: datetime
    last_login: datetime | None = None
    session_version: int


class AdminAccountProfileUpdateRequest(BaseModel):
    """Patch payload for updating current admin/editor profile fields."""

    first_name: str | None = Field(default=None, min_length=1, max_length=128)
    last_name: str | None = Field(default=None, max_length=128)
    avatar: str | None = Field(default=None, max_length=512)

    model_config = {"extra": "forbid"}


class AdminAccountSessionsRevokeResponse(BaseModel):
    """Returned after revoking current user's sessions."""

    revoked_sessions: int
    session_version: int
    message: str


class SetupTokenResponse(BaseModel):
    """Returned for new users who still need to choose a username."""
    setup_token: str
    token_type: str = "bearer"
    status: str       # "pending_username"
    message: str


class AdminUserResponse(BaseModel):
    """Admin view of a user profile."""
    id: int
    email: str
    first_name: str
    last_name: str | None = None
    username: str
    auth_provider: str
    role: str
    is_active: bool
    ban_reason: str | None = None
    created_at: datetime
    last_login: datetime | None = None
    avatar: str | None = None

    model_config = {"from_attributes": True}


class UserSessionResponse(BaseModel):
    """User login session history."""
    id: int
    login_time: datetime
    logout_time: datetime | None = None
    ip_address: str | None = None
    device_info: str | None = None

    model_config = {"from_attributes": True}


class RoleUpdateRequest(BaseModel):
    """Payload to change user's role."""
    role: str = Field(..., pattern="^(admin|editor|student|user|ADMIN|EDITOR|STUDENT|USER)$")


class BanUpdateRequest(BaseModel):
    """Payload to ban or unban a user."""
    is_active: bool
    ban_reason: str | None = Field(None, max_length=256)


class AdminActivityEventRequest(BaseModel):
    """Payload to record admin/editor interactions from frontend events."""

    activity_type: str = Field(
        ...,
        min_length=2,
        max_length=64,
        pattern=r"^[a-z0-9_:\-]+$",
    )
    activity_context: str | None = Field(default=None, max_length=64)
    target_path: str | None = Field(default=None, max_length=256)
    state: str | None = Field(default=None, max_length=128)
    timezone: str | None = Field(default=None, max_length=64)
    details: dict[str, Any] | None = None

    model_config = {"extra": "forbid"}


class AdminActivityLogItem(BaseModel):
    """Single activity log entry returned to admin dashboard."""

    id: int
    user_id: int | None = None
    username: str | None = None
    role: str | None = None
    activity_type: str
    activity_context: str | None = None
    target_path: str | None = None
    ip_address: str | None = None
    country: str | None = None
    region: str | None = None
    city: str | None = None
    state: str | None = None
    timezone: str | None = None
    user_agent: str | None = None
    details: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminActivityLogListResponse(BaseModel):
    """Paginated activity response for admin panel."""

    items: list[AdminActivityLogItem]
    total: int
