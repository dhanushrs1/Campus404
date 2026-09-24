from __future__ import annotations

import asyncio

from sqlalchemy import select

from auth.database import AsyncSessionLocal
from curriculum import models


async def seed_python_core() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(models.Track).where(models.Track.slug == "python-core"))
        if existing:
            print("Python Core seed already exists.")
            return

        track = models.Track(
            title="Python Core",
            slug="python-core",
            description="Beginner-first Python practice across code, files, Git theory, web preview, and quiz review.",
            language_id=71,
            order=1,
            is_published=True,
        )
        db.add(track)
        await db.flush()

        section = models.Section(track_id=track.id, title="Core Foundations", slug="core-foundations", order=1)
        db.add(section)
        await db.flush()

        await _code_exercise(db, section.id)
        await _multi_file_exercise(db, section.id)
        await _theory_exercise(db, section.id)
        await _frontend_preview_exercise(db, section.id)
        await _quiz_exercise(db, section.id)
        await _badges(db)

        await db.commit()
        print("Seeded Python Core track.")


async def _code_exercise(db, section_id: int) -> None:
    exercise = models.Exercise(
        section_id=section_id,
        title="Print a Greeting",
        slug="print-a-greeting",
        order=1,
        mode="code",
        instructions_md="Print exactly `Hello, Campus404!`.",
        xp_reward=20,
    )
    db.add(exercise)
    await db.flush()
    db.add(models.ExerciseFile(exercise_id=exercise.id, file_path="main.py", language="python", starter_code='print("Hello")\n', solution_code='print("Hello, Campus404!")\n', is_entrypoint=True, order=1))
    db.add(models.ExerciseTestCase(exercise_id=exercise.id, label="Greeting output", stdin="", expected_outputs=["Hello, Campus404!"], match_mode="normalize", is_hidden=False, order=1))
    db.add(models.Hint(exercise_id=exercise.id, content_md="Update the string inside `print(...)`.", order=1, unlock_rule="after_first_run", penalty_xp=2))


async def _multi_file_exercise(db, section_id: int) -> None:
    exercise = models.Exercise(
        section_id=section_id,
        title="Use a Helper Module",
        slug="use-a-helper-module",
        order=2,
        mode="multi_file_code",
        instructions_md="Complete `helpers.py` so `main.py` prints the doubled number.",
        xp_reward=30,
    )
    db.add(exercise)
    await db.flush()
    db.add(models.ExerciseFile(exercise_id=exercise.id, file_path="main.py", language="python", starter_code="from helpers import double\n\nprint(double(6))\n", solution_code="from helpers import double\n\nprint(double(6))\n", is_entrypoint=True, is_editable=False, order=1))
    db.add(models.ExerciseFile(exercise_id=exercise.id, file_path="helpers.py", language="python", starter_code="def double(value):\n    return value\n", solution_code="def double(value):\n    return value * 2\n", is_entrypoint=False, is_editable=True, order=2))
    db.add(models.ExerciseTestCase(exercise_id=exercise.id, label="Doubles 6", stdin="", expected_outputs=["12"], match_mode="normalize", is_hidden=False, order=1))


async def _theory_exercise(db, section_id: int) -> None:
    exercise = models.Exercise(
        section_id=section_id,
        title="Git Commit Checkpoint",
        slug="git-commit-checkpoint",
        order=3,
        mode="theory",
        theory_content="<h2>Make a checkpoint</h2><p>Run <code>git status</code>, review changes, and create a clear commit message.</p>",
        instructions_md="Try the Git workflow locally, then mark this lesson complete.",
        reference_solution_url="https://docs.github.com/en/get-started/using-git/about-git",
        xp_reward=15,
    )
    db.add(exercise)


async def _frontend_preview_exercise(db, section_id: int) -> None:
    exercise = models.Exercise(
        section_id=section_id,
        title="Build a Profile Card",
        slug="build-a-profile-card",
        order=4,
        mode="frontend_preview",
        instructions_md="Create a small profile card with a heading, paragraph, and blue styling.",
        validation_config={
            "required_files": ["index.html", "styles.css"],
            "required_selectors": [".profile-card", "h1"],
            "required_text": ["Campus404"],
            "css_contains": ["background"],
        },
        xp_reward=35,
    )
    db.add(exercise)
    await db.flush()
    db.add(models.ExerciseFile(exercise_id=exercise.id, file_path="index.html", language="html", starter_code='<main class="profile-card">\n  <h1>Campus404</h1>\n  <p>Learning by fixing errors.</p>\n</main>\n', solution_code='<main class="profile-card">\n  <h1>Campus404</h1>\n  <p>Learning by fixing errors.</p>\n</main>\n', is_entrypoint=True, order=1))
    db.add(models.ExerciseFile(exercise_id=exercise.id, file_path="styles.css", language="css", starter_code=".profile-card {\n  padding: 24px;\n}\n", solution_code=".profile-card {\n  padding: 24px;\n  background: #dff0ff;\n}\n", order=2))
    db.add(models.ExerciseFile(exercise_id=exercise.id, file_path="script.js", language="javascript", starter_code="", solution_code="", order=3))


async def _quiz_exercise(db, section_id: int) -> None:
    exercise = models.Exercise(
        section_id=section_id,
        title="Python Core Quiz",
        slug="python-core-quiz",
        order=5,
        mode="quiz",
        instructions_md="Pass the final quiz to complete the section.",
        xp_reward=40,
        passing_score_pct=70,
        attempts_allowed=3,
    )
    db.add(exercise)
    await db.flush()
    question = models.QuizQuestion(exercise_id=exercise.id, question_text="What does `print()` do in Python?", question_type="multiple_choice", order=1)
    db.add(question)
    await db.flush()
    db.add(models.QuizOption(question_id=question.id, option_text="Displays output", is_correct=True, order=1))
    db.add(models.QuizOption(question_id=question.id, option_text="Creates a Git commit", is_correct=False, order=2))
    db.add(models.QuizOption(question_id=question.id, option_text="Installs a package", is_correct=False, order=3))


async def _badges(db) -> None:
    db.add(models.Badge(badge_key="first_fix", title="First Fix", description="Completed your first exercise.", scope="global", rule_type="first_exercise_completed", xp_bonus=5, is_active=True))
    db.add(models.Badge(badge_key="python_section_done", title="Python Section Complete", description="Completed a Python Core section.", scope="section", rule_type="complete_section", xp_bonus=10, is_active=True))


if __name__ == "__main__":
    asyncio.run(seed_python_core())
