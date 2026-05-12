from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.models import User
from curriculum import models, schemas
from curriculum.services.progress import ProgressService


class LeaderboardService:
    @staticmethod
    def _range_start(time_range: str) -> datetime | None:
        now = datetime.utcnow()
        if time_range == "weekly":
            return now - timedelta(days=7)
        if time_range == "monthly":
            return now - timedelta(days=30)
        return None

    @staticmethod
    async def leaderboard(
        db: AsyncSession,
        *,
        track_id: int | None = None,
        time_range: str = "all_time",
        page: int = 1,
        page_size: int = 20,
        current_user_id: int | None = None,
    ) -> schemas.LeaderboardResponse:
        safe_page = max(1, int(page or 1))
        safe_page_size = max(1, min(int(page_size or 20), 100))

        xp_total = func.coalesce(func.sum(models.XpEvent.points), 0).label("xp_total")
        statement = (
            select(
                User.id,
                User.first_name,
                User.last_name,
                User.username,
                User.avatar,
                xp_total,
            )
            .join(models.XpEvent, models.XpEvent.user_id == User.id)
            .where(User.is_active == True)
            .group_by(User.id, User.first_name, User.last_name, User.username, User.avatar)
            .order_by(xp_total.desc(), User.username.asc())
        )

        if track_id is not None:
            statement = statement.where(models.XpEvent.track_id == track_id)

        range_start = LeaderboardService._range_start(time_range)
        if range_start is not None:
            statement = statement.where(models.XpEvent.created_at >= range_start)

        rows = (await db.execute(statement)).all()
        total = len(rows)
        start = (safe_page - 1) * safe_page_size
        page_rows = rows[start : start + safe_page_size]

        entries: list[schemas.LeaderboardEntry] = []
        current_user_entry: schemas.LeaderboardEntry | None = None

        for rank, row in enumerate(rows, start=1):
            completed = await LeaderboardService._completed_exercises(
                db,
                user_id=int(row.id),
                track_id=track_id,
            )
            badges_count = await LeaderboardService._badges_count(db, user_id=int(row.id), track_id=track_id)
            streak = await ProgressService.current_streak(db, user_id=int(row.id))
            entry = schemas.LeaderboardEntry(
                rank=rank,
                user_id=int(row.id),
                display_name=LeaderboardService._display_name(row.first_name, row.last_name, row.username),
                username=row.username,
                avatar_url=row.avatar,
                total_xp=int(row.xp_total or 0),
                track_xp=int(row.xp_total or 0) if track_id is not None else None,
                completed_exercises=completed,
                badges_count=badges_count,
                current_streak=streak,
            )
            if current_user_id and int(row.id) == int(current_user_id):
                current_user_entry = entry
            if row in page_rows:
                entries.append(entry)

        return schemas.LeaderboardResponse(
            entries=entries,
            current_user_rank=current_user_entry,
            page=safe_page,
            page_size=safe_page_size,
            total=total,
            time_range=time_range if time_range in {"all_time", "weekly", "monthly"} else "all_time",
        )

    @staticmethod
    def _display_name(first_name: str | None, last_name: str | None, username: str) -> str:
        name = " ".join(part for part in [first_name, last_name] if part).strip()
        return name or username

    @staticmethod
    async def _completed_exercises(
        db: AsyncSession,
        *,
        user_id: int,
        track_id: int | None,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(models.UserExerciseProgress)
            .where(models.UserExerciseProgress.user_id == user_id)
            .where(models.UserExerciseProgress.status == "completed")
        )
        if track_id is not None:
            statement = statement.where(models.UserExerciseProgress.track_id == track_id)
        return int((await db.scalar(statement)) or 0)

    @staticmethod
    async def _badges_count(
        db: AsyncSession,
        *,
        user_id: int,
        track_id: int | None,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(models.UserBadge)
            .where(models.UserBadge.user_id == user_id)
        )
        if track_id is not None:
            statement = statement.where(
                (models.UserBadge.track_id == track_id) | (models.UserBadge.track_id.is_(None))
            )
        return int((await db.scalar(statement)) or 0)
