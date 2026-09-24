from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from curriculum import models


class ProgressService:
    @staticmethod
    async def get_or_create_track_progress(
        db: AsyncSession,
        *,
        user_id: int,
        track_id: int,
    ) -> models.UserTrackProgress:
        progress = await db.scalar(
            select(models.UserTrackProgress)
            .where(models.UserTrackProgress.user_id == user_id)
            .where(models.UserTrackProgress.track_id == track_id)
        )
        if progress:
            return progress

        totals = await ProgressService._track_totals(db, track_id)
        progress = models.UserTrackProgress(
            user_id=user_id,
            track_id=track_id,
            total_sections=totals["sections"],
            total_exercises=totals["exercises"],
            status="not_started",
        )
        db.add(progress)
        await db.flush()
        return progress

    @staticmethod
    async def ensure_track_unlocked(
        db: AsyncSession,
        *,
        user_id: int,
        track_id: int,
    ) -> None:
        track = await db.scalar(
            select(models.Track)
            .options(selectinload(models.Track.sections).selectinload(models.Section.exercises))
            .where(models.Track.id == track_id)
        )
        if not track:
            return

        sections = sorted(track.sections or [], key=lambda section: int(section.order or 0))
        seen_first = False
        for section in sections:
            exercises = sorted(section.exercises or [], key=lambda exercise: int(exercise.order or 0))
            for exercise in exercises:
                if not exercise.is_published:
                    continue
                existing = await ProgressService.get_exercise_progress(
                    db,
                    user_id=user_id,
                    exercise_id=int(exercise.id),
                )
                is_first_published = not seen_first
                seen_first = True
                if existing:
                    continue
                status = "unlocked" if is_first_published else "locked"
                db.add(
                    models.UserExerciseProgress(
                        user_id=user_id,
                        exercise_id=int(exercise.id),
                        track_id=int(track.id),
                        section_id=int(section.id),
                        status=status,
                    )
                )

        await ProgressService.recalculate_track(db, user_id=user_id, track_id=track_id)

    @staticmethod
    async def get_exercise_progress(
        db: AsyncSession,
        *,
        user_id: int,
        exercise_id: int,
    ) -> models.UserExerciseProgress | None:
        return await db.scalar(
            select(models.UserExerciseProgress)
            .where(models.UserExerciseProgress.user_id == user_id)
            .where(models.UserExerciseProgress.exercise_id == exercise_id)
        )

    @staticmethod
    async def mark_exercise_started(
        db: AsyncSession,
        *,
        user_id: int,
        exercise: models.Exercise,
    ) -> models.UserExerciseProgress:
        section = await db.scalar(select(models.Section).where(models.Section.id == exercise.section_id))
        if not section:
            raise ValueError("Exercise section was not found.")

        progress = await ProgressService.get_exercise_progress(
            db,
            user_id=user_id,
            exercise_id=int(exercise.id),
        )
        if not progress:
            progress = models.UserExerciseProgress(
                user_id=user_id,
                exercise_id=int(exercise.id),
                track_id=int(section.track_id),
                section_id=int(section.id),
                status="unlocked",
            )
            db.add(progress)

        if progress.status in {"locked", "unlocked"}:
            progress.status = "in_progress"

        track_progress = await ProgressService.get_or_create_track_progress(
            db,
            user_id=user_id,
            track_id=int(section.track_id),
        )
        track_progress.status = "in_progress"
        track_progress.last_exercise_id = int(exercise.id)
        await db.flush()
        return progress

    @staticmethod
    async def complete_exercise(
        db: AsyncSession,
        *,
        user_id: int,
        exercise: models.Exercise,
        score: int = 100,
    ) -> dict[str, Any]:
        section = await db.scalar(select(models.Section).where(models.Section.id == exercise.section_id))
        if not section:
            raise ValueError("Exercise section was not found.")

        progress = await ProgressService.get_exercise_progress(
            db,
            user_id=user_id,
            exercise_id=int(exercise.id),
        )
        if not progress:
            progress = models.UserExerciseProgress(
                user_id=user_id,
                exercise_id=int(exercise.id),
                track_id=int(section.track_id),
                section_id=int(section.id),
            )
            db.add(progress)

        was_completed = progress.status == "completed"
        progress.status = "completed"
        progress.best_score = max(int(progress.best_score or 0), int(score or 0))
        if not progress.completed_at:
            progress.completed_at = datetime.utcnow()

        await ProgressService.unlock_next_exercise(
            db,
            user_id=user_id,
            track_id=int(section.track_id),
            completed_exercise_id=int(exercise.id),
        )
        snapshot = await ProgressService.recalculate_track(
            db,
            user_id=user_id,
            track_id=int(section.track_id),
        )
        snapshot["already_completed"] = was_completed
        return snapshot

    @staticmethod
    async def increment_attempt_count(
        db: AsyncSession,
        *,
        user_id: int,
        exercise: models.Exercise,
    ) -> None:
        section = await db.scalar(select(models.Section).where(models.Section.id == exercise.section_id))
        if not section:
            return
        progress = await ProgressService.get_exercise_progress(
            db,
            user_id=user_id,
            exercise_id=int(exercise.id),
        )
        if not progress:
            progress = models.UserExerciseProgress(
                user_id=user_id,
                exercise_id=int(exercise.id),
                track_id=int(section.track_id),
                section_id=int(section.id),
                status="in_progress",
            )
            db.add(progress)
        progress.attempts_count = int(progress.attempts_count or 0) + 1

    @staticmethod
    async def unlock_next_exercise(
        db: AsyncSession,
        *,
        user_id: int,
        track_id: int,
        completed_exercise_id: int,
    ) -> None:
        track = await db.scalar(
            select(models.Track)
            .options(selectinload(models.Track.sections).selectinload(models.Section.exercises))
            .where(models.Track.id == track_id)
        )
        if not track:
            return

        ordered: list[tuple[models.Section, models.Exercise]] = []
        for section in sorted(track.sections or [], key=lambda item: int(item.order or 0)):
            for exercise in sorted(section.exercises or [], key=lambda item: int(item.order or 0)):
                if exercise.is_published:
                    ordered.append((section, exercise))

        for index, (_, exercise) in enumerate(ordered):
            if int(exercise.id) != completed_exercise_id:
                continue
            if index + 1 >= len(ordered):
                return
            next_section, next_exercise = ordered[index + 1]
            progress = await ProgressService.get_exercise_progress(
                db,
                user_id=user_id,
                exercise_id=int(next_exercise.id),
            )
            if not progress:
                db.add(
                    models.UserExerciseProgress(
                        user_id=user_id,
                        exercise_id=int(next_exercise.id),
                        track_id=track_id,
                        section_id=int(next_section.id),
                        status="unlocked",
                    )
                )
            elif progress.status == "locked":
                progress.status = "unlocked"
            return

    @staticmethod
    async def recalculate_track(
        db: AsyncSession,
        *,
        user_id: int,
        track_id: int,
    ) -> dict[str, Any]:
        track = await db.scalar(
            select(models.Track)
            .options(selectinload(models.Track.sections).selectinload(models.Section.exercises))
            .where(models.Track.id == track_id)
        )
        if not track:
            return {}

        completed_sections = 0
        total_sections = 0
        completed_exercises = 0
        total_exercises = 0

        for section in sorted(track.sections or [], key=lambda item: int(item.order or 0)):
            exercises = [exercise for exercise in section.exercises or [] if exercise.is_published]
            if not exercises:
                continue
            total_sections += 1
            total_exercises += len(exercises)

            completed_in_section = int(
                (
                    await db.scalar(
                        select(func.count())
                        .select_from(models.UserExerciseProgress)
                        .where(models.UserExerciseProgress.user_id == user_id)
                        .where(models.UserExerciseProgress.section_id == section.id)
                        .where(models.UserExerciseProgress.status == "completed")
                    )
                )
                or 0
            )
            completed_in_section = min(completed_in_section, len(exercises))
            completed_exercises += completed_in_section

            section_progress = await db.scalar(
                select(models.UserSectionProgress)
                .where(models.UserSectionProgress.user_id == user_id)
                .where(models.UserSectionProgress.section_id == section.id)
            )
            if not section_progress:
                section_progress = models.UserSectionProgress(
                    user_id=user_id,
                    section_id=int(section.id),
                    track_id=track_id,
                )
                db.add(section_progress)

            section_progress.completed_exercises = completed_in_section
            section_progress.total_exercises = len(exercises)
            section_progress.status = "completed" if completed_in_section >= len(exercises) else (
                "in_progress" if completed_in_section > 0 else "unlocked"
            )
            if section_progress.status == "completed" and not section_progress.completed_at:
                section_progress.completed_at = datetime.utcnow()
                completed_sections += 1
            elif section_progress.status == "completed":
                completed_sections += 1

        xp_total = int(
            (
                await db.scalar(
                    select(func.coalesce(func.sum(models.XpEvent.points), 0))
                    .where(models.XpEvent.user_id == user_id)
                    .where(models.XpEvent.track_id == track_id)
                )
            )
            or 0
        )

        track_progress = await ProgressService.get_or_create_track_progress(
            db,
            user_id=user_id,
            track_id=track_id,
        )
        track_progress.completed_sections = completed_sections
        track_progress.total_sections = total_sections
        track_progress.completed_exercises = completed_exercises
        track_progress.total_exercises = total_exercises
        track_progress.total_xp = xp_total
        if total_exercises > 0 and completed_exercises >= total_exercises:
            track_progress.status = "completed"
        elif completed_exercises > 0 or track_progress.status == "in_progress":
            track_progress.status = "in_progress"
        else:
            track_progress.status = "not_started"

        await db.flush()
        return {
            "track_id": track_id,
            "completed_sections": completed_sections,
            "total_sections": total_sections,
            "completed_exercises": completed_exercises,
            "total_exercises": total_exercises,
            "total_xp": xp_total,
            "status": track_progress.status,
            "progress_percent": round((completed_exercises / total_exercises) * 100) if total_exercises else 0,
        }

    @staticmethod
    async def _track_totals(db: AsyncSession, track_id: int) -> dict[str, int]:
        section_count = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.Section)
                    .where(models.Section.track_id == track_id)
                )
            )
            or 0
        )
        exercise_count = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.Exercise)
                    .join(models.Section, models.Section.id == models.Exercise.section_id)
                    .where(models.Section.track_id == track_id)
                    .where(models.Exercise.is_published == True)
                )
            )
            or 0
        )
        return {"sections": section_count, "exercises": exercise_count}

    @staticmethod
    async def current_streak(db: AsyncSession, *, user_id: int) -> int:
        rows = await db.scalars(
            select(models.XpEvent.created_at)
            .where(models.XpEvent.user_id == user_id)
            .order_by(models.XpEvent.created_at.desc())
        )
        dates = []
        seen = set()
        for value in rows.all():
            day = value.date()
            if day not in seen:
                dates.append(day)
                seen.add(day)

        if not dates:
            return 0

        streak = 1
        previous = dates[0]
        for day in dates[1:]:
            if (previous - day).days == 1:
                streak += 1
                previous = day
            elif day == previous:
                continue
            else:
                break
        return streak
