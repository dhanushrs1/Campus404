from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from auth.models import Base


class Track(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(256), nullable=False)
    slug = Column(String(256), nullable=True)
    description = Column(Text, nullable=True)
    featured_image_url = Column(String(1024), nullable=True)
    language_id = Column(Integer, nullable=False)
    order = Column(Integer, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)

    sections = relationship("Section", back_populates="track", cascade="all, delete-orphan")
    track_progress = relationship("UserTrackProgress", back_populates="track", cascade="all, delete-orphan")


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    title = Column(String(256), nullable=False)
    slug = Column(String(256), nullable=True)
    order = Column(Integer, nullable=False)
    badge_url = Column(String(1024), nullable=True)

    track = relationship("Track", back_populates="sections")
    exercises = relationship("Exercise", back_populates="section", cascade="all, delete-orphan")
    section_progress = relationship("UserSectionProgress", back_populates="section", cascade="all, delete-orphan")


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    slug = Column(String(256), nullable=True)
    title = Column(String(256), nullable=False)
    order = Column(Integer, nullable=False)
    mode = Column(String(50), default="code", nullable=False)
    theory_content = Column(Text, nullable=True)
    instructions_md = Column(Text, nullable=True)
    xp_reward = Column(Integer, default=20, nullable=False)
    unlock_rule = Column(String(64), default="previous_completed", nullable=False)
    reference_solution_url = Column(String(1024), nullable=True)
    docs_url = Column(String(1024), nullable=True)
    passing_score_pct = Column(Integer, default=70, nullable=False)
    attempts_allowed = Column(Integer, nullable=True)
    validation_config = Column(JSON, nullable=True)
    auto_submit_on_pass = Column(Boolean, default=False, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)

    section = relationship("Section", back_populates="exercises")
    tasks = relationship("Task", back_populates="exercise", cascade="all, delete-orphan")
    files = relationship("ExerciseFile", back_populates="exercise", cascade="all, delete-orphan")
    test_cases = relationship("ExerciseTestCase", back_populates="exercise", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="exercise", cascade="all, delete-orphan")
    hints = relationship("Hint", back_populates="exercise", cascade="all, delete-orphan")
    exercise_progress = relationship("UserExerciseProgress", back_populates="exercise", cascade="all, delete-orphan")


class ExerciseFile(Base):
    __tablename__ = "exercise_files"
    __table_args__ = (
        UniqueConstraint("exercise_id", "file_path", name="uq_exercise_files_path"),
        Index("ix_exercise_files_exercise_order", "exercise_id", "order"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    file_path = Column(String(512), nullable=False)
    language = Column(String(64), nullable=False, default="plaintext")
    starter_code = Column(Text, nullable=True)
    solution_code = Column(Text, nullable=True)
    is_entrypoint = Column(Boolean, default=False, nullable=False)
    is_editable = Column(Boolean, default=True, nullable=False)
    order = Column(Integer, nullable=False, default=1)

    exercise = relationship("Exercise", back_populates="files")


class ExerciseTestCase(Base):
    __tablename__ = "exercise_test_cases"
    __table_args__ = (Index("ix_exercise_test_cases_exercise_order", "exercise_id", "order"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    label = Column(String(256), nullable=True)
    stdin = Column(Text, nullable=True)
    expected_stdout = Column(Text, nullable=True)
    expected_outputs = Column(JSON, nullable=True)
    match_mode = Column(String(32), default="normalize", nullable=False)
    is_hidden = Column(Boolean, default=True, nullable=False)
    timeout_ms = Column(Integer, nullable=True)
    memory_limit_mb = Column(Integer, nullable=True)
    custom_judge_options = Column(JSON, nullable=True)
    order = Column(Integer, nullable=False, default=1)

    exercise = relationship("Exercise", back_populates="test_cases")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(64), default="multiple_choice", nullable=False)
    code_snippet = Column(Text, nullable=True)
    explanation_md = Column(Text, nullable=True)
    order = Column(Integer, nullable=False)

    exercise = relationship("Exercise", back_populates="quiz_questions")
    options = relationship("QuizOption", back_populates="question", cascade="all, delete-orphan")


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("quiz_questions.id"), nullable=False)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)
    explanation_md = Column(Text, nullable=True)
    order = Column(Integer, nullable=False)

    question = relationship("QuizQuestion", back_populates="options")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    instructions_md = Column(Text, nullable=False)
    starter_code = Column(Text, nullable=True)
    solution_code = Column(Text, nullable=True)
    test_cases = Column(JSON, nullable=True)

    exercise = relationship("Exercise", back_populates="tasks")


class UserTaskProgress(Base):
    __tablename__ = "user_task_progress"
    __table_args__ = (UniqueConstraint("user_id", "task_id", name="uq_user_task_progress_user_task"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="completed")
    completed_at = Column(DateTime(timezone=True), server_default=func.now())


class ExerciseAttempt(Base):
    __tablename__ = "exercise_attempts"
    __table_args__ = (
        Index("ix_exercise_attempts_user_exercise_created", "user_id", "exercise_id", "created_at"),
        Index("ix_exercise_attempts_track_created", "track_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="running")
    mode = Column(String(50), nullable=False)
    submitted_files = Column(JSON, nullable=True)
    judge_result = Column(JSON, nullable=True)
    tests_passed = Column(Integer, default=0, nullable=False)
    tests_total = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    used_hint_count = Column(Integer, default=0, nullable=False)
    viewed_solution = Column(Boolean, default=False, nullable=False)
    xp_awarded = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        Index("ix_quiz_attempts_user_exercise_started", "user_id", "exercise_id", "started_at"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False, index=True)
    score = Column(Integer, default=0, nullable=False)
    total_questions = Column(Integer, default=0, nullable=False)
    passed = Column(Boolean, default=False, nullable=False)
    answers = Column(JSON, nullable=True)
    xp_awarded = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class UserExerciseProgress(Base):
    __tablename__ = "user_exercise_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "exercise_id", name="uq_user_exercise_progress_user_exercise"),
        Index("ix_user_exercise_progress_track_user", "track_id", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="locked")
    best_score = Column(Integer, default=0, nullable=False)
    attempts_count = Column(Integer, default=0, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    exercise = relationship("Exercise", back_populates="exercise_progress")


class UserSectionProgress(Base):
    __tablename__ = "user_section_progress"
    __table_args__ = (UniqueConstraint("user_id", "section_id", name="uq_user_section_progress_user_section"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, index=True)
    completed_exercises = Column(Integer, default=0, nullable=False)
    total_exercises = Column(Integer, default=0, nullable=False)
    status = Column(String(32), nullable=False, default="locked")
    completed_at = Column(DateTime(timezone=True), nullable=True)

    section = relationship("Section", back_populates="section_progress")


class UserTrackProgress(Base):
    __tablename__ = "user_track_progress"
    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_user_track_progress_user_track"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, index=True)
    completed_sections = Column(Integer, default=0, nullable=False)
    total_sections = Column(Integer, default=0, nullable=False)
    completed_exercises = Column(Integer, default=0, nullable=False)
    total_exercises = Column(Integer, default=0, nullable=False)
    total_xp = Column(Integer, default=0, nullable=False)
    status = Column(String(32), nullable=False, default="not_started")
    last_exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    track = relationship("Track", back_populates="track_progress")


class XpEvent(Base):
    __tablename__ = "xp_events"
    __table_args__ = (
        UniqueConstraint("user_id", "source_type", "source_id", name="uq_xp_events_once_per_source"),
        Index("ix_xp_events_user_created", "user_id", "created_at"),
        Index("ix_xp_events_track_created", "track_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=True, index=True)
    source_type = Column(String(64), nullable=False)
    source_id = Column(String(128), nullable=False)
    points = Column(Integer, nullable=False)
    reason = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Badge(Base):
    __tablename__ = "badges"
    __table_args__ = (UniqueConstraint("badge_key", name="uq_badges_badge_key"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    badge_key = Column(String(128), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    icon_url = Column(String(1024), nullable=True)
    scope = Column(String(32), nullable=False, default="global")
    rule_type = Column(String(64), nullable=False)
    rule_config = Column(JSON, nullable=True)
    xp_bonus = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    user_badges = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", "track_id", "section_id", name="uq_user_badges_scope"),
        Index("ix_user_badges_user_awarded", "user_id", "awarded_at"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id = Column(Integer, ForeignKey("badges.id"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True, index=True)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    badge = relationship("Badge", back_populates="user_badges")


class Hint(Base):
    __tablename__ = "hints"
    __table_args__ = (Index("ix_hints_exercise_order", "exercise_id", "order"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    content_md = Column(Text, nullable=False)
    order = Column(Integer, nullable=False)
    unlock_rule = Column(String(64), nullable=False, default="after_failed_run")
    penalty_xp = Column(Integer, nullable=True)

    exercise = relationship("Exercise", back_populates="hints")


class HintUsage(Base):
    __tablename__ = "hint_usages"
    __table_args__ = (UniqueConstraint("user_id", "hint_id", name="uq_hint_usage_user_hint"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    hint_id = Column(Integer, ForeignKey("hints.id"), nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ReferenceAccess(Base):
    __tablename__ = "reference_accesses"
    __table_args__ = (Index("ix_reference_accesses_user_exercise", "user_id", "exercise_id"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False, index=True)
    reference_url = Column(String(1024), nullable=False)
    accessed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
