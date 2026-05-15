import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
from fastapi import HTTPException

import curriculum.router as curriculum_router
from auth.models import User
from curriculum import models, schemas


def test_workspace_run_request_accepts_multi_file_payload():
    payload = schemas.ExerciseRunRequest(
        files=[
            schemas.SubmittedFile(file_path="main.py", content="from helpers import double\nprint(double(2))", is_entrypoint=True),
            schemas.SubmittedFile(file_path="helpers.py", content="def double(value):\n    return value * 2\n"),
        ]
    )

    assert len(payload.files) == 2
    assert payload.files[0].is_entrypoint is True


def test_leaderboard_response_supports_current_user_rank():
    entry = schemas.LeaderboardEntry(
        rank=1,
        user_id=7,
        display_name="Campus Learner",
        username="campuslearner",
        total_xp=120,
        completed_exercises=4,
        badges_count=2,
        current_streak=3,
    )
    response = schemas.LeaderboardResponse(entries=[entry], current_user_rank=entry, total=1)

    assert response.current_user_rank.username == "campuslearner"
    assert response.entries[0].total_xp == 120


def test_admin_dashboard_stats_supports_visit_analytics_fields():
    stats = schemas.AdminDashboardStats(
        unique_visits_24h=3,
        visit_activity_by_day=[{"date": "2026-05-14", "unique_visits": 3}],
        top_entry_paths=[{"path": "/tracks", "visits": 3}],
        xp_awarded_24h=40,
    )

    assert stats.unique_visits_24h == 3
    assert stats.visit_activity_by_day[0]["unique_visits"] == 3
    assert stats.top_entry_paths[0]["path"] == "/tracks"
    assert stats.xp_awarded_24h == 40


def test_publish_permissions_require_admin_for_destructive_actions():
    with pytest.raises(HTTPException) as exc_info:
        curriculum_router._require_platform_admin(User(username="editor", role="EDITOR"))

    assert exc_info.value.status_code == 403

    curriculum_router._require_platform_admin(User(username="admin", role="ADMIN"))


def test_meaningful_test_cases_require_non_empty_expected_output():
    exercise = models.Exercise(title="Blank output", order=1, section_id=1, mode="code")
    exercise.test_cases = [
        models.ExerciseTestCase(label="Blank", expected_outputs=[""], order=1),
    ]

    assert curriculum_router._has_meaningful_test_cases(exercise) is False

    exercise.test_cases = [
        models.ExerciseTestCase(label="Real output", expected_outputs=["42"], order=1),
    ]

    assert curriculum_router._has_meaningful_test_cases(exercise) is True


def test_frontend_acceptance_rules_require_at_least_one_real_rule():
    assert curriculum_router._has_frontend_acceptance_rules({}) is False
    assert curriculum_router._has_frontend_acceptance_rules({"required_text": [""]}) is False
    assert curriculum_router._has_frontend_acceptance_rules({"required_selectors": [".profile-card"]}) is True
