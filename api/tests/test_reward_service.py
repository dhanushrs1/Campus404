import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from auth.models import Base, User
from curriculum import models
from curriculum.services.rewards import RewardService


@pytest_asyncio.fixture()
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


async def create_learning_fixture(db_session):
    user = User(
        email="learner@example.com",
        first_name="Campus",
        last_name="Learner",
        username="campuslearner",
        auth_provider="google",
    )
    track = models.Track(title="Python", slug="python", language_id=1, order=1, is_published=True)
    section = models.Section(title="Basics", slug="basics", order=1, track=track)
    exercise = models.Exercise(title="Print", slug="print", order=1, section=section, xp_reward=20, is_published=True)
    db_session.add_all([user, track])
    await db_session.flush()
    return user, track, section, exercise


@pytest.mark.asyncio
async def test_award_xp_is_idempotent_for_non_repeatable_sources(db_session):
    user, track, section, exercise = await create_learning_fixture(db_session)

    first_event, first_badges = await RewardService.award_xp(
        db_session,
        user_id=user.id,
        track_id=track.id,
        section_id=section.id,
        exercise_id=exercise.id,
        source_type="exercise_completion",
        source_id=exercise.id,
        points=20,
        reason="Completed Print",
    )
    second_event, second_badges = await RewardService.award_xp(
        db_session,
        user_id=user.id,
        track_id=track.id,
        section_id=section.id,
        exercise_id=exercise.id,
        source_type="exercise_completion",
        source_id=exercise.id,
        points=20,
        reason="Completed Print again",
    )

    xp_count = await db_session.scalar(select(func.count()).select_from(models.XpEvent))
    track_progress = await db_session.scalar(
        select(models.UserTrackProgress)
        .where(models.UserTrackProgress.user_id == user.id)
        .where(models.UserTrackProgress.track_id == track.id)
    )

    assert first_event is not None
    assert first_event.points == 20
    assert first_badges == []
    assert second_event is None
    assert second_badges == []
    assert xp_count == 1
    assert track_progress.total_xp == 20
