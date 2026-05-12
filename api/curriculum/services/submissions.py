from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from curriculum import models, schemas
from curriculum.services.progress import ProgressService
from curriculum.services.rewards import RewardService

JUDGE_URL = os.getenv("JUDGE_URL", "http://campus404-judge:2358")


class SubmissionService:
    @staticmethod
    async def get_exercise_context(
        db: AsyncSession,
        exercise_id: int,
    ) -> tuple[models.Exercise, models.Section, models.Track]:
        exercise = await db.scalar(
            select(models.Exercise)
            .options(
                selectinload(models.Exercise.files),
                selectinload(models.Exercise.test_cases),
                selectinload(models.Exercise.tasks),
                selectinload(models.Exercise.hints),
                selectinload(models.Exercise.quiz_questions).selectinload(models.QuizQuestion.options),
            )
            .where(models.Exercise.id == exercise_id)
        )
        if not exercise:
            raise ValueError("Exercise not found.")

        section = await db.scalar(select(models.Section).where(models.Section.id == exercise.section_id))
        if not section:
            raise ValueError("Section not found.")
        track = await db.scalar(select(models.Track).where(models.Track.id == section.track_id))
        if not track:
            raise ValueError("Track not found.")
        return exercise, section, track

    @staticmethod
    async def run_exercise(
        db: AsyncSession,
        *,
        user_id: int,
        exercise_id: int,
        payload: schemas.ExerciseRunRequest,
    ) -> schemas.ExerciseRunResponse:
        exercise, section, track = await SubmissionService.get_exercise_context(db, exercise_id)
        await ProgressService.mark_exercise_started(db, user_id=user_id, exercise=exercise)
        await ProgressService.increment_attempt_count(db, user_id=user_id, exercise=exercise)

        files = SubmissionService._submitted_files(exercise, payload, int(track.language_id))
        mode = SubmissionService._normalize_mode(exercise.mode)
        test_cases = SubmissionService._test_cases(exercise)

        if mode == "frontend_preview":
            test_cases = [
                {
                    "label": "Preview validation",
                    "stdin": "",
                    "expected_outputs": [],
                    "match_mode": "normalize",
                    "is_hidden": False,
                    "validation_config": exercise.validation_config or {},
                    "validation_kind": "frontend_preview",
                }
            ]

        passed_count = 0
        visible_results: list[dict[str, Any]] = []
        first_error: str | None = None
        first_verdict: str | None = None
        last_output: str | None = None
        judge_results: list[dict[str, Any]] = []

        for index, test_case in enumerate(test_cases):
            result = await SubmissionService._judge_submission(
                files=files,
                language_id=payload.language_id or SubmissionService._language_id_for_files(files, int(track.language_id)),
                test_case=test_case,
                mode=mode,
            )
            judge_results.append(result)

            verdict = result.get("verdict") or "Internal Error"
            output = result.get("output")
            error = result.get("error")
            last_output = output if output is not None else last_output

            case_passed = verdict == "Accepted" and not error
            if case_passed:
                passed_count += 1
            elif first_verdict is None:
                first_verdict = verdict
                first_error = error or result.get("message") or "The submitted output did not match the expected result."

            if not bool(test_case.get("is_hidden", True)):
                visible_results.append(
                    {
                        "label": test_case.get("label") or f"Test {index + 1}",
                        "passed": case_passed,
                        "verdict": verdict,
                        "output": output,
                        "error": error,
                    }
                )

        total_cases = len(test_cases)
        passed = total_cases == 0 or passed_count >= total_cases
        status = "passed" if passed else "failed"
        verdict = "Accepted" if passed else (first_verdict or "Wrong Answer")

        attempt = models.ExerciseAttempt(
            user_id=user_id,
            exercise_id=int(exercise.id),
            track_id=int(track.id),
            section_id=int(section.id),
            status=status,
            mode=mode,
            submitted_files=[file.model_dump() for file in files],
            judge_result={"results": judge_results},
            tests_passed=passed_count,
            tests_total=total_cases,
            error_message=first_error,
            used_hint_count=await SubmissionService._hint_usage_count(db, user_id=user_id, exercise_id=int(exercise.id)),
            viewed_solution=await SubmissionService._viewed_reference(db, user_id=user_id, exercise=exercise),
        )
        db.add(attempt)
        await db.flush()

        return schemas.ExerciseRunResponse(
            attempt_id=int(attempt.id),
            status=status,
            mode=mode,
            passed=passed,
            verdict=verdict,
            output=last_output,
            error=first_error,
            passed_cases=passed_count,
            total_cases=total_cases,
            visible_results=visible_results,
            judge_result={"results": judge_results},
        )

    @staticmethod
    async def submit_exercise(
        db: AsyncSession,
        *,
        user_id: int,
        exercise_id: int,
        payload: schemas.ExerciseSubmitRequest | None = None,
    ) -> schemas.ExerciseSubmitResponse:
        exercise, section, track = await SubmissionService.get_exercise_context(db, exercise_id)
        mode = SubmissionService._normalize_mode(exercise.mode)
        attempt: models.ExerciseAttempt | None = None

        if payload and payload.attempt_id:
            attempt = await db.scalar(
                select(models.ExerciseAttempt)
                .where(models.ExerciseAttempt.id == payload.attempt_id)
                .where(models.ExerciseAttempt.user_id == user_id)
                .where(models.ExerciseAttempt.exercise_id == exercise_id)
            )
        elif mode not in {"theory", "quiz"}:
            attempt = await db.scalar(
                select(models.ExerciseAttempt)
                .where(models.ExerciseAttempt.user_id == user_id)
                .where(models.ExerciseAttempt.exercise_id == exercise_id)
                .order_by(models.ExerciseAttempt.created_at.desc())
            )

        if mode in {"code", "multi_file_code", "frontend_preview", "project"}:
            if not attempt or attempt.status != "passed":
                raise ValueError("Submit is locked until the latest run passes.")

        progress_snapshot = await ProgressService.complete_exercise(
            db,
            user_id=user_id,
            exercise=exercise,
            score=100,
        )
        xp_points = await SubmissionService._xp_after_hint_penalties(
            db,
            user_id=user_id,
            exercise=exercise,
        )
        xp_event, badges = await RewardService.award_xp(
            db,
            user_id=user_id,
            track_id=int(track.id),
            section_id=int(section.id),
            exercise_id=int(exercise.id),
            source_type="exercise_completion",
            source_id=int(exercise.id),
            points=xp_points,
            reason=f"Completed exercise: {exercise.title}",
        )

        if not attempt:
            attempt = models.ExerciseAttempt(
                user_id=user_id,
                exercise_id=int(exercise.id),
                track_id=int(track.id),
                section_id=int(section.id),
                status="submitted",
                mode=mode,
                submitted_files=[],
                judge_result={},
                tests_passed=0,
                tests_total=0,
            )
            db.add(attempt)

        attempt.status = "submitted"
        attempt.xp_awarded = int(xp_event.points if xp_event else 0)
        await db.flush()

        return schemas.ExerciseSubmitResponse(
            attempt_id=int(attempt.id),
            status="submitted",
            xp_awarded=int(xp_event.points if xp_event else 0),
            progress=progress_snapshot,
            badges_awarded=[SubmissionService._badge_payload(badge) for badge in badges],
        )

    @staticmethod
    async def complete_theory(
        db: AsyncSession,
        *,
        user_id: int,
        exercise_id: int,
    ) -> schemas.ExerciseSubmitResponse:
        return await SubmissionService.submit_exercise(
            db,
            user_id=user_id,
            exercise_id=exercise_id,
            payload=schemas.ExerciseSubmitRequest(),
        )

    @staticmethod
    async def use_hint(
        db: AsyncSession,
        *,
        user_id: int,
        exercise_id: int,
        hint_id: int,
    ) -> tuple[models.Hint, datetime]:
        hint = await db.scalar(
            select(models.Hint)
            .where(models.Hint.id == hint_id)
            .where(models.Hint.exercise_id == exercise_id)
        )
        if not hint:
            raise ValueError("Hint not found.")

        unlocked = await SubmissionService._hint_is_unlocked(
            db,
            user_id=user_id,
            exercise_id=exercise_id,
            hint=hint,
        )
        if not unlocked:
            raise ValueError("This hint is not unlocked yet.")

        usage = await db.scalar(
            select(models.HintUsage)
            .where(models.HintUsage.user_id == user_id)
            .where(models.HintUsage.hint_id == hint_id)
        )
        if not usage:
            usage = models.HintUsage(
                user_id=user_id,
                hint_id=hint_id,
                exercise_id=exercise_id,
            )
            db.add(usage)
            await db.flush()

        return hint, usage.used_at or datetime.utcnow()

    @staticmethod
    async def record_reference_access(
        db: AsyncSession,
        *,
        user_id: int,
        exercise_id: int,
        reference_url: str | None = None,
    ) -> models.ReferenceAccess:
        exercise, _, _ = await SubmissionService.get_exercise_context(db, exercise_id)
        resolved_url = reference_url or exercise.reference_solution_url or exercise.docs_url
        if not resolved_url:
            raise ValueError("No reference URL is configured for this exercise.")

        access = models.ReferenceAccess(
            user_id=user_id,
            exercise_id=exercise_id,
            reference_url=resolved_url,
            accessed_at=datetime.utcnow(),
        )
        db.add(access)
        await db.flush()
        return access

    @staticmethod
    async def start_quiz(
        db: AsyncSession,
        *,
        user_id: int,
        exercise_id: int,
    ) -> tuple[models.QuizAttempt, list[models.QuizQuestion], models.Exercise]:
        exercise, section, track = await SubmissionService.get_exercise_context(db, exercise_id)
        if SubmissionService._normalize_mode(exercise.mode) != "quiz":
            raise ValueError("This exercise is not a quiz.")

        completed_attempts = int(
            (
                await db.scalar(
                    select(func.count())
                    .select_from(models.QuizAttempt)
                    .where(models.QuizAttempt.user_id == user_id)
                    .where(models.QuizAttempt.exercise_id == exercise_id)
                    .where(models.QuizAttempt.completed_at.is_not(None))
                )
            )
            or 0
        )
        if exercise.attempts_allowed and completed_attempts >= int(exercise.attempts_allowed):
            raise ValueError("No quiz attempts remaining.")

        attempt = models.QuizAttempt(
            user_id=user_id,
            exercise_id=int(exercise.id),
            track_id=int(track.id),
            section_id=int(section.id),
            total_questions=len(exercise.quiz_questions or []),
            answers={},
        )
        db.add(attempt)
        await ProgressService.mark_exercise_started(db, user_id=user_id, exercise=exercise)
        await db.flush()
        return attempt, sorted(exercise.quiz_questions or [], key=lambda item: int(item.order or 0)), exercise

    @staticmethod
    async def answer_quiz(
        db: AsyncSession,
        *,
        user_id: int,
        attempt_id: int,
        question_id: int,
        option_id: int,
    ) -> models.QuizAttempt:
        attempt = await db.scalar(
            select(models.QuizAttempt)
            .where(models.QuizAttempt.id == attempt_id)
            .where(models.QuizAttempt.user_id == user_id)
        )
        if not attempt or attempt.completed_at:
            raise ValueError("Quiz attempt not found or already completed.")
        answers = dict(attempt.answers or {})
        answers[str(question_id)] = int(option_id)
        attempt.answers = answers
        await db.flush()
        return attempt

    @staticmethod
    async def finish_quiz(
        db: AsyncSession,
        *,
        user_id: int,
        attempt_id: int,
        answers: dict[str, int],
    ) -> schemas.QuizFinishResponse:
        attempt = await db.scalar(
            select(models.QuizAttempt)
            .where(models.QuizAttempt.id == attempt_id)
            .where(models.QuizAttempt.user_id == user_id)
        )
        if not attempt or attempt.completed_at:
            raise ValueError("Quiz attempt not found or already completed.")

        exercise, section, track = await SubmissionService.get_exercise_context(db, int(attempt.exercise_id))
        merged_answers = {**(attempt.answers or {}), **{str(k): int(v) for k, v in answers.items()}}
        correct = 0
        questions = sorted(exercise.quiz_questions or [], key=lambda item: int(item.order or 0))
        correct_options = {
            str(question.id): {int(option.id) for option in question.options if option.is_correct}
            for question in questions
        }
        for question_id, selected_option_id in merged_answers.items():
            if int(selected_option_id) in correct_options.get(str(question_id), set()):
                correct += 1

        total = len(questions)
        pct = round((correct / total) * 100) if total else 0
        passed = pct >= int(exercise.passing_score_pct or 70)

        attempt.answers = merged_answers
        attempt.score = correct
        attempt.total_questions = total
        attempt.passed = passed
        attempt.completed_at = datetime.utcnow()

        progress_snapshot: dict[str, Any] = {}
        badges: list[models.Badge] = []
        xp_event = None
        if passed:
            progress_snapshot = await ProgressService.complete_exercise(
                db,
                user_id=user_id,
                exercise=exercise,
                score=pct,
            )
            xp_event, badges = await RewardService.award_xp(
                db,
                user_id=user_id,
                track_id=int(track.id),
                section_id=int(section.id),
                exercise_id=int(exercise.id),
                source_type="quiz_pass",
                source_id=int(exercise.id),
                points=int(exercise.xp_reward or 0),
                reason=f"Passed quiz: {exercise.title}",
            )
            attempt.xp_awarded = int(xp_event.points if xp_event else 0)

        await db.flush()
        return schemas.QuizFinishResponse(
            attempt_id=int(attempt.id),
            score=correct,
            total_questions=total,
            passed=passed,
            xp_awarded=int(xp_event.points if xp_event else 0),
            progress=progress_snapshot,
            badges_awarded=[SubmissionService._badge_payload(badge) for badge in badges],
        )

    @staticmethod
    def _submitted_files(
        exercise: models.Exercise,
        payload: schemas.ExerciseRunRequest,
        track_language_id: int,
    ) -> list[schemas.SubmittedFile]:
        if payload.files:
            return payload.files
        if payload.source_code is not None:
            entry = SubmissionService._entry_file(exercise)
            return [
                schemas.SubmittedFile(
                    file_path=entry.file_path if entry else SubmissionService._default_file_name(track_language_id),
                    content=payload.source_code,
                    language=entry.language if entry else None,
                    is_entrypoint=True,
                )
            ]
        if exercise.files:
            return [
                schemas.SubmittedFile(
                    file_path=file.file_path,
                    content=file.starter_code or "",
                    language=file.language,
                    is_entrypoint=bool(file.is_entrypoint),
                )
                for file in sorted(exercise.files, key=lambda item: int(item.order or 0))
            ]
        legacy_task = sorted(exercise.tasks or [], key=lambda item: int(item.step_number or 0))[0] if exercise.tasks else None
        return [
            schemas.SubmittedFile(
                file_path=SubmissionService._default_file_name(track_language_id),
                content=legacy_task.starter_code if legacy_task else "",
                language=None,
                is_entrypoint=True,
            )
        ]

    @staticmethod
    def _entry_file(exercise: models.Exercise) -> models.ExerciseFile | None:
        if not exercise.files:
            return None
        return next((file for file in exercise.files if file.is_entrypoint), exercise.files[0])

    @staticmethod
    def _default_file_name(language_id: int) -> str:
        return {
            50: "main.c",
            54: "main.cpp",
            60: "main.go",
            62: "Main.java",
            63: "main.js",
            71: "main.py",
            73: "main.rs",
            74: "main.ts",
        }.get(int(language_id or 71), "main.py")

    @staticmethod
    def _language_id_for_files(files: list[schemas.SubmittedFile], fallback: int) -> int:
        entry = next((file for file in files if file.is_entrypoint), files[0] if files else None)
        if not entry:
            return fallback
        path = entry.file_path.lower()
        if path.endswith(".py"):
            return 71
        if path.endswith(".js"):
            return 63
        if path.endswith(".ts"):
            return 74
        if path.endswith(".java"):
            return 62
        if path.endswith(".cpp"):
            return 54
        if path.endswith(".c"):
            return 50
        if path.endswith(".go"):
            return 60
        if path.endswith(".rs"):
            return 73
        return fallback

    @staticmethod
    def _test_cases(exercise: models.Exercise) -> list[dict[str, Any]]:
        if exercise.test_cases:
            return [
                {
                    "label": case.label,
                    "stdin": case.stdin or "",
                    "expected_outputs": case.expected_outputs
                    or ([case.expected_stdout] if case.expected_stdout is not None else []),
                    "match_mode": case.match_mode or "normalize",
                    "is_hidden": bool(case.is_hidden),
                    "timeout_ms": case.timeout_ms,
                    "memory_limit_mb": case.memory_limit_mb,
                    "custom_judge_options": case.custom_judge_options or {},
                }
                for case in sorted(exercise.test_cases, key=lambda item: int(item.order or 0))
            ]

        legacy_task = sorted(exercise.tasks or [], key=lambda item: int(item.step_number or 0))[0] if exercise.tasks else None
        raw = legacy_task.test_cases if legacy_task else None
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except json.JSONDecodeError:
                raw = []
        if not isinstance(raw, list) or not raw:
            return [{"stdin": "", "expected_outputs": [], "match_mode": "normalize", "is_hidden": False}]

        normalized = []
        for index, case in enumerate(raw):
            expected_outputs = case.get("expected_outputs")
            if expected_outputs is None and case.get("expected_output") is not None:
                expected_outputs = [case.get("expected_output")]
            normalized.append(
                {
                    "label": case.get("label") or f"Test {index + 1}",
                    "stdin": case.get("stdin", case.get("input", "")),
                    "expected_outputs": expected_outputs or [],
                    "match_mode": case.get("match_mode", "normalize"),
                    "is_hidden": bool(case.get("is_hidden", index > 0)),
                }
            )
        return normalized

    @staticmethod
    async def _judge_submission(
        *,
        files: list[schemas.SubmittedFile],
        language_id: int,
        test_case: dict[str, Any],
        mode: str,
    ) -> dict[str, Any]:
        entry = next((file for file in files if file.is_entrypoint), files[0] if files else None)
        source_code = entry.content if entry else ""
        judge_payload: dict[str, Any] = {
            "source_code": source_code,
            "language_id": language_id,
            "stdin": test_case.get("stdin") or "",
            "expected_outputs": test_case.get("expected_outputs") or [],
            "match_mode": test_case.get("match_mode") or "normalize",
            "files": [file.model_dump() for file in files],
            "entrypoint": entry.file_path if entry else None,
            "validation_kind": test_case.get("validation_kind") or ("frontend_preview" if mode == "frontend_preview" else "code"),
            "validation_config": test_case.get("validation_config") or {},
            "timeout_ms": test_case.get("timeout_ms"),
            "memory_limit_mb": test_case.get("memory_limit_mb"),
            "custom_judge_options": test_case.get("custom_judge_options") or {},
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                create_resp = await client.post(f"{JUDGE_URL}/submissions", json=judge_payload)
                create_resp.raise_for_status()
                job_id = create_resp.json().get("job_id")
                for _ in range(40):
                    await asyncio.sleep(0.5)
                    poll_resp = await client.get(f"{JUDGE_URL}/submissions/{job_id}")
                    poll_resp.raise_for_status()
                    result = poll_resp.json()
                    if result.get("status") == "completed" or result.get("verdict"):
                        return result
        except Exception as exc:
            return {
                "status": "completed",
                "verdict": "Internal Error",
                "output": None,
                "error": f"Judge request failed: {exc}",
            }
        return {
            "status": "completed",
            "verdict": "Time Limit Exceeded",
            "output": None,
            "error": "Judge polling timed out.",
        }

    @staticmethod
    async def _hint_usage_count(db: AsyncSession, *, user_id: int, exercise_id: int) -> int:
        return int(
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

    @staticmethod
    async def _viewed_reference(db: AsyncSession, *, user_id: int, exercise: models.Exercise) -> bool:
        value = await db.scalar(
            select(models.ReferenceAccess.id)
            .where(models.ReferenceAccess.user_id == user_id)
            .where(models.ReferenceAccess.exercise_id == exercise.id)
        )
        return value is not None

    @staticmethod
    async def _xp_after_hint_penalties(
        db: AsyncSession,
        *,
        user_id: int,
        exercise: models.Exercise,
    ) -> int:
        rows = await db.execute(
            select(func.coalesce(func.sum(models.Hint.penalty_xp), 0))
            .select_from(models.HintUsage)
            .join(models.Hint, models.Hint.id == models.HintUsage.hint_id)
            .where(models.HintUsage.user_id == user_id)
            .where(models.HintUsage.exercise_id == exercise.id)
        )
        penalty = int(rows.scalar_one() or 0)
        return max(0, int(exercise.xp_reward or 0) - penalty)

    @staticmethod
    async def _hint_is_unlocked(
        db: AsyncSession,
        *,
        user_id: int,
        exercise_id: int,
        hint: models.Hint,
    ) -> bool:
        if hint.unlock_rule == "always":
            return True
        attempts = await db.scalars(
            select(models.ExerciseAttempt)
            .where(models.ExerciseAttempt.user_id == user_id)
            .where(models.ExerciseAttempt.exercise_id == exercise_id)
        )
        attempt_list = list(attempts.all())
        if hint.unlock_rule == "after_first_run":
            return bool(attempt_list)
        if hint.unlock_rule == "after_failed_run":
            return any(attempt.status == "failed" for attempt in attempt_list)
        return False

    @staticmethod
    def _normalize_mode(mode: str | None) -> str:
        if mode == "task":
            return "code"
        return mode or "code"

    @staticmethod
    def _badge_payload(badge: models.Badge) -> dict[str, Any]:
        return {
            "id": badge.id,
            "badge_key": badge.badge_key,
            "title": badge.title,
            "description": badge.description,
            "icon_url": badge.icon_url,
            "scope": badge.scope,
        }
