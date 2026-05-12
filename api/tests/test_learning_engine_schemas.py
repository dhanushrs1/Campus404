from curriculum import schemas


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
