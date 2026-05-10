from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

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

class ExerciseBase(BaseModel):
    title: str
    slug: Optional[str] = None

class ExerciseCreate(ExerciseBase):
    order: Optional[int] = None

class ExerciseUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    order: Optional[int] = None

class ExerciseInDB(ExerciseBase):
    id: int
    section_id: int
    order: int
    mode: Optional[str] = "task"
    theory_content: Optional[str] = None
    total_tasks: int = 0
    task_ids: List[int] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class ExercisePublicSummary(ExerciseBase):
    id: int
    section_id: int
    order: int
    total_tasks: int = 0
    model_config = ConfigDict(from_attributes=True)


class SectionPublicWithExercises(BaseModel):
    id: int
    track_id: int
    order: int
    title: str
    badge_url: Optional[str] = None
    exercises: List[ExercisePublicSummary] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class SectionStudentWithExercises(BaseModel):
    id: int
    track_id: int
    order: int
    title: str
    badge_url: Optional[str] = None
    exercises: List[ExerciseInDB] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

class ExerciseStudent(ExerciseInDB):
    tasks: List[TaskStudent] = Field(default_factory=list)


# ── Workspace (student-facing IDE page) ──────────────────────────────────

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
    order: int
    model_config = ConfigDict(from_attributes=True)

class ExerciseWorkspaceData(BaseModel):
    """All data the workspace page needs in a single response."""
    # Exercise core
    id: int
    title: str
    mode: Optional[str] = "task"
    theory_content: Optional[str] = None
    order: int

    # Tasks / levels
    tasks: List[TaskStudent] = Field(default_factory=list)

    # Section context
    section_id: int
    section_title: str

    # Track context
    track_id: int
    track_title: str
    language_id: int

    # Sibling exercises in same section (for ToC + Back/Next)
    exercises_in_section: List[ExerciseSibling] = Field(default_factory=list)
    total_exercises_in_section: int = 0

    model_config = ConfigDict(from_attributes=True)

class ExerciseAdmin(ExerciseInDB):
    tasks: List[TaskInDB] = Field(default_factory=list)

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


class TrackTree(TrackInDB):
    sections: List[SectionPublicWithExercises] = Field(default_factory=list)
    learner_count: int = 0


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

class TrackStudent(TrackInDB):
    sections: List[SectionInDB] = Field(default_factory=list)

class TrackAdmin(TrackInDB):
    sections: List[SectionInDB] = Field(default_factory=list)

class ReorderRequest(BaseModel):
    item_ids: List[int] = Field(min_length=1)
