from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, Boolean, DateTime
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

class Exercise(Base):
    __tablename__ = "exercises"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    slug = Column(String(256), nullable=True)
    title = Column(String(256), nullable=False)
    order = Column(Integer, nullable=False)
    mode = Column(String(50), default="task", nullable=False)
    theory_content = Column(Text, nullable=True)
    
    section = relationship("Section", back_populates="exercises")
    tasks = relationship("Task", back_populates="exercise", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="exercise", cascade="all, delete-orphan")

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    order = Column(Integer, nullable=False)
    
    exercise = relationship("Exercise", back_populates="quiz_questions")
    options = relationship("QuizOption", back_populates="question", cascade="all, delete-orphan")

class QuizOption(Base):
    __tablename__ = "quiz_options"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("quiz_questions.id"), nullable=False)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)
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

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="completed")
    completed_at = Column(DateTime(timezone=True), server_default=func.now())

