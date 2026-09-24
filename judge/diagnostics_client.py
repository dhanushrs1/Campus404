from __future__ import annotations

import os
import traceback
from datetime import datetime, timezone
from typing import Any

import httpx

DIAGNOSTICS_API_URL = os.getenv("DIAGNOSTICS_API_URL", "").strip()
DIAGNOSTICS_SERVICE_TOKEN = os.getenv("DIAGNOSTICS_SERVICE_TOKEN", "").strip()


def report_operational_error(
    *,
    source_service: str,
    error_kind: str,
    message: str,
    operation: str | None = None,
    severity: str = "error",
    details: dict[str, Any] | None = None,
    exc: Exception | None = None,
) -> None:
    if not DIAGNOSTICS_API_URL or not DIAGNOSTICS_SERVICE_TOKEN:
        return

    payload = {
        "source_service": source_service,
        "error_kind": error_kind,
        "severity": severity,
        "message": str(message)[:8192] or "Judge operational error",
        "operation": operation,
        "stack_trace": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)) if exc else None,
        "client_occurred_at": datetime.now(timezone.utc).isoformat(),
        "details": details or {},
    }

    try:
        with httpx.Client(timeout=2.0) as client:
            client.post(
                DIAGNOSTICS_API_URL,
                headers={"X-Diagnostics-Token": DIAGNOSTICS_SERVICE_TOKEN},
                json=payload,
            )
    except Exception:
        # Reporting cannot block the execution plane.
        return
