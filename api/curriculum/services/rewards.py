from __future__ import annotations

from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from curriculum import models
from curriculum.services.progress import ProgressService


REPEATABLE_XP_SOURCES = {"daily_streak", "practice_bonus"}


class RewardService:
    @staticmethod
    async def award_xp(
        db: AsyncSession,
        user_id: int,
        track_id: int | None,
        section_id: int | None,
        exercise_id: int | None,
        source_type: str,
        source_id: str | int,
        points: int,
        reason: str,
    ) -> tuple[models.XpEvent | None, list[models.Badge]]:
        safe_source_id = str(source_id)
        repeatable = source_type in REPEATABLE_XP_SOURCES

        if not repeatable:
            existing = await db.scalar(
                select(models.XpEvent)
                .where(models.XpEvent.user_id == user_id)
                .where(models.XpEvent.source_type == source_type)
                .where(models.XpEvent.source_id == safe_source_id)
            )
            if existing:
                badges = await RewardService.check_and_award_badges(
                    db,
                    user_id=user_id,
                    track_id=track_id,
                    section_id=section_id,
                    exercise_id=exercise_id,
                    event_context={"source_type": source_type, "duplicate": True},
                )
                return None, badges

        event = models.XpEvent(
            user_id=user_id,
            track_id=track_id,
            section_id=section_id,
            exercise_id=exercise_id,
            source_type=source_type,
            source_id=safe_source_id,
            points=max(0, int(points or 0)),
            reason=reason,
        )
        db.add(event)
        await db.flush()

        if track_id:
            track_progress = await ProgressService.get_or_create_track_progress(
                db,
                user_id=user_id,
                track_id=int(track_id),
            )
            track_progress.total_xp = int(track_progress.total_xp or 0) + int(event.points or 0)

        badges = await RewardService.check_and_award_badges(
            db,
            user_id=user_id,
            track_id=track_id,
            section_id=section_id,
            exercise_id=exercise_id,
            event_context={"source_type": source_type, "xp_event_id": event.id},
        )
        return event, badges

    @staticmethod
    async def check_and_award_badges(
        db: AsyncSession,
        *,
        user_id: int,
        track_id: int | None = None,
        section_id: int | None = None,
        exercise_id: int | None = None,
        event_context: dict[str, Any] | None = None,
    ) -> list[models.Badge]:
        badges = (
            await db.scalars(select(models.Badge).where(models.Badge.is_active == True))
        ).all()
        awarded: list[models.Badge] = []

        for badge in badges:
            if not await RewardService._rule_matches(
                db,
                badge=badge,
                user_id=user_id,
                track_id=track_id,
                section_id=section_id,
                exercise_id=exercise_id,
                event_context=event_context or {},
            ):
                continue
            user_badge = await RewardService._award_badge_if_missing(
                db,
                user_id=user_id,
                badge=badge,
                track_id=track_id if badge.scope == "track" else None,
                section_id=section_id if badge.scope == "section" else None,
            )
            if user_badge:
                awarded.append(badge)
                if int(badge.xp_bonus or 0) > 0:
                    bonus_source = f"badge:{badge.id}:{user_badge.track_id or 0}:{user_badge.section_id or 0}"
                    existing_bonus = await db.scalar(
                        select(models.XpEvent)
                        .where(models.XpEvent.user_id == user_id)
                        .where(models.XpEvent.source_type == "badge_bonus")
                        .where(models.XpEvent.source_id == bonus_source)
                    )
                    if not existing_bonus:
                        db.add(
                            models.XpEvent(
                                user_id=user_id,
                                track_id=user_badge.track_id,
                                section_id=user_badge.section_id,
                                exercise_id=exercise_id,
                                source_type="badge_bonus",
                                source_id=bonus_source,
                                points=int(badge.xp_bonus or 0),
                                reason=f"Badge bonus: {badge.title}",
                            )
                        )
        await db.flush()
        return awarded

    @staticmethod
    async def _award_badge_if_missing(
        db: AsyncSession,
        *,
        user_id: int,
        badge: models.Badge,
        track_id: int | None,
        section_id: int | None,
    ) -> models.UserBadge | None:
        existing = await db.scalar(
            select(models.UserBadge)
            .where(models.UserBadge.user_id == user_id)
            .where(models.UserBadge.badge_id == badge.id)
            .where(models.UserBadge.track_id.is_(None) if track_id is None else models.UserBadge.track_id == track_id)
            .where(
                models.UserBadge.section_id.is_(None)
                if section_id is None
                else models.UserBadge.section_id == section_id
            )
        )
        if existing:
            return None

        user_badge = models.UserBadge(
            user_id=user_id,
            badge_id=int(badge.id),
            track_id=track_id,
            section_id=section_id,
        )
        db.add(user_badge)
        await db.flush()
        return user_badge

    @staticmethod
    async def _rule_matches(
        db: AsyncSession,
        *,
        badge: models.Badge,
        user_id: int,
        track_id: int | None,
        section_id: int | None,
        exercise_id: int | None,
        event_context: dict[str, Any],
    ) -> bool:
        rule_type = badge.rule_type
        config = badge.rule_config or {}

        if rule_type == "first_exercise_completed":
            return await RewardService._completed_exercises_count(db, user_id=user_id) >= 1

        if rule_type == "complete_section" and section_id:
            section_progress = await db.scalar(
                select(models.UserSectionProgress)
                .where(models.UserSectionProgress.user_id == user_id)
                .where(models.UserSectionProgress.section_id == section_id)
            )
            return bool(section_progress and section_progress.status == "completed")

        if rule_type == "complete_track" and track_id:
            track_progress = await db.scalar(
                select(models.UserTrackProgress)
                .where(models.UserTrackProgress.user_id == user_id)
                .where(models.UserTrackProgress.track_id == track_id)
            )
            return bool(track_progress and track_progress.status == "completed")

        if rule_type == "complete_quiz_perfect_score" and exercise_id:
            attempt = await db.scalar(
                select(models.QuizAttempt)
                .where(models.QuizAttempt.user_id == user_id)
                .where(models.QuizAttempt.exercise_id == exercise_id)
                .where(models.QuizAttempt.passed == True)
                .order_by(models.QuizAttempt.completed_at.desc())
            )
            return bool(attempt and attempt.total_questions > 0 and attempt.score >= attempt.total_questions)

        if rule_type == "complete_without_hint" and exercise_id:
            completed = await db.scalar(
                select(models.UserExerciseProgress)
                .where(models.UserExerciseProgress.user_id == user_id)
                .where(models.UserExerciseProgress.exercise_id == exercise_id)
                .where(models.UserExerciseProgress.status == "completed")
            )
            hints_used = int(
                (
                    await db.scalar(
                        select(func.count())
                        .select_from(models.HintUsage)
                        .where(models.HintUsage.user_id == user_id)
                        .where(models.HintUsage.exercise_id == exercise_id)
                    )
                )
                or 0
            )
            return bool(completed and hints_used == 0)

        if rule_type == "seven_day_streak":
            return await ProgressService.current_streak(db, user_id=user_id) >= 7

        if rule_type == "solve_n_exercises":
            target = int(config.get("count") or 1)
            return await RewardService._completed_exercises_count(db, user_id=user_id, track_id=track_id) >= target

        if rule_type == "top_track_rank" and track_id:
            target_rank = int(config.get("rank") or 3)
            rank = await RewardService._track_rank(db, user_id=user_id, track_id=track_id)
            return rank is not None and rank <= target_rank

        return False

    @staticmethod
    async def _completed_exercises_count(
        db: AsyncSession,
        *,
        user_id: int,
        track_id: int | None = None,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(models.UserExerciseProgress)
            .where(models.UserExerciseProgress.user_id == user_id)
            .where(models.UserExerciseProgress.status == "completed")
        )
        if track_id:
            statement = statement.where(models.UserExerciseProgress.track_id == track_id)
        return int((await db.scalar(statement)) or 0)

    @staticmethod
    async def _track_rank(db: AsyncSession, *, user_id: int, track_id: int) -> int | None:
        xp_total = func.coalesce(func.sum(models.XpEvent.points), 0).label("xp")
        rows = await db.execute(
            select(models.XpEvent.user_id, xp_total)
            .where(models.XpEvent.track_id == track_id)
            .group_by(models.XpEvent.user_id)
            .order_by(desc("xp"), models.XpEvent.user_id.asc())
        )
        for index, row in enumerate(rows.all(), start=1):
            if int(row.user_id) == user_id:
                return index
        return None
