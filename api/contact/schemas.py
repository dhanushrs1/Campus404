from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


ContactStatus = Literal["unread", "read", "replied", "archived"]


class ContactMessageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    email: EmailStr = Field(..., max_length=256)
    subject: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=10, max_length=4000)
    consent_accepted: bool

    model_config = {"extra": "forbid"}


class ContactMessageUpdate(BaseModel):
    status: ContactStatus | None = None
    admin_note: str | None = Field(default=None, max_length=1000)

    model_config = {"extra": "forbid"}


class ContactMessageResponse(BaseModel):
    id: int
    name: str
    email: str
    subject: str
    message: str
    status: ContactStatus
    consent_accepted: bool = True
    ip_address: str | None = None
    user_agent: str | None = None
    admin_note: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactMessageListResponse(BaseModel):
    items: list[ContactMessageResponse]
    total: int
    unread_total: int = 0
