from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.database import get_db
from auth.models import User, UserSession
from curriculum.router import get_current_user, get_optional_current_user
from profile import models, schemas
from profile.services import CertificateService, ConnectionService, CreditService, ProfileService, ProjectService


router = APIRouter(tags=["profile"])
REFRESH_COOKIE_NAME = os.getenv("AUTH_REFRESH_COOKIE_NAME", "campus404_refresh")


def _profile_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")


@router.get("/api/users/me/profile", response_model=schemas.PrivateProfileResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.PrivateProfileResponse:
    return await ProfileService.private_profile(db, user)


@router.patch("/api/users/me/profile", response_model=schemas.PrivateProfileResponse)
async def update_my_profile(
    payload: schemas.UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.PrivateProfileResponse:
    result = await ProfileService.update_profile(db, user, payload)
    await db.commit()
    return result


@router.get("/api/users/{username}/public-profile", response_model=schemas.PublicProfileResponse)
async def get_public_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_current_user),
) -> schemas.PublicProfileResponse:
    try:
        return await ProfileService.public_profile(db, username, viewer=viewer)
    except ValueError:
        raise _profile_not_found()
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/api/users/{username}/connection", response_model=schemas.PublicProfileResponse)
async def connect_to_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    viewer: User = Depends(get_current_user),
) -> schemas.PublicProfileResponse:
    try:
        await ConnectionService.connect(db, viewer, username)
        await db.commit()
        return await ProfileService.public_profile(db, username, viewer=viewer)
    except ValueError:
        raise _profile_not_found()
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/api/users/{username}/connection", response_model=schemas.PublicProfileResponse)
async def disconnect_from_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    viewer: User = Depends(get_current_user),
) -> schemas.PublicProfileResponse:
    try:
        await ConnectionService.disconnect(db, viewer, username)
        await db.commit()
        return await ProfileService.public_profile(db, username, viewer=viewer)
    except ValueError:
        raise _profile_not_found()


@router.get("/api/users/me/projects", response_model=list[schemas.ProjectPinResponse])
async def list_my_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[schemas.ProjectPinResponse]:
    return await ProfileService.projects(db, int(user.id), public_only=False)


@router.post(
    "/api/users/me/projects",
    response_model=schemas.ProjectPinResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_project(
    payload: schemas.ProjectPinCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ProjectPinResponse:
    try:
        result = await ProjectService.create(db, user, payload)
        await db.commit()
        return result
    except OverflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/api/users/me/projects/{project_id}", response_model=schemas.ProjectPinResponse)
async def update_my_project(
    project_id: int,
    payload: schemas.ProjectPinUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ProjectPinResponse:
    try:
        result = await ProjectService.update(db, user, project_id, payload)
        await db.commit()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/api/users/me/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    try:
        await ProjectService.delete(db, user, project_id)
        await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/api/users/me/rewards", response_model=schemas.RewardSummary)
async def get_my_rewards(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.RewardSummary:
    return await CreditService.reward_summary(db, int(user.id))


@router.post("/api/users/me/rewards/daily-check-in", response_model=schemas.DailyCheckInResponse)
async def claim_daily_check_in(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.DailyCheckInResponse:
    result = await CreditService.claim_daily_check_in(db, int(user.id))
    await db.commit()
    return result


@router.get("/api/users/me/certificates", response_model=schemas.CertificateListResponse)
async def get_my_certificates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.CertificateListResponse:
    return await CertificateService.list_certificates(db, user)


@router.post(
    "/api/users/me/certificates/{track_id}/claim",
    response_model=schemas.CertificateClaimResponse,
)
async def claim_certificate(
    track_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.CertificateClaimResponse:
    try:
        result = await CertificateService.claim(db, user, track_id)
        await db.commit()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/api/users/me/sessions", response_model=list[schemas.SessionSummary])
async def list_my_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[schemas.SessionSummary]:
    rows = await db.scalars(
        select(UserSession)
        .where(UserSession.user_id == user.id)
        .order_by(desc(UserSession.login_time))
        .limit(25)
    )
    return [
        schemas.SessionSummary(
            id=int(row.id),
            login_time=row.login_time,
            logout_time=row.logout_time,
            ip_address=row.ip_address,
            device_info=row.device_info,
        )
        for row in rows.all()
    ]


@router.post("/api/users/me/sessions/revoke-all", response_model=schemas.SessionRevokeResponse)
async def revoke_my_sessions(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.SessionRevokeResponse:
    active_sessions = (
        await db.scalars(
            select(UserSession)
            .where(UserSession.user_id == user.id)
            .where(UserSession.logout_time.is_(None))
        )
    ).all()
    now = datetime.utcnow()
    for session in active_sessions:
        session.logout_time = now
        session.refresh_token_hash = None
        session.refresh_expires_at = None

    user.session_version = int(user.session_version or 1) + 1
    await db.commit()
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/auth",
        secure=request.url.scheme == "https",
        httponly=True,
        samesite="lax",
    )
    return schemas.SessionRevokeResponse(
        revoked_sessions=len(active_sessions),
        session_version=int(user.session_version or 1),
        message="All active sessions were revoked. Please sign in again.",
    )


@router.post(
    "/api/users/me/account-change-requests",
    response_model=schemas.AccountChangeRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_account_change_request(
    payload: schemas.AccountChangeRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.AccountChangeRequestResponse:
    requested_email = (payload.requested_email or "").strip() or None
    requested_provider = (payload.requested_provider or "").strip().lower() or None

    if payload.request_type == "email_change" and not requested_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New email is required.")
    if payload.request_type == "provider_change" and not requested_provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New provider is required.")

    request_row = models.AccountChangeRequest(
        user_id=int(user.id),
        request_type=payload.request_type,
        requested_email=requested_email,
        requested_provider=requested_provider,
        note=(payload.note or "").strip() or None,
        status="pending",
    )
    db.add(request_row)
    await db.commit()
    await db.refresh(request_row)

    return schemas.AccountChangeRequestResponse(
        id=int(request_row.id),
        request_type=request_row.request_type,
        requested_email=request_row.requested_email,
        requested_provider=request_row.requested_provider,
        note=request_row.note,
        status=request_row.status,
        created_at=request_row.created_at,
    )
