from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.models import User
from curriculum import models as curriculum_models
from curriculum.services.progress import ProgressService
from profile import models, schemas


TASK_CREDIT_SOURCES = {"exercise_completion", "quiz_pass"}
DAILY_CHECK_IN_CREDITS = 10
TASK_COMPLETION_CREDITS = 5
SEVEN_DAY_STREAK_CREDITS = 25


def is_campus_avatar_url(value: str | None) -> bool:
    avatar = str(value or "").strip()
    return "assets/avatars/" in avatar or "/avatars/" in avatar


def _clean_text(value: str | None, *, max_length: int | None = None) -> str | None:
    cleaned = str(value or "").strip()
    if not cleaned:
        return None
    return cleaned[:max_length] if max_length else cleaned


def _display_name(user: User, profile: models.UserProfile | None = None) -> str:
    if profile and profile.display_name:
        return profile.display_name
    name = " ".join(part for part in [user.first_name, user.last_name] if part).strip()
    return name or user.username


def active_avatar_url(user: User, profile: models.UserProfile | None = None) -> str | None:
    if profile and profile.avatar_source == "provider" and profile.provider_avatar_url:
        return profile.provider_avatar_url
    if profile and profile.selected_avatar_url:
        return profile.selected_avatar_url
    return user.avatar or None


def _profile_payload(user: User, profile: models.UserProfile) -> schemas.UserProfilePayload:
    return schemas.UserProfilePayload(
        display_name=_display_name(user, profile),
        headline=profile.headline,
        bio=profile.bio,
        location_text=profile.location_text,
        website_url=profile.website_url,
        github_url=profile.github_url,
        linkedin_url=profile.linkedin_url,
        portfolio_url=profile.portfolio_url,
        avatar_source=profile.avatar_source or "selected",
        selected_avatar_url=profile.selected_avatar_url,
        provider_avatar_url=profile.provider_avatar_url,
        active_avatar_url=active_avatar_url(user, profile),
        is_public=bool(profile.is_public),
        show_badges=bool(profile.show_badges),
        show_certificates=bool(profile.show_certificates),
        show_activity=bool(profile.show_activity),
        show_projects=bool(profile.show_projects),
        show_rank=bool(profile.show_rank),
        show_connections=bool(profile.show_connections),
    )


def _account_summary(user: User) -> schemas.AccountSummary:
    return schemas.AccountSummary(
        id=int(user.id),
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        auth_provider=user.auth_provider,
        role=user.role,
        avatar=user.avatar,
        created_at=user.created_at,
        last_login=user.last_login,
    )


def _project_payload(project: models.UserProjectPin) -> schemas.ProjectPinResponse:
    tags = project.tags if isinstance(project.tags, list) else []
    return schemas.ProjectPinResponse(
        id=int(project.id),
        title=project.title,
        description=project.description,
        project_url=project.project_url,
        image_url=project.image_url,
        tags=[str(tag)[:32] for tag in tags[:8]],
        is_public=bool(project.is_public),
        order=int(project.order or 0),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _ledger_payload(row: models.UserCreditLedger) -> schemas.CreditLedgerItem:
    return schemas.CreditLedgerItem(
        id=int(row.id),
        amount=int(row.amount or 0),
        source_type=row.source_type,
        source_id=row.source_id,
        reason=row.reason,
        created_at=row.created_at,
    )


class ProfileService:
    @staticmethod
    async def ensure_profile(
        db: AsyncSession,
        user: User,
        *,
        provider_avatar_url: str | None = None,
    ) -> models.UserProfile:
        profile = await db.scalar(select(models.UserProfile).where(models.UserProfile.user_id == user.id))
        clean_provider_avatar = _clean_text(provider_avatar_url, max_length=512)

        if profile:
            if clean_provider_avatar and clean_provider_avatar != profile.provider_avatar_url:
                profile.provider_avatar_url = clean_provider_avatar
            if not profile.selected_avatar_url and user.avatar:
                profile.selected_avatar_url = user.avatar
            await db.flush()
            return profile

        current_avatar = _clean_text(user.avatar, max_length=512)
        inferred_provider_avatar = clean_provider_avatar or (current_avatar if current_avatar and not is_campus_avatar_url(current_avatar) else None)
        profile = models.UserProfile(
            user_id=int(user.id),
            display_name=_display_name(user),
            avatar_source="provider" if current_avatar and inferred_provider_avatar == current_avatar else "selected",
            selected_avatar_url=current_avatar,
            provider_avatar_url=inferred_provider_avatar,
        )
        db.add(profile)
        await db.flush()
        return profile

    @staticmethod
    async def update_profile(
        db: AsyncSession,
        user: User,
        payload: schemas.UserProfileUpdate,
    ) -> schemas.PrivateProfileResponse:
        profile = await ProfileService.ensure_profile(db, user)
        data = payload.model_dump(exclude_unset=True)

        text_fields = {
            "display_name": 160,
            "headline": 180,
            "bio": 1200,
            "location_text": 128,
            "website_url": 512,
            "github_url": 512,
            "linkedin_url": 512,
            "portfolio_url": 512,
            "selected_avatar_url": 512,
        }
        for field, max_length in text_fields.items():
            if field in data:
                setattr(profile, field, _clean_text(data[field], max_length=max_length))

        for field in [
            "is_public",
            "show_badges",
            "show_certificates",
            "show_activity",
            "show_projects",
            "show_rank",
            "show_connections",
        ]:
            if field in data:
                setattr(profile, field, bool(data[field]))

        if "avatar_source" in data:
            profile.avatar_source = data["avatar_source"] or "selected"

        next_avatar = active_avatar_url(user, profile)
        if next_avatar != (user.avatar or None):
            user.avatar = next_avatar

        await db.flush()
        return await ProfileService.private_profile(db, user)

    @staticmethod
    async def private_profile(db: AsyncSession, user: User) -> schemas.PrivateProfileResponse:
        profile = await ProfileService.ensure_profile(db, user)
        metrics = await ProfileService.metrics(db, int(user.id))
        projects = await ProfileService.projects(db, int(user.id), public_only=False)
        badges = await ProfileService.badges(db, int(user.id))
        certificates = await CertificateService.list_certificates(db, user)
        activity = await ProfileService.activity(db, int(user.id))
        rewards = await CreditService.reward_summary(db, int(user.id))

        return schemas.PrivateProfileResponse(
            account=_account_summary(user),
            profile=_profile_payload(user, profile),
            metrics=metrics,
            rewards=rewards,
            projects=projects,
            badges=badges,
            certificates=certificates,
            activity=activity,
        )

    @staticmethod
    async def public_profile(
        db: AsyncSession,
        username: str,
        *,
        viewer: User | None = None,
    ) -> schemas.PublicProfileResponse:
        user = await db.scalar(select(User).where(func.lower(User.username) == str(username or "").strip().lower()))
        if not user or not user.is_active:
            raise ValueError("Profile not found.")

        profile = await ProfileService.ensure_profile(db, user)
        is_self = bool(viewer and int(viewer.id) == int(user.id))
        if not profile.is_public and not is_self:
            raise PermissionError("This profile is private.")

        metrics = await ProfileService.metrics(db, int(user.id))
        if not profile.show_rank:
            metrics.global_rank = None
        if not profile.show_connections:
            metrics.connections_count = 0
            metrics.connecting_count = 0

        badges = await ProfileService.badges(db, int(user.id)) if profile.show_badges else []
        certificate_list = await CertificateService.list_certificates(db, user)
        certificates = certificate_list.claimed if profile.show_certificates else []
        projects = await ProfileService.projects(db, int(user.id), public_only=True) if profile.show_projects else []
        activity = await ProfileService.activity(db, int(user.id)) if profile.show_activity else []
        viewer_connected = False
        if viewer and not is_self:
            viewer_connected = bool(
                await db.scalar(
                    select(models.UserConnection.id)
                    .where(models.UserConnection.connector_user_id == viewer.id)
                    .where(models.UserConnection.connected_user_id == user.id)
                )
            )

        return schemas.PublicProfileResponse(
            username=user.username,
            display_name=_display_name(user, profile),
            headline=profile.headline,
            bio=profile.bio,
            location_text=profile.location_text,
            website_url=profile.website_url,
            github_url=profile.github_url,
            linkedin_url=profile.linkedin_url,
            portfolio_url=profile.portfolio_url,
            avatar_url=active_avatar_url(user, profile),
            is_public=bool(profile.is_public),
            metrics=metrics,
            badges=badges,
            certificates=certificates,
            projects=projects,
            activity=activity,
            viewer_connected=viewer_connected,
            is_self=is_self,
        )

    @staticmethod
    async def metrics(db: AsyncSession, user_id: int) -> schemas.ProfileMetrics:
        total_xp = int(
            (
                await db.scalar(
                    select(func.coalesce(func.sum(curriculum_models.XpEvent.points), 0))
                    .where(curriculum_models.XpEvent.user_id == user_id)
                )
            )
            or 0
        )
        completed_exercises = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(curriculum_models.UserExerciseProgress)
                    .where(curriculum_models.UserExerciseProgress.user_id == user_id)
                    .where(curriculum_models.UserExerciseProgress.status == "completed")
                )
            )
            or 0
        )
        completed_tracks = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(curriculum_models.UserTrackProgress)
                    .where(curriculum_models.UserTrackProgress.user_id == user_id)
                    .where(curriculum_models.UserTrackProgress.status == "completed")
                )
            )
            or 0
        )
        badges_count = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(curriculum_models.UserBadge)
                    .where(curriculum_models.UserBadge.user_id == user_id)
                )
            )
            or 0
        )
        certificates_count = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.UserCertificate)
                    .where(models.UserCertificate.user_id == user_id)
                )
            )
            or 0
        )
        connections_count = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.UserConnection)
                    .where(models.UserConnection.connected_user_id == user_id)
                )
            )
            or 0
        )
        connecting_count = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.UserConnection)
                    .where(models.UserConnection.connector_user_id == user_id)
                )
            )
            or 0
        )

        return schemas.ProfileMetrics(
            total_xp=total_xp,
            completed_exercises=completed_exercises,
            completed_tracks=completed_tracks,
            current_streak=await ProgressService.current_streak(db, user_id=user_id),
            global_rank=await ProfileService.global_rank(db, user_id),
            badges_count=badges_count,
            certificates_count=certificates_count,
            connections_count=connections_count,
            connecting_count=connecting_count,
        )

    @staticmethod
    async def global_rank(db: AsyncSession, user_id: int) -> int | None:
        xp_total = func.coalesce(func.sum(curriculum_models.XpEvent.points), 0).label("xp_total")
        rows = await db.execute(
            select(curriculum_models.XpEvent.user_id, xp_total)
            .join(User, User.id == curriculum_models.XpEvent.user_id)
            .where(User.is_active == True)
            .group_by(curriculum_models.XpEvent.user_id)
            .order_by(desc("xp_total"), curriculum_models.XpEvent.user_id.asc())
        )
        for rank, row in enumerate(rows.all(), start=1):
            if int(row.user_id) == user_id:
                return rank
        return None

    @staticmethod
    async def activity(db: AsyncSession, user_id: int, *, days: int = 90) -> list[schemas.ActivityDay]:
        safe_days = max(1, min(int(days or 90), 180))
        today = datetime.now(UTC).date()
        start_day = today - timedelta(days=safe_days - 1)
        start_at = datetime(start_day.year, start_day.month, start_day.day)
        rows = await db.execute(
            select(
                func.date(curriculum_models.XpEvent.created_at).label("day"),
                func.coalesce(func.sum(curriculum_models.XpEvent.points), 0).label("xp"),
                func.count().label("events"),
            )
            .where(curriculum_models.XpEvent.user_id == user_id)
            .where(curriculum_models.XpEvent.created_at >= start_at)
            .group_by(func.date(curriculum_models.XpEvent.created_at))
        )
        by_day = {str(row.day): {"xp": int(row.xp or 0), "events": int(row.events or 0)} for row in rows.all()}
        return [
            schemas.ActivityDay(
                date=(start_day + timedelta(days=offset)).isoformat(),
                xp=by_day.get((start_day + timedelta(days=offset)).isoformat(), {}).get("xp", 0),
                events=by_day.get((start_day + timedelta(days=offset)).isoformat(), {}).get("events", 0),
            )
            for offset in range(safe_days)
        ]

    @staticmethod
    async def badges(db: AsyncSession, user_id: int) -> list[schemas.BadgeSummary]:
        rows = await db.scalars(
            select(curriculum_models.UserBadge)
            .options(selectinload(curriculum_models.UserBadge.badge))
            .where(curriculum_models.UserBadge.user_id == user_id)
            .order_by(curriculum_models.UserBadge.awarded_at.desc())
            .limit(24)
        )
        badges: list[schemas.BadgeSummary] = []
        for user_badge in rows.all():
            badge = user_badge.badge
            badges.append(
                schemas.BadgeSummary(
                    id=int(user_badge.id),
                    badge_id=int(user_badge.badge_id),
                    title=badge.title if badge else "Campus404 Badge",
                    description=badge.description if badge else None,
                    icon_url=badge.icon_url if badge else None,
                    awarded_at=user_badge.awarded_at,
                )
            )
        return badges

    @staticmethod
    async def projects(db: AsyncSession, user_id: int, *, public_only: bool) -> list[schemas.ProjectPinResponse]:
        statement = (
            select(models.UserProjectPin)
            .where(models.UserProjectPin.user_id == user_id)
            .order_by(models.UserProjectPin.order.asc(), models.UserProjectPin.created_at.desc())
        )
        if public_only:
            statement = statement.where(models.UserProjectPin.is_public == True)
        rows = await db.scalars(statement.limit(12))
        return [_project_payload(row) for row in rows.all()]


class ConnectionService:
    @staticmethod
    async def connect(db: AsyncSession, viewer: User, username: str) -> None:
        target = await db.scalar(select(User).where(func.lower(User.username) == str(username or "").strip().lower()))
        if not target or not target.is_active:
            raise ValueError("Profile not found.")
        if int(target.id) == int(viewer.id):
            raise PermissionError("You cannot connect with yourself.")

        target_profile = await ProfileService.ensure_profile(db, target)
        if not target_profile.is_public:
            raise PermissionError("This profile is private.")

        existing = await db.scalar(
            select(models.UserConnection)
            .where(models.UserConnection.connector_user_id == viewer.id)
            .where(models.UserConnection.connected_user_id == target.id)
        )
        if existing:
            return

        db.add(
            models.UserConnection(
                connector_user_id=int(viewer.id),
                connected_user_id=int(target.id),
            )
        )
        await db.flush()

    @staticmethod
    async def disconnect(db: AsyncSession, viewer: User, username: str) -> None:
        target = await db.scalar(select(User).where(func.lower(User.username) == str(username or "").strip().lower()))
        if not target:
            raise ValueError("Profile not found.")
        connection = await db.scalar(
            select(models.UserConnection)
            .where(models.UserConnection.connector_user_id == viewer.id)
            .where(models.UserConnection.connected_user_id == target.id)
        )
        if connection:
            await db.delete(connection)
            await db.flush()


class ProjectService:
    @staticmethod
    def _sanitize_tags(tags: list[str] | None) -> list[str]:
        clean_tags: list[str] = []
        for tag in tags or []:
            clean = _clean_text(str(tag), max_length=32)
            if clean and clean.lower() not in {item.lower() for item in clean_tags}:
                clean_tags.append(clean)
            if len(clean_tags) >= 8:
                break
        return clean_tags

    @staticmethod
    async def create(db: AsyncSession, user: User, payload: schemas.ProjectPinCreate) -> schemas.ProjectPinResponse:
        count = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.UserProjectPin)
                    .where(models.UserProjectPin.user_id == user.id)
                )
            )
            or 0
        )
        if count >= 6:
            raise OverflowError("You can pin up to 6 Build Drops.")

        project = models.UserProjectPin(
            user_id=int(user.id),
            title=_clean_text(payload.title, max_length=160) or "Untitled Project",
            description=_clean_text(payload.description, max_length=800),
            project_url=str(payload.project_url).strip(),
            image_url=_clean_text(str(payload.image_url) if payload.image_url else None, max_length=512),
            tags=ProjectService._sanitize_tags(payload.tags),
            is_public=bool(payload.is_public),
            order=int(payload.order or count),
        )
        db.add(project)
        await db.flush()
        await db.refresh(project)
        return _project_payload(project)

    @staticmethod
    async def update(
        db: AsyncSession,
        user: User,
        project_id: int,
        payload: schemas.ProjectPinUpdate,
    ) -> schemas.ProjectPinResponse:
        project = await db.scalar(
            select(models.UserProjectPin)
            .where(models.UserProjectPin.id == project_id)
            .where(models.UserProjectPin.user_id == user.id)
        )
        if not project:
            raise ValueError("Project not found.")

        data = payload.model_dump(exclude_unset=True)
        if "title" in data:
            project.title = _clean_text(data["title"], max_length=160) or project.title
        if "description" in data:
            project.description = _clean_text(data["description"], max_length=800)
        if "project_url" in data and data["project_url"] is not None:
            project.project_url = str(data["project_url"]).strip()
        if "image_url" in data:
            project.image_url = _clean_text(str(data["image_url"]) if data["image_url"] else None, max_length=512)
        if "tags" in data:
            project.tags = ProjectService._sanitize_tags(data["tags"])
        if "is_public" in data:
            project.is_public = bool(data["is_public"])
        if "order" in data and data["order"] is not None:
            project.order = int(data["order"])

        await db.flush()
        await db.refresh(project)
        return _project_payload(project)

    @staticmethod
    async def delete(db: AsyncSession, user: User, project_id: int) -> None:
        project = await db.scalar(
            select(models.UserProjectPin)
            .where(models.UserProjectPin.id == project_id)
            .where(models.UserProjectPin.user_id == user.id)
        )
        if not project:
            raise ValueError("Project not found.")
        await db.delete(project)
        await db.flush()


class CreditService:
    @staticmethod
    async def balance(db: AsyncSession, user_id: int) -> int:
        return int(
            (
                await db.scalar(
                    select(func.coalesce(func.sum(models.UserCreditLedger.amount), 0))
                    .where(models.UserCreditLedger.user_id == user_id)
                )
            )
            or 0
        )

    @staticmethod
    async def award(
        db: AsyncSession,
        *,
        user_id: int,
        amount: int,
        source_type: str,
        source_id: str,
        reason: str,
        details: dict[str, Any] | None = None,
    ) -> models.UserCreditLedger | None:
        existing = await db.scalar(
            select(models.UserCreditLedger)
            .where(models.UserCreditLedger.user_id == user_id)
            .where(models.UserCreditLedger.source_type == source_type)
            .where(models.UserCreditLedger.source_id == source_id)
        )
        if existing:
            return None
        ledger = models.UserCreditLedger(
            user_id=user_id,
            amount=int(amount),
            source_type=source_type,
            source_id=str(source_id),
            reason=reason,
            details=details or None,
        )
        db.add(ledger)
        await db.flush()
        return ledger

    @staticmethod
    async def award_task_completion_credits(
        db: AsyncSession,
        *,
        user_id: int,
        xp_event_id: int,
        source_type: str,
        exercise_id: int | None,
    ) -> models.UserCreditLedger | None:
        if source_type not in TASK_CREDIT_SOURCES:
            return None
        return await CreditService.award(
            db,
            user_id=user_id,
            amount=TASK_COMPLETION_CREDITS,
            source_type="task_completion",
            source_id=f"xp:{xp_event_id}",
            reason="Verified learning completion",
            details={"xp_event_id": xp_event_id, "exercise_id": exercise_id, "source_type": source_type},
        )

    @staticmethod
    async def claim_daily_check_in(db: AsyncSession, user_id: int) -> schemas.DailyCheckInResponse:
        today = datetime.now(UTC).date()
        source_id = today.isoformat()
        existing = await db.scalar(
            select(models.UserCreditLedger)
            .where(models.UserCreditLedger.user_id == user_id)
            .where(models.UserCreditLedger.source_type == "daily_check_in")
            .where(models.UserCreditLedger.source_id == source_id)
        )
        if existing:
            return schemas.DailyCheckInResponse(
                claimed=True,
                awarded=0,
                balance=await CreditService.balance(db, user_id),
                daily_check_in_streak=await CreditService.daily_check_in_streak(db, user_id),
                already_claimed=True,
                bonus_awarded=0,
            )

        await CreditService.award(
            db,
            user_id=user_id,
            amount=DAILY_CHECK_IN_CREDITS,
            source_type="daily_check_in",
            source_id=source_id,
            reason="Daily Campus404 visit",
        )
        streak = await CreditService.daily_check_in_streak(db, user_id)
        bonus_awarded = 0
        if streak > 0 and streak % 7 == 0:
            bonus = await CreditService.award(
                db,
                user_id=user_id,
                amount=SEVEN_DAY_STREAK_CREDITS,
                source_type="daily_streak_bonus",
                source_id=f"{streak}:{source_id}",
                reason=f"{streak}-day Campus404 streak",
            )
            if bonus:
                bonus_awarded = SEVEN_DAY_STREAK_CREDITS

        return schemas.DailyCheckInResponse(
            claimed=True,
            awarded=DAILY_CHECK_IN_CREDITS,
            balance=await CreditService.balance(db, user_id),
            daily_check_in_streak=streak,
            already_claimed=False,
            bonus_awarded=bonus_awarded,
        )

    @staticmethod
    async def daily_check_in_streak(db: AsyncSession, user_id: int) -> int:
        rows = await db.scalars(
            select(models.UserCreditLedger.source_id)
            .where(models.UserCreditLedger.user_id == user_id)
            .where(models.UserCreditLedger.source_type == "daily_check_in")
            .order_by(models.UserCreditLedger.source_id.desc())
        )
        dates: list[date] = []
        for raw in rows.all():
            try:
                dates.append(date.fromisoformat(str(raw)))
            except ValueError:
                continue
        if not dates:
            return 0

        today = datetime.now(UTC).date()
        anchor = today if today in dates else today - timedelta(days=1)
        if anchor not in dates:
            return 0

        streak = 0
        expected = anchor
        seen = set(dates)
        while expected in seen:
            streak += 1
            expected -= timedelta(days=1)
        return streak

    @staticmethod
    async def reward_summary(db: AsyncSession, user_id: int) -> schemas.RewardSummary:
        today = datetime.now(UTC).date()
        claimed = bool(
            await db.scalar(
                select(models.UserCreditLedger.id)
                .where(models.UserCreditLedger.user_id == user_id)
                .where(models.UserCreditLedger.source_type == "daily_check_in")
                .where(models.UserCreditLedger.source_id == today.isoformat())
            )
        )
        rows = await db.scalars(
            select(models.UserCreditLedger)
            .where(models.UserCreditLedger.user_id == user_id)
            .order_by(models.UserCreditLedger.created_at.desc())
            .limit(20)
        )
        return schemas.RewardSummary(
            balance=await CreditService.balance(db, user_id),
            daily_check_in_claimed=claimed,
            daily_check_in_streak=await CreditService.daily_check_in_streak(db, user_id),
            next_daily_check_in_date=(today + timedelta(days=1)).isoformat(),
            recent_ledger=[_ledger_payload(row) for row in rows.all()],
        )


class CertificateService:
    @staticmethod
    def _certificate_payload(row: models.UserCertificate, track_title: str) -> schemas.CertificateSummary:
        return schemas.CertificateSummary(
            id=int(row.id),
            track_id=int(row.track_id),
            track_title=track_title,
            certificate_code=row.certificate_code,
            title=row.title,
            issued_at=row.issued_at,
        )

    @staticmethod
    async def list_certificates(db: AsyncSession, user: User) -> schemas.CertificateListResponse:
        rows = await db.execute(
            select(models.UserCertificate, curriculum_models.Track.title)
            .join(curriculum_models.Track, curriculum_models.Track.id == models.UserCertificate.track_id)
            .where(models.UserCertificate.user_id == user.id)
            .order_by(models.UserCertificate.issued_at.desc())
        )
        claimed = [CertificateService._certificate_payload(row[0], row[1]) for row in rows.all()]
        claimed_ids = {item.track_id for item in claimed}

        progress_rows = await db.execute(
            select(curriculum_models.UserTrackProgress, curriculum_models.Track)
            .join(curriculum_models.Track, curriculum_models.Track.id == curriculum_models.UserTrackProgress.track_id)
            .where(curriculum_models.UserTrackProgress.user_id == user.id)
            .where(
                (curriculum_models.UserTrackProgress.status == "completed")
                | (
                    (curriculum_models.UserTrackProgress.total_exercises > 0)
                    & (
                        curriculum_models.UserTrackProgress.completed_exercises
                        >= curriculum_models.UserTrackProgress.total_exercises
                    )
                )
            )
            .order_by(curriculum_models.Track.title.asc())
        )
        eligible_tracks = [
            {
                "track_id": int(progress.track_id),
                "title": track.title,
                "slug": track.slug,
                "claimed": int(progress.track_id) in claimed_ids,
            }
            for progress, track in progress_rows.all()
        ]

        return schemas.CertificateListResponse(claimed=claimed, eligible_tracks=eligible_tracks)

    @staticmethod
    async def claim(db: AsyncSession, user: User, track_id: int) -> schemas.CertificateClaimResponse:
        existing = await db.scalar(
            select(models.UserCertificate)
            .where(models.UserCertificate.user_id == user.id)
            .where(models.UserCertificate.track_id == track_id)
        )
        track = await db.scalar(select(curriculum_models.Track).where(curriculum_models.Track.id == track_id))
        if not track:
            raise ValueError("Track not found.")

        if existing:
            return schemas.CertificateClaimResponse(
                certificate=CertificateService._certificate_payload(existing, track.title),
                already_claimed=True,
            )

        progress = await db.scalar(
            select(curriculum_models.UserTrackProgress)
            .where(curriculum_models.UserTrackProgress.user_id == user.id)
            .where(curriculum_models.UserTrackProgress.track_id == track_id)
        )
        complete = bool(
            progress
            and (
                progress.status == "completed"
                or (
                    int(progress.total_exercises or 0) > 0
                    and int(progress.completed_exercises or 0) >= int(progress.total_exercises or 0)
                )
            )
        )
        if not complete:
            raise PermissionError("Complete the track before claiming this certificate.")

        certificate = models.UserCertificate(
            user_id=int(user.id),
            track_id=int(track_id),
            certificate_code=f"C404-{user.id}-{track_id}-{uuid4().hex[:10].upper()}",
            title=f"{track.title} Certificate",
            metadata_json={"track_slug": track.slug, "username": user.username},
        )
        db.add(certificate)
        await db.flush()
        await db.refresh(certificate)
        return schemas.CertificateClaimResponse(
            certificate=CertificateService._certificate_payload(certificate, track.title),
            already_claimed=False,
        )
