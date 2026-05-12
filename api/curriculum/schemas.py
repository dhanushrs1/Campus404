from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class UserTaskProgressBase(BaseModel):
    task_id: int
    status: str = "completed"


class UserTaskProgressResponse(UserTaskProgressBase):
    id: int
    user_id: int
    completed_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TaskBase(BaseModel):
    instructions_md: str
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    test_cases: Optional[List[Dict[str, Any]]] = None


class TaskCreate(TaskBase):
    step_number: Optional[int] = None


class TaskUpdate(BaseModel):
    step_number: Optional[int] = None
    instructions_md: Optional[str] = None
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    test_cases: Optional[List[Dict[str, Any]]] = None


class TaskInDB(TaskBase):
    id: int
    exercise_id: int
    step_number: int
    model_config = ConfigDict(from_attributes=True)


class TaskStudent(BaseModel):
    id: int
    exercise_id: int
    step_number: int
    instructions_md: str
    starter_code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ExerciseFileBase(BaseModel):
    file_path: str
    language: str = "plaintext"
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    is_entrypoint: bool = False
    is_editable: bool = True
    order: Optional[int] = None


class ExerciseFileCreate(ExerciseFileBase):
    pass


class ExerciseFileUpdate(BaseModel):
    file_path: Optional[str] = None
    language: Optional[str] = None
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    is_entrypoint: Optional[bool] = None
    is_editable: Optional[bool] = None
    order: Optional[int] = None


class ExerciseFileInDB(ExerciseFileBase):
    id: int
    exercise_id: int
    order: int
    model_config = ConfigDict(from_attributes=True)


class ExerciseFileStudent(BaseModel):
    id: int
    exercise_id: int
    file_path: str
    language: str
    starter_code: Optional[str] = None
    is_entrypoint: bool = False
    is_editable: bool = True
    order: int
    model_config = ConfigDict(from_attributes=True)


class ExerciseTestCaseBase(BaseModel):
    label: Optional[str] = None
    stdin: Optional[str] = None
    expected_stdout: Optional[str] = None
    expected_outputs: Optional[List[str]] = None
    match_mode: str = "normalize"
    is_hidden: bool = True
    timeout_ms: Optional[int] = None
    memory_limit_mb: Optional[int] = None
    custom_judge_options: Optional[Dict[str, Any]] = None
    order: Optional[int] = None


class ExerciseTestCaseCreate(ExerciseTestCaseBase):
    pass


class ExerciseTestCaseUpdate(BaseModel):
    label: Optional[str] = None
    stdin: Optional[str] = None
    expected_stdout: Optional[str] = None
    expected_outputs: Optional[List[str]] = None
    match_mode: Optional[str] = None
    is_hidden: Optional[bool] = None
    timeout_ms: Optional[int] = None
    memory_limit_mb: Optional[int] = None
    custom_judge_options: Optional[Dict[str, Any]] = None
    order: Optional[int] = None


class ExerciseTestCaseInDB(ExerciseTestCaseBase):
    id: int
    exercise_id: int
    order: int
    model_config = ConfigDict(from_attributes=True)


class HintBase(BaseModel):
    content_md: str
    order: Optional[int] = None
    unlock_rule: str = "after_failed_run"
    penalty_xp: Optional[int] = None


class HintCreate(HintBase):
    pass


class HintUpdate(BaseModel):
    content_md: Optional[str] = None
    order: Optional[int] = None
    unlock_rule: Optional[str] = None
    penalty_xp: Optional[int] = None


class HintStudent(BaseModel):
    id: int
    exercise_id: int
    order: int
    unlock_rule: str
    penalty_xp: Optional[int] = None
    is_unlocked: bool = False
    has_used: bool = False
    content_md: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class HintInDB(HintBase):
    id: int
    exercise_id: int
    order: int
    model_config = ConfigDict(from_attributes=True)


class QuizOptionBase(BaseModel):
    option_text: str
    is_correct: bool = False
    explanation_md: Optional[str] = None
    order: Optional[int] = None


class QuizOptionCreate(QuizOptionBase):
    pass


class QuizOptionInDB(QuizOptionBase):
    id: int
    question_id: int
    order: int
    model_config = ConfigDict(from_attributes=True)


class QuizOptionStudent(BaseModel):
    id: int
    question_id: int
    option_text: str
    order: int
    model_config = ConfigDict(from_attributes=True)


class QuizQuestionBase(BaseModel):
    question_text: str
    question_type: str = "multiple_choice"
    code_snippet: Optional[str] = None
    explanation_md: Optional[str] = None
    order: Optional[int] = None


class QuizQuestionCreate(QuizQuestionBase):
    options: List[QuizOptionCreate] = Field(default_factory=list)


class QuizQuestionInDB(QuizQuestionBase):
    id: int
    exercise_id: int
    order: int
    options: List[QuizOptionInDB] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class QuizQuestionStudent(BaseModel):
    id: int
    exercise_id: int
    question_text: str
    question_type: str = "multiple_choice"
    code_snippet: Optional[str] = None
    order: int
    options: List[QuizOptionStudent] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class QuizPayload(BaseModel):
    passing_score_pct: int = 70
    attempts_allowed: Optional[int] = None
    questions: List[QuizQuestionCreate] = Field(default_factory=list)


class AdminValidationFile(BaseModel):
    file_path: str
    content: str
    language: Optional[str] = None
    is_entrypoint: bool = False


class ExerciseBase(BaseModel):
    title: str
    slug: Optional[str] = None
    mode: str = "code"
    theory_content: Optional[str] = None
    instructions_md: Optional[str] = None
    xp_reward: int = 20
    unlock_rule: str = "previous_completed"
    reference_solution_url: Optional[str] = None
    docs_url: Optional[str] = None
    passing_score_pct: int = 70
    attempts_allowed: Optional[int] = None
    validation_config: Optional[Dict[str, Any]] = None
    auto_submit_on_pass: bool = False
    is_published: bool = True


class ExerciseCreate(ExerciseBase):
    order: Optional[int] = None


class ExerciseUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    order: Optional[int] = None
    mode: Optional[str] = None
    theory_content: Optional[str] = None
    instructions_md: Optional[str] = None
    xp_reward: Optional[int] = None
    unlock_rule: Optional[str] = None
    reference_solution_url: Optional[str] = None
    docs_url: Optional[str] = None
    passing_score_pct: Optional[int] = None
    attempts_allowed: Optional[int] = None
    validation_config: Optional[Dict[str, Any]] = None
    auto_submit_on_pass: Optional[bool] = None
    is_published: Optional[bool] = None


class ExerciseInDB(ExerciseBase):
    id: int
    section_id: int
    order: int
    total_tasks: int = 0
    task_ids: List[int] = Field(default_factory=list)
    status: str = "locked"
    model_config = ConfigDict(from_attributes=True)


class ExercisePublicSummary(BaseModel):
    id: int
    section_id: int
    order: int
    title: str
    slug: Optional[str] = None
    mode: str = "code"
    total_tasks: int = 0
    xp_reward: int = 20
    status: str = "locked"
    model_config = ConfigDict(from_attributes=True)


class SectionPublicWithExercises(BaseModel):
    id: int
    track_id: int
    order: int
    title: str
    slug: Optional[str] = None
    badge_url: Optional[str] = None
    status: str = "locked"
    progress_percent: int = 0
    exercises: List[ExercisePublicSummary] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class SectionStudentWithExercises(BaseModel):
    id: int
    track_id: int
    order: int
    title: str
    slug: Optional[str] = None
    badge_url: Optional[str] = None
    exercises: List[ExerciseInDB] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class ExerciseStudent(ExerciseInDB):
    tasks: List[TaskStudent] = Field(default_factory=list)


class TaskEvaluateRequest(BaseModel):
    source_code: str
    language_id: int


class TaskEvaluateResponse(BaseModel):
    passed: bool
    verdict: str
    output: Optional[str] = None
    error: Optional[str] = None
    passed_cases: int
    total_cases: int


class ExerciseSibling(BaseModel):
    id: int
    title: str
    slug: Optional[str] = None
    order: int
    mode: str = "code"
    status: str = "locked"
    model_config = ConfigDict(from_attributes=True)


class ExerciseWorkspaceData(BaseModel):
    id: int
    title: str
    mode: Optional[str] = "code"
    theory_content: Optional[str] = None
    instructions_md: Optional[str] = None
    order: int
    tasks: List[TaskStudent] = Field(default_factory=list)
    files: List[ExerciseFileStudent] = Field(default_factory=list)
    hints: List[HintStudent] = Field(default_factory=list)
    quiz_questions: List[QuizQuestionStudent] = Field(default_factory=list)
    reference_solution_url: Optional[str] = None
    docs_url: Optional[str] = None
    xp_reward: int = 20
    passing_score_pct: int = 70
    attempts_allowed: Optional[int] = None
    validation_config: Optional[Dict[str, Any]] = None
    auto_submit_on_pass: bool = False
    status: str = "unlocked"
    best_score: int = 0
    attempts_count: int = 0
    section_id: int
    section_title: str
    track_id: int
    track_title: str
    language_id: int
    exercises_in_section: List[ExerciseSibling] = Field(default_factory=list)
    sections: List[SectionPublicWithExercises] = Field(default_factory=list)
    total_exercises_in_section: int = 0
    user_xp: int = 0
    current_streak: int = 0
    model_config = ConfigDict(from_attributes=True)


class ExerciseAdmin(ExerciseInDB):
    tasks: List[TaskInDB] = Field(default_factory=list)
    files: List[ExerciseFileInDB] = Field(default_factory=list)
    test_cases: List[ExerciseTestCaseInDB] = Field(default_factory=list)
    hints: List[HintInDB] = Field(default_factory=list)
    quiz_questions: List[QuizQuestionInDB] = Field(default_factory=list)


class SectionBase(BaseModel):
    slug: Optional[str] = None
    title: str
    badge_url: Optional[str] = None


class SectionCreate(SectionBase):
    order: Optional[int] = None


class SectionUpdate(BaseModel):
    slug: Optional[str] = None
    title: Optional[str] = None
    order: Optional[int] = None
    badge_url: Optional[str] = None


class SectionInDB(SectionBase):
    id: int
    track_id: int
    order: int
    model_config = ConfigDict(from_attributes=True)


class TrackBase(BaseModel):
    slug: Optional[str] = None
    title: str
    description: Optional[str] = None
    featured_image_url: Optional[str] = None
    language_id: int
    is_published: Optional[bool] = False


class TrackCreate(TrackBase):
    order: Optional[int] = None


class TrackUpdate(BaseModel):
    slug: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    featured_image_url: Optional[str] = None
    language_id: Optional[int] = None
    order: Optional[int] = None
    is_published: Optional[bool] = None


class TrackInDB(TrackBase):
    id: int
    order: int
    model_config = ConfigDict(from_attributes=True)


class AdminSectionNode(SectionInDB):
    exercises: List[ExerciseInDB] = Field(default_factory=list)


class AdminTrackNode(TrackInDB):
    sections: List[AdminSectionNode] = Field(default_factory=list)


class AdminCurriculumTreeResponse(BaseModel):
    tracks: List[AdminTrackNode] = Field(default_factory=list)


class AdminPublishIssue(BaseModel):
    scope: str
    message: str
    severity: str = "error"
    track_id: Optional[int] = None
    section_id: Optional[int] = None
    exercise_id: Optional[int] = None


class AdminPublishCheckResponse(BaseModel):
    ready: bool = False
    issues: List[AdminPublishIssue] = Field(default_factory=list)
    totals: Dict[str, int] = Field(default_factory=dict)


class AdminExerciseStudioData(BaseModel):
    exercise: ExerciseAdmin
    section: SectionInDB
    track: TrackInDB
    publish_check: AdminPublishCheckResponse


class AdminExerciseStudioUpdate(BaseModel):
    exercise: Optional[ExerciseUpdate] = None
    files: Optional[List[ExerciseFileCreate]] = None
    test_cases: Optional[List[ExerciseTestCaseCreate]] = None
    hints: Optional[List[HintCreate]] = None
    quiz: Optional[QuizPayload] = None


class AdminExerciseValidateRequest(BaseModel):
    files: Optional[List[AdminValidationFile]] = None
    use_solution: bool = True
    include_hidden: bool = True


class AdminExerciseValidationResponse(BaseModel):
    passed: bool
    verdict: str
    passed_cases: int = 0
    total_cases: int = 0
    visible_results: List[Dict[str, Any]] = Field(default_factory=list)
    judge_result: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


class AdminEngineHealthResponse(BaseModel):
    content_health: str = "unknown"
    judge_health: str = "unknown"
    leaderboard_health: str = "ready"
    recent_attempts: List[Dict[str, Any]] = Field(default_factory=list)


class TrackTree(TrackInDB):
    sections: List[SectionPublicWithExercises] = Field(default_factory=list)
    learner_count: int = 0
    progress_percent: int = 0
    completed_exercises: int = 0
    total_exercises: int = 0
    status: str = "not_started"


class TrackDetailTree(TrackInDB):
    sections: List[SectionStudentWithExercises] = Field(default_factory=list)
    learner_count: int = 0


class TrackLeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    avatar: Optional[str] = None
    completed_tasks: int = 0
    completed_exercises: int = 0
    xp: int = 0


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    display_name: str
    username: str
    avatar_url: Optional[str] = None
    total_xp: int = 0
    track_xp: Optional[int] = None
    completed_exercises: int = 0
    badges_count: int = 0
    current_streak: int = 0


class LeaderboardResponse(BaseModel):
    entries: List[LeaderboardEntry] = Field(default_factory=list)
    current_user_rank: Optional[LeaderboardEntry] = None
    page: int = 1
    page_size: int = 20
    total: int = 0
    time_range: str = "all_time"


class TrackStudent(TrackInDB):
    sections: List[SectionInDB] = Field(default_factory=list)


class TrackAdmin(TrackInDB):
    sections: List[SectionInDB] = Field(default_factory=list)


class ReorderRequest(BaseModel):
    item_ids: List[int] = Field(min_length=1)


class SubmittedFile(BaseModel):
    file_path: str
    content: str
    language: Optional[str] = None
    is_entrypoint: bool = False


class ExerciseRunRequest(BaseModel):
    files: List[SubmittedFile] = Field(default_factory=list)
    source_code: Optional[str] = None
    language_id: Optional[int] = None


class ExerciseRunResponse(BaseModel):
    attempt_id: int
    status: str
    mode: str
    passed: bool
    verdict: str
    output: Optional[str] = None
    error: Optional[str] = None
    passed_cases: int = 0
    total_cases: int = 0
    visible_results: List[Dict[str, Any]] = Field(default_factory=list)
    judge_result: Optional[Dict[str, Any]] = None


class ExerciseSubmitRequest(BaseModel):
    attempt_id: Optional[int] = None
    files: List[SubmittedFile] = Field(default_factory=list)


class ExerciseSubmitResponse(BaseModel):
    attempt_id: int
    status: str
    xp_awarded: int = 0
    progress: Dict[str, Any] = Field(default_factory=dict)
    badges_awarded: List[Dict[str, Any]] = Field(default_factory=list)


class TheoryCompleteRequest(BaseModel):
    note: Optional[str] = None


class HintUsageResponse(BaseModel):
    hint: HintStudent
    used_at: datetime


class ReferenceAccessRequest(BaseModel):
    reference_url: Optional[str] = None


class ReferenceAccessResponse(BaseModel):
    reference_url: str
    accessed_at: datetime


class QuizStartResponse(BaseModel):
    attempt_id: int
    exercise_id: int
    questions: List[QuizQuestionStudent] = Field(default_factory=list)
    passing_score_pct: int = 70
    attempts_allowed: Optional[int] = None


class QuizAnswerRequest(BaseModel):
    attempt_id: int
    question_id: int
    option_id: int


class QuizFinishRequest(BaseModel):
    attempt_id: int
    answers: Dict[str, int] = Field(default_factory=dict)


class QuizFinishResponse(BaseModel):
    attempt_id: int
    score: int
    total_questions: int
    passed: bool
    xp_awarded: int = 0
    progress: Dict[str, Any] = Field(default_factory=dict)
    badges_awarded: List[Dict[str, Any]] = Field(default_factory=list)


class XpEventResponse(BaseModel):
    id: int
    user_id: int
    track_id: Optional[int] = None
    section_id: Optional[int] = None
    exercise_id: Optional[int] = None
    source_type: str
    source_id: str
    points: int
    reason: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BadgeCreate(BaseModel):
    badge_key: str
    title: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    scope: str = "global"
    rule_type: str
    rule_config: Optional[Dict[str, Any]] = None
    xp_bonus: int = 0
    is_active: bool = True


class BadgeUpdate(BaseModel):
    badge_key: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    icon_url: Optional[str] = None
    scope: Optional[str] = None
    rule_type: Optional[str] = None
    rule_config: Optional[Dict[str, Any]] = None
    xp_bonus: Optional[int] = None
    is_active: Optional[bool] = None


class BadgeResponse(BadgeCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class UserBadgeResponse(BaseModel):
    id: int
    user_id: int
    badge_id: int
    track_id: Optional[int] = None
    section_id: Optional[int] = None
    awarded_at: datetime
    badge: Optional[BadgeResponse] = None
    model_config = ConfigDict(from_attributes=True)


class UserProgressResponse(BaseModel):
    total_xp: int = 0
    completed_exercises: int = 0
    completed_tracks: int = 0
    current_streak: int = 0
    tracks: List[Dict[str, Any]] = Field(default_factory=list)
    badges: List[UserBadgeResponse] = Field(default_factory=list)


class AdminDashboardStats(BaseModel):
    total_users: int = 0
    active_learners: int = 0
    exercises_solved: int = 0
    quiz_completions: int = 0
    pending_content: int = 0
    leaderboard_health: str = "ready"
    judge_health: str = "unknown"
