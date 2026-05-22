from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ClientErrorReportRequest(BaseModel):
    error_kind: str = Field(default="browser_error", min_length=2, max_length=64)
    severity: str = Field(default="error", min_length=2, max_length=32)
    message: str = Field(..., min_length=1, max_length=8192)
    stack_trace: str | None = Field(default=None, max_length=40000)
    component_stack: str | None = Field(default=None, max_length=40000)
    route_path: str | None = Field(default=None, max_length=512)
    route_template: str | None = Field(default=None, max_length=512)
    operation: str | None = Field(default=None, max_length=512)
    method: str | None = Field(default=None, max_length=16)
    status_code: int | None = Field(default=None, ge=0, le=599)
    request_id: str | None = Field(default=None, max_length=96)
    client_occurred_at: datetime | None = None
    details: dict[str, Any] | None = None

    model_config = {"extra": "forbid"}


class InternalErrorEventRequest(ClientErrorReportRequest):
    source_service: str = Field(..., min_length=2, max_length=64)


class ErrorGroupTriageUpdate(BaseModel):
    status: Literal["open", "acknowledged", "resolved"]

    model_config = {"extra": "forbid"}
