import os
from datetime import UTC, datetime, timedelta

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from auth.models import Base, User
from curriculum import models as curriculum_models
from curriculum.services.rewards import RewardService
from profile import models as profile_models
from profile import schemas as profile_schemas
from profile.services import CertificateService, ConnectionService, CreditService, ProfileService


@pytest_asyncio.fixture()
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


async def create_user(db_session, username="campuslearner", email="learner@example.com"):
    user = User(
        email=email,
        first_name="Campus",
        last_name="Learner",
        username=username,
        auth_provider="google",
        avatar="/assets/avatars/pixel-curly-black-blue-hoodie.webp",
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def create_track_fixture(db_session, user):
    track = curriculum_models.Track(title="Python", slug="python", language_id=1, order=1, is_published=True)
    section = curriculum_models.Section(title="Basics", slug="basics", order=1, track=track)
    exercise = curriculum_models.Exercise(
        title="Print",
        slug="print",
        order=1,
        section=section,
        xp_reward=20,
        is_published=True,
    )
    db_session.add(track)
    await db_session.flush()
    return track, section, exercise


@pytest.mark.asyncio
async def test_daily_check_in_is_idempotent_and_awards_seven_day_bonus(db_session):
    user = await create_user(db_session)
    today = datetime.now(UTC).date()

    for offset in range(1, 7):
        db_session.add(
            profile_models.UserCreditLedger(
                user_id=user.id,
                amount=10,
                source_type="daily_check_in",
                source_id=(today - timedelta(days=offset)).isoformat(),
                reason="Past visit",
            )
        )
    await db_session.flush()

    first = await CreditService.claim_daily_check_in(db_session, int(user.id))
    second = await CreditService.claim_daily_check_in(db_session, int(user.id))

    assert first.awarded == 10
    assert first.bonus_awarded == 25
    assert first.daily_check_in_streak == 7
    assert second.already_claimed is True
    assert second.awarded == 0
    assert await CreditService.balance(db_session, int(user.id)) == 95


@pytest.mark.asyncio
async def test_reward_service_awards_task_completion_credits_once(db_session):
    user = await create_user(db_session)
    track, section, exercise = await create_track_fixture(db_session, user)

    first_event, _ = await RewardService.award_xp(
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
    second_event, _ = await RewardService.award_xp(
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

    credit_count = await db_session.scalar(
        select(func.count())
        .select_from(profile_models.UserCreditLedger)
        .where(profile_models.UserCreditLedger.user_id == user.id)
        .where(profile_models.UserCreditLedger.source_type == "task_completion")
    )

    assert first_event is not None
    assert second_event is None
    assert credit_count == 1
    assert await CreditService.balance(db_session, int(user.id)) == 5


@pytest.mark.asyncio
async def test_public_profile_honors_showcase_privacy_toggles(db_session):
    user = await create_user(db_session)
    profile = await ProfileService.ensure_profile(db_session, user)
    profile.show_badges = False
    profile.show_activity = False
    profile.show_projects = False

    db_session.add(
        profile_models.UserProjectPin(
            user_id=user.id,
            title="Hidden Build",
            project_url="https://example.com",
            is_public=True,
        )
    )
    await db_session.flush()

    public_profile = await ProfileService.public_profile(db_session, user.username)

    assert public_profile.username == user.username
    assert public_profile.badges == []
    assert public_profile.activity == []
    assert public_profile.projects == []
    assert not hasattr(public_profile, "email")


@pytest.mark.asyncio
async def test_connection_rejects_self_connect(db_session):
    user = await create_user(db_session)

    with pytest.raises(PermissionError):
        await ConnectionService.connect(db_session, user, user.username)


@pytest.mark.asyncio
async def test_connection_rejects_private_profile_without_writing_connection(db_session):
    viewer = await create_user(db_session, username="viewer", email="viewer@example.com")
    target = await create_user(db_session, username="private-user", email="private@example.com")
    target_profile = await ProfileService.ensure_profile(db_session, target)
    target_profile.is_public = False
    await db_session.flush()

    with pytest.raises(PermissionError, match="private"):
        await ConnectionService.connect(db_session, viewer, target.username)

    connection_count = await db_session.scalar(
        select(func.count())
        .select_from(profile_models.UserConnection)
        .where(profile_models.UserConnection.connector_user_id == viewer.id)
        .where(profile_models.UserConnection.connected_user_id == target.id)
    )
    assert connection_count == 0


@pytest.mark.asyncio
async def test_owner_can_preview_private_profile(db_session):
    user = await create_user(db_session)
    profile = await ProfileService.ensure_profile(db_session, user)
    profile.is_public = False
    await db_session.flush()

    result = await ProfileService.public_profile(db_session, user.username, viewer=user)

    assert result.is_self is True
    assert result.is_public is False


def test_profile_update_rejects_unsafe_public_urls():
    with pytest.raises(ValueError):
        profile_schemas.UserProfileUpdate(website_url="javascript:alert(1)")

    payload = profile_schemas.UserProfileUpdate(website_url=" https://campus404.example/profile ")
    assert payload.website_url == "https://campus404.example/profile"


def test_project_payload_requires_a_web_url():
    with pytest.raises(ValueError):
        profile_schemas.ProjectPinCreate(title="Unsafe", project_url="javascript:alert(1)")


@pytest.mark.asyncio
async def test_certificate_claim_requires_completed_track_and_is_idempotent(db_session):
    user = await create_user(db_session)
    track, _, _ = await create_track_fixture(db_session, user)
    db_session.add(
        curriculum_models.UserTrackProgress(
            user_id=user.id,
            track_id=track.id,
            completed_exercises=3,
            total_exercises=3,
            status="completed",
        )
    )
    await db_session.flush()

    first = await CertificateService.claim(db_session, user, int(track.id))
    second = await CertificateService.claim(db_session, user, int(track.id))

    assert first.already_claimed is False
    assert first.certificate.track_id == track.id
    assert second.already_claimed is True
    assert second.certificate.certificate_code == first.certificate.certificate_code


@pytest.mark.asyncio
async def test_profile_update_switches_between_campus_and_provider_avatar(db_session):
    user = await create_user(db_session)
    profile = await ProfileService.ensure_profile(db_session, user, provider_avatar_url="https://provider/avatar.png")

    await ProfileService.update_profile(
        db_session,
        user,
        profile_schemas.UserProfileUpdate(avatar_source="provider"),
    )
    assert user.avatar == "https://provider/avatar.png"

    await ProfileService.update_profile(
        db_session,
        user,
        profile_schemas.UserProfileUpdate(
            avatar_source="selected",
            selected_avatar_url="/assets/avatars/pixel-blue-streak-404-hoodie.webp",
        ),
    )
    assert user.avatar == "/assets/avatars/pixel-blue-streak-404-hoodie.webp"
