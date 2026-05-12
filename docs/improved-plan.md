# Campus404 Learning Engine Implementation

## Summary

Campus404 is being upgraded from a task-progress prototype into a scalable learning engine. The new system keeps the existing Track -> Section -> Exercise hierarchy, makes Exercise the student-facing level, and adds mode-specific behavior for code, multi-file code, frontend preview, theory, quiz, and project exercises.

All reward, badge, progress, quiz, and leaderboard decisions are owned by the backend. The frontend displays state and sends user intent only. User code must never execute inside the API service; every executable or validation payload is routed through the judge service.

## Implementation Stages

1. Add Alembic migrations and the new learning-engine tables.
2. Add backend services for rewards, progress, submissions, and leaderboards.
3. Extend the judge service for multi-file submissions and frontend-preview validation.
4. Add workspace, quiz, leaderboard, progress, badge, and admin API endpoints.
5. Refactor frontend pages to consume backend progress, XP, badges, and leaderboard data.
6. Rebuild the workspace around mode-based components.
7. Expand the admin curriculum studio for files, hints, quiz settings, tests, XP, badges, and unlock rules.
8. Add Python Core seed content for all supported modes.
9. Add backend, judge, and frontend verification coverage.

## Data Model Direction

- `Exercise.mode` supports `code`, `multi_file_code`, `frontend_preview`, `theory`, `quiz`, and `project`.
- Legacy `Task` and `UserTaskProgress` remain temporarily for compatibility and migration.
- New first-class tables cover exercise files, attempts, quiz attempts, exercise/section/track progress, XP events, badges, hint usage, and reference access.
- XP is idempotent by source event unless a repeatable event is explicitly supported by backend rules.
- Track leaderboards use `XpEvent.track_id`; global leaderboards use all `XpEvent` records.

## Backend Services

- `RewardService` awards XP, prevents duplicate one-time rewards, updates track XP, and evaluates badge rules.
- `ProgressService` unlocks exercises, updates exercise/section/track progress, and returns current learning state.
- `SubmissionService` handles code runs, submissions, theory completion, frontend validations, and quiz completion.
- `LeaderboardService` aggregates all-time, weekly, and monthly rankings with pagination and current-user rank support.

## Frontend Direction

- Tracks and track overview pages use backend progress instead of localStorage as the source of truth.
- Workspace uses a light Campus404 shell with dark editor/terminal surfaces only.
- Workspace mode components handle code, multi-file code, frontend preview, theory, quiz, and project experiences.
- Admin curriculum studio supports exercise modes, files, hints, references, tests, quiz content, XP, badges, and unlock rules.

## Test Plan

- Backend tests: XP idempotency, progress unlocks, quiz pass/fail, badge awarding, leaderboards, and user progress endpoints.
- Judge tests: single-file code, multi-file code, hidden/visible tests, frontend validation, timeout behavior, and unsupported language handling.
- Frontend checks: workspace mode rendering, submit locking, hint unlocks, leaderboard filters, admin editing flows, and production build.

## Assumptions

- Exercise is the student-facing level.
- Existing task data is kept as compatibility data and can be migrated gradually.
- Alembic becomes the production migration path.
- Backend XP and badge services are the only authority for rewards.
- Judge remains the only service that executes or validates submitted code.
