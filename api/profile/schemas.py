from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, HttpUrl, field_validator


def _optional_http_url(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    parsed = HttpUrl(cleaned)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("URL must use http or https.")
    return str(parsed)


class AccountSummary(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str | None = None
    auth_provider: str
    role: str
    avatar: str | None = None
    created_at: datetime
    last_login: datetime | None = None


class UserProfilePayload(BaseModel):
    display_name: str
    headline: str | None = None
    bio: str | None = None
    location_text: str | None = None
    website_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    avatar_source: str = "selected"
    selected_avatar_url: str | None = None
    provider_avatar_url: str | None = None
    active_avatar_url: str | None = None
    is_public: bool = True
    show_badges: bool = True
    show_certificates: bool = True
    show_activity: bool = True
    show_projects: bool = True
    show_rank: bool = True
    show_connections: bool = True


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=160)
    headline: str | None = Field(default=None, max_length=180)
    bio: str | None = Field(default=None, max_length=1200)
    location_text: str | None = Field(default=None, max_length=128)
    website_url: str | None = Field(default=None, max_length=512)
    github_url: str | None = Field(default=None, max_length=512)
    linkedin_url: str | None = Field(default=None, max_length=512)
    portfolio_url: str | None = Field(default=None, max_length=512)
    avatar_source: str | None = Field(default=None, pattern="^(selected|provider)$")
    selected_avatar_url: str | None = Field(default=None, max_length=512)
    is_public: bool | None = None
    show_badges: bool | None = None
    show_certificates: bool | None = None
    show_activity: bool | None = None
    show_projects: bool | None = None
    show_rank: bool | None = None
    show_connections: bool | None = None

    @field_validator("website_url", "github_url", "linkedin_url", "portfolio_url", mode="before")
    @classmethod
    def validate_public_url(cls, value: Any) -> str | None:
        return _optional_http_url(value)

    model_config = {"extra": "forbid"}


class ProfileMetrics(BaseModel):
    total_xp: int = 0
    completed_exercises: int = 0
    completed_tracks: int = 0
    current_streak: int = 0
    global_rank: int | None = None
    badges_count: int = 0
    certificates_count: int = 0
    connections_count: int = 0
    connecting_count: int = 0


class BadgeSummary(BaseModel):
    id: int
    badge_id: int
    title: str
    description: str | None = None
    icon_url: str | None = None
    awarded_at: datetime


class CertificateSummary(BaseModel):
    id: int
    track_id: int
    track_title: str
    certificate_code: str
    title: str
    issued_at: datetime


class CertificateClaimResponse(BaseModel):
    certificate: CertificateSummary
    already_claimed: bool = False


class CertificateListResponse(BaseModel):
    claimed: list[CertificateSummary] = Field(default_factory=list)
    eligible_tracks: list[dict[str, Any]] = Field(default_factory=list)


class ActivityDay(BaseModel):
    date: str
    xp: int = 0
    events: int = 0


class CreditLedgerItem(BaseModel):
    id: int
    amount: int
    source_type: str
    source_id: str
    reason: str
    created_at: datetime


class RewardSummary(BaseModel):
    balance: int = 0
    daily_check_in_claimed: bool = False
    daily_check_in_streak: int = 0
    next_daily_check_in_date: str
    recent_ledger: list[CreditLedgerItem] = Field(default_factory=list)


class DailyCheckInResponse(BaseModel):
    claimed: bool
    awarded: int = 0
    balance: int = 0
    daily_check_in_streak: int = 0
    already_claimed: bool = False
    bonus_awarded: int = 0


class ProjectPinBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=800)
    project_url: HttpUrl = Field(..., max_length=512)
    image_url: HttpUrl | None = Field(default=None, max_length=512)
    tags: list[str] = Field(default_factory=list, max_length=8)
    is_public: bool = True
    order: int = 0


class ProjectPinCreate(ProjectPinBase):
    model_config = {"extra": "forbid"}


class ProjectPinUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=800)
    project_url: HttpUrl | None = Field(default=None, max_length=512)
    image_url: HttpUrl | None = Field(default=None, max_length=512)
    tags: list[str] | None = Field(default=None, max_length=8)
    is_public: bool | None = None
    order: int | None = None

    model_config = {"extra": "forbid"}


class ProjectPinResponse(ProjectPinBase):
    id: int
    created_at: datetime
    updated_at: datetime


class SessionSummary(BaseModel):
    id: int
    login_time: datetime
    logout_time: datetime | None = None
    ip_address: str | None = None
    device_info: str | None = None


class SessionRevokeResponse(BaseModel):
    revoked_sessions: int
    session_version: int
    message: str


class AccountChangeRequestCreate(BaseModel):
    request_type: str = Field(..., pattern="^(email_change|provider_change)$")
    requested_email: EmailStr | None = Field(default=None, max_length=256)
    requested_provider: str | None = Field(default=None, pattern="^(google|github)$")
    note: str | None = Field(default=None, max_length=1000)

    model_config = {"extra": "forbid"}


class AccountChangeRequestResponse(BaseModel):
    id: int
    request_type: str
    requested_email: str | None = None
    requested_provider: str | None = None
    note: str | None = None
    status: str
    created_at: datetime


class PrivateProfileResponse(BaseModel):
    account: AccountSummary
    profile: UserProfilePayload
    metrics: ProfileMetrics
    rewards: RewardSummary
    projects: list[ProjectPinResponse] = Field(default_factory=list)
    badges: list[BadgeSummary] = Field(default_factory=list)
    certificates: CertificateListResponse
    activity: list[ActivityDay] = Field(default_factory=list)


class PublicProfileResponse(BaseModel):
    username: str
    display_name: str
    headline: str | None = None
    bio: str | None = None
    location_text: str | None = None
    website_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    avatar_url: str | None = None
    is_public: bool = True
    metrics: ProfileMetrics
    badges: list[BadgeSummary] = Field(default_factory=list)
    certificates: list[CertificateSummary] = Field(default_factory=list)
    projects: list[ProjectPinResponse] = Field(default_factory=list)
    activity: list[ActivityDay] = Field(default_factory=list)
    viewer_connected: bool = False
    is_self: bool = False
