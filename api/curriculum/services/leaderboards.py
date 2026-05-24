from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.models import User
from curriculum import models, schemas


VALID_LEADERBOARD_RANGES = {"all_time", "daily", "weekly", "monthly"}
VALID_LEADERBOARD_PAGE_SIZES = {25, 50}
VALID_LEADERBOARD_SORTS = {"xp_desc", "xp_asc"}


def normalize_leaderboard_range(value: str | None, fallback: str = "all_time") -> str:
    normalized = str(value or "").strip().lower()
    if normalized in VALID_LEADERBOARD_RANGES:
        return normalized
    return fallback if fallback in VALID_LEADERBOARD_RANGES else "all_time"


def normalize_leaderboard_page_size(value: int | None, fallback: int = 25) -> int:
    try:
        parsed = int(value or fallback)
    except (TypeError, ValueError):
        parsed = fallback
    return parsed if parsed in VALID_LEADERBOARD_PAGE_SIZES else 25


def normalize_leaderboard_sort(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in VALID_LEADERBOARD_SORTS else "xp_desc"


class LeaderboardService:
    @staticmethod
    def _range_start(time_range: str) -> datetime | None:
        now = datetime.utcnow()
        if time_range == "daily":
            return now - timedelta(days=1)
        if time_range == "weekly":
            return now - timedelta(days=7)
        if time_range == "monthly":
            return now - timedelta(days=30)
        return None

    @staticmethod
    async def leaderboard(
        db: AsyncSession,
        *,
        scope: str = "global",
        track_id: int | None = None,
        track_meta: dict[str, Any] | None = None,
        time_range: str = "all_time",
        search: str | None = None,
        sort: str = "xp_desc",
        page: int = 1,
        page_size: int = 25,
        current_user_id: int | None = None,
        enabled: bool = True,
        disabled_reason: str | None = None,
    ) -> schemas.LeaderboardResponse:
        safe_scope = "track" if scope == "track" else "global"
        safe_page = max(1, int(page or 1))
        safe_page_size = normalize_leaderboard_page_size(page_size)
        safe_range = normalize_leaderboard_range(time_range)
        safe_sort = normalize_leaderboard_sort(sort)
        safe_search = str(search or "").strip()

        if not enabled:
            return schemas.LeaderboardResponse(
                entries=[],
                current_user_rank=None,
                page=safe_page,
                page_size=safe_page_size,
                total=0,
                xp_total=0,
                time_range=safe_range,
                sort=safe_sort,
                has_more=False,
                scope=safe_scope,
                enabled=False,
                disabled_reason=disabled_reason or "Leaderboard is disabled.",
                track=track_meta,
            )

        xp_total = func.coalesce(func.sum(models.XpEvent.points), 0).label("xp_total")
        base_statement = (
            select(
                User.id.label("user_id"),
                User.first_name,
                User.last_name,
                User.username,
                User.avatar,
                xp_total,
            )
            .join(models.XpEvent, models.XpEvent.user_id == User.id)
            .where(User.is_active == True)
            .group_by(User.id, User.first_name, User.last_name, User.username, User.avatar)
        )

        if track_id is not None:
            base_statement = base_statement.where(models.XpEvent.track_id == track_id)

        if safe_search:
            search_like = f"%{safe_search[:80]}%"
            base_statement = base_statement.where(
                (User.username.ilike(search_like))
                | (User.first_name.ilike(search_like))
                | (User.last_name.ilike(search_like))
            )

        range_start = LeaderboardService._range_start(safe_range)
        if range_start is not None:
            base_statement = base_statement.where(models.XpEvent.created_at >= range_start)

        base = base_statement.subquery()
        rank_order = (
            (base.c.xp_total.asc(), base.c.username.asc(), base.c.user_id.asc())
            if safe_sort == "xp_asc"
            else (base.c.xp_total.desc(), base.c.username.asc(), base.c.user_id.asc())
        )
        ranked = (
            select(
                base,
                func.row_number()
                .over(order_by=rank_order)
                .label("rank"),
            )
            .subquery()
        )

        total = int((await db.scalar(select(func.count()).select_from(ranked))) or 0)
        xp_total_sum = int((await db.scalar(select(func.coalesce(func.sum(ranked.c.xp_total), 0)))) or 0)
        start = (safe_page - 1) * safe_page_size
        page_rows = (
            await db.execute(
                select(ranked)
                .order_by(ranked.c.rank.asc())
                .offset(start)
                .limit(safe_page_size)
            )
        ).all()

        current_user_row = None
        if current_user_id:
            current_user_row = (
                await db.execute(select(ranked).where(ranked.c.user_id == int(current_user_id)))
            ).first()

        rows_for_metrics = list(page_rows)
        if current_user_row and not any(int(row.user_id) == int(current_user_id) for row in rows_for_metrics):
            rows_for_metrics.append(current_user_row)

        user_ids = [int(row.user_id) for row in rows_for_metrics]
        completed_by_user = await LeaderboardService._completed_exercises_for_users(db, user_ids=user_ids, track_id=track_id)
        badges_by_user = await LeaderboardService._badges_count_for_users(db, user_ids=user_ids, track_id=track_id)
        streaks_by_user = await LeaderboardService._current_streaks_for_users(db, user_ids=user_ids)

        def make_entry(row: Any) -> schemas.LeaderboardEntry:
            user_id = int(row.user_id)
            return schemas.LeaderboardEntry(
                rank=int(row.rank),
                user_id=user_id,
                display_name=LeaderboardService._display_name(row.first_name, row.last_name, row.username),
                username=row.username,
                avatar_url=row.avatar,
                total_xp=int(row.xp_total or 0),
                track_xp=int(row.xp_total or 0) if track_id is not None else None,
                completed_exercises=completed_by_user.get(user_id, 0),
                badges_count=badges_by_user.get(user_id, 0),
                current_streak=streaks_by_user.get(user_id, 0),
            )

        return schemas.LeaderboardResponse(
            entries=[make_entry(row) for row in page_rows],
            current_user_rank=make_entry(current_user_row) if current_user_row else None,
            page=safe_page,
            page_size=safe_page_size,
            total=total,
            xp_total=xp_total_sum,
            time_range=safe_range,
            sort=safe_sort,
            has_more=start + safe_page_size < total,
            scope=safe_scope,
            enabled=True,
            track=track_meta,
        )

    @staticmethod
    def _display_name(first_name: str | None, last_name: str | None, username: str) -> str:
        name = " ".join(part for part in [first_name, last_name] if part).strip()
        return name or username

    @staticmethod
    async def _completed_exercises_for_users(
        db: AsyncSession,
        *,
        user_ids: list[int],
        track_id: int | None,
    ) -> dict[int, int]:
        if not user_ids:
            return {}
        statement = (
            select(models.UserExerciseProgress.user_id, func.count())
            .select_from(models.UserExerciseProgress)
            .where(models.UserExerciseProgress.user_id.in_(user_ids))
            .where(models.UserExerciseProgress.status == "completed")
            .group_by(models.UserExerciseProgress.user_id)
        )
        if track_id is not None:
            statement = statement.where(models.UserExerciseProgress.track_id == track_id)
        return {int(user_id): int(count or 0) for user_id, count in (await db.execute(statement)).all()}

    @staticmethod
    async def _badges_count_for_users(
        db: AsyncSession,
        *,
        user_ids: list[int],
        track_id: int | None,
    ) -> dict[int, int]:
        if not user_ids:
            return {}
        statement = (
            select(models.UserBadge.user_id, func.count())
            .select_from(models.UserBadge)
            .where(models.UserBadge.user_id.in_(user_ids))
            .group_by(models.UserBadge.user_id)
        )
        if track_id is not None:
            statement = statement.where(
                (models.UserBadge.track_id == track_id) | (models.UserBadge.track_id.is_(None))
            )
        return {int(user_id): int(count or 0) for user_id, count in (await db.execute(statement)).all()}

    @staticmethod
    async def _current_streaks_for_users(db: AsyncSession, *, user_ids: list[int]) -> dict[int, int]:
        if not user_ids:
            return {}

        rows = await db.execute(
            select(models.XpEvent.user_id, models.XpEvent.created_at)
            .where(models.XpEvent.user_id.in_(user_ids))
            .order_by(models.XpEvent.user_id.asc(), models.XpEvent.created_at.desc())
        )
        dates_by_user: dict[int, list[Any]] = {}
        seen_by_user: dict[int, set[Any]] = {}

        for user_id, created_at in rows.all():
            if not created_at:
                continue
            uid = int(user_id)
            day = created_at.date()
            seen = seen_by_user.setdefault(uid, set())
            if day in seen:
                continue
            seen.add(day)
            dates_by_user.setdefault(uid, []).append(day)

        streaks: dict[int, int] = {}
        for uid, dates in dates_by_user.items():
            if not dates:
                streaks[uid] = 0
                continue

            streak = 1
            previous = dates[0]
            for day in dates[1:]:
                if (previous - day).days == 1:
                    streak += 1
                    previous = day
                else:
                    break
            streaks[uid] = streak

        return streaks
