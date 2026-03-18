"""
progress/router.py — Campus404
Public API for user progress, workspace execution, and module progression gates.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from authentications.security import ALGORITHM, SECRET_KEY
from database import get_db
from sandbox.client import JudgeClient
from sandbox.schemas import CodeSubmission
import curriculum.models as cm
import models as user_models

router = APIRouter()

MODULE_UNLOCK_THRESHOLD_PERCENT = 40.0
USE_JUDGE0_MOCK = os.getenv("USE_JUDGE0_MOCK", "True").lower() == "true"
JUDGE0_URL = os.getenv("JUDGE0_URL", "http://judge0-server:2358")
judge_client = JudgeClient(base_url=JUDGE0_URL, use_mock=USE_JUDGE0_MOCK)
HTML_TAG_RE = re.compile(r"<[^>]+>")


# ── Auth helper ──────────────────────────────────────────────────────────────
def _get_auth_context(request: Request, db: Session) -> Tuple[user_models.User, str]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")

    raw_token = auth[7:]
    try:
        payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token.")

    user = db.query(user_models.User).filter(user_models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return user, raw_token


def _get_current_user(request: Request, db: Session) -> user_models.User:
    user, _ = _get_auth_context(request, db)
    return user


# ── Schemas ──────────────────────────────────────────────────────────────────
class BadgeOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    image_url: Optional[str]
    module_id: Optional[int]
    earned_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ChallengeProgressOut(BaseModel):
    challenge_id: int
    level_number: int
    challenge_type: str
    display_title: str
    xp_reward: int
    is_completed: bool
    is_locked: bool


class ModuleProgressOut(BaseModel):
    module_id: int
    unique_id: str
    slug: str
    title: str
    description: Optional[str]
    banner_image_path: Optional[str]
    banner_url: Optional[str]
    order_index: int
    total_xp: int
    earned_xp: int
    progress_percent: float
    unlock_threshold_percent: float
    unlock_eligible: bool
    is_locked: bool
    is_completed: bool
    challenge_count: int
    completed_challenges: int
    badge: Optional[BadgeOut]
    challenges: List[ChallengeProgressOut]


class LabProgressOut(BaseModel):
    lab_id: int
    slug: str
    title: str
    description: Optional[str]
    banner_url: Optional[str]
    hero_image_url: Optional[str]
    language_id: int
    total_xp: int
    earned_xp: int
    modules: List[ModuleProgressOut]


class UserStatsOut(BaseModel):
    total_xp: int
    current_streak: int
    longest_streak: int
    completed_challenges: int
    badges_earned: int
    avatar_url: Optional[str]
    username: str
    first_name: Optional[str]
    last_name: Optional[str]


class ModuleGateOut(BaseModel):
    module_id: int
    total_available_xp: int
    earned_xp: int
    progress_percent: float
    unlock_threshold_percent: float
    unlock_eligible: bool
    standard_levels_completed: bool
    exam_required: bool
    exam_completed: bool


class DynamicExamQuestionOut(BaseModel):
    id: str
    level_reference: int
    prompt: str
    max_points: int


class ModuleExamBlueprintOut(BaseModel):
    module_id: int
    generated_at: datetime
    question_count: int
    max_xp: int
    questions: List[DynamicExamQuestionOut]


class JudgeStatusOut(BaseModel):
    id: int
    description: str


class SecureEnvelopeOut(BaseModel):
    algorithm: str
    iv: str
    ciphertext: str


class WorkspaceRunIn(BaseModel):
    source_code: str = Field(..., min_length=1, max_length=50000)
    language_id: int = Field(..., ge=0)
    expected_output: Optional[str] = Field(None, max_length=10000)


class ExamMetricsIn(BaseModel):
    correct_answers: int = Field(0, ge=0)
    total_questions: int = Field(0, ge=0)
    optimization_score: float = Field(0.0, ge=0.0, le=1.0)


class WorkspaceSubmitIn(WorkspaceRunIn):
    exam_metrics: Optional[ExamMetricsIn] = None


class WorkspaceRunOut(BaseModel):
    encrypted: bool
    envelope: SecureEnvelopeOut
    status: JudgeStatusOut
    passed: bool
    attempt_number: int


class WorkspaceSubmitOut(BaseModel):
    encrypted: bool
    envelope: SecureEnvelopeOut
    status: JudgeStatusOut
    passed: bool
    attempt_number: int
    xp_gained: int
    total_xp: int
    module_gate: ModuleGateOut
    badge_earned: Optional[BadgeOut]


# ── Helpers ──────────────────────────────────────────────────────────────────
def _build_badge_url(badge: cm.Badge, base_url: str) -> Optional[str]:
    if badge.image_url:
        return badge.image_url
    if badge.image_path:
        return f"{base_url}/uploads/{badge.image_path}"
    return None


def _get_completion_map(db: Session, user_id: int) -> Dict[int, cm.ChallengeCompletion]:
    rows = db.query(cm.ChallengeCompletion).filter(cm.ChallengeCompletion.user_id == user_id).all()
    return {row.challenge_id: row for row in rows}


def _published_levels(module: cm.Module) -> List[cm.Challenge]:
    return sorted(
        [challenge for challenge in module.challenges if challenge.is_published],
        key=lambda challenge: challenge.level_number,
    )


def _module_gate_summary(module: cm.Module, completion_map: Dict[int, cm.ChallengeCompletion]) -> dict:
    levels = _published_levels(module)
    standard_levels = [lvl for lvl in levels if lvl.challenge_type != cm.CHALLENGE_TYPE_EXAM]
    exam_level = next((lvl for lvl in levels if lvl.challenge_type == cm.CHALLENGE_TYPE_EXAM), None)

    total_available_xp = int(sum(lvl.xp_reward for lvl in levels))
    earned_xp = int(
        sum(int(completion_map[lvl.id].xp_awarded) for lvl in levels if lvl.id in completion_map)
    )

    progress_percent = 0.0
    if total_available_xp > 0:
        progress_percent = round((earned_xp / total_available_xp) * 100.0, 2)

    standard_levels_completed = all(lvl.id in completion_map for lvl in standard_levels) if standard_levels else True
    exam_required = exam_level is not None
    exam_completed = (exam_level.id in completion_map) if exam_level else True
    module_completed = standard_levels_completed and exam_completed

    if total_available_xp > 0:
        meets_threshold = progress_percent >= MODULE_UNLOCK_THRESHOLD_PERCENT
    else:
        meets_threshold = module_completed

    unlock_eligible = bool(meets_threshold and module_completed)

    return {
        "levels": levels,
        "standard_levels": standard_levels,
        "exam_level": exam_level,
        "total_available_xp": total_available_xp,
        "earned_xp": earned_xp,
        "progress_percent": progress_percent,
        "standard_levels_completed": standard_levels_completed,
        "exam_required": exam_required,
        "exam_completed": exam_completed,
        "module_completed": module_completed,
        "unlock_eligible": unlock_eligible,
    }


def _module_is_locked(module: cm.Module, completion_map: Dict[int, cm.ChallengeCompletion]) -> bool:
    modules_in_lab = sorted(module.lab.modules, key=lambda mod: mod.order_index)
    previous_gate_open = True

    for mod in modules_in_lab:
        if mod.id == module.id:
            return not previous_gate_open

        summary = _module_gate_summary(mod, completion_map)
        previous_gate_open = previous_gate_open and summary["unlock_eligible"]

    return True


def _challenge_is_locked(
    challenge: cm.Challenge,
    module_is_locked: bool,
    completion_map: Dict[int, cm.ChallengeCompletion],
) -> bool:
    if module_is_locked:
        return True

    levels = _published_levels(challenge.module)
    standard_levels = [lvl for lvl in levels if lvl.challenge_type != cm.CHALLENGE_TYPE_EXAM]
    standard_levels_completed = all(lvl.id in completion_map for lvl in standard_levels) if standard_levels else True

    previous_standard_done = True
    for lvl in levels:
        if lvl.challenge_type == cm.CHALLENGE_TYPE_EXAM:
            is_locked = not standard_levels_completed
        else:
            is_locked = not previous_standard_done
            if lvl.id not in completion_map:
                previous_standard_done = False

        if lvl.id == challenge.id:
            return is_locked

    return True


def _next_attempt_number(db: Session, user_id: int, challenge_id: int) -> int:
    max_attempt = (
        db.query(func.coalesce(func.max(cm.ChallengeAttempt.attempt_number), 0))
        .filter(
            cm.ChallengeAttempt.user_id == user_id,
            cm.ChallengeAttempt.challenge_id == challenge_id,
        )
        .scalar()
    )
    return int(max_attempt or 0) + 1


def _encrypt_payload_for_client(payload: dict, raw_token: str) -> SecureEnvelopeOut:
    key = hashlib.sha256(raw_token.encode("utf-8")).digest()
    iv = os.urandom(12)
    aes = AESGCM(key)
    ciphertext = aes.encrypt(iv, json.dumps(payload).encode("utf-8"), None)
    return SecureEnvelopeOut(
        algorithm="AES-GCM",
        iv=base64.b64encode(iv).decode("utf-8"),
        ciphertext=base64.b64encode(ciphertext).decode("utf-8"),
    )


def _judge_result_payload(result, passed: bool) -> dict:
    return {
        "stdout": result.stdout or "",
        "stderr": result.stderr or "",
        "compile_output": result.compile_output or "",
        "time": result.time,
        "memory": result.memory,
        "status": {
            "id": result.status.id,
            "description": result.status.description,
        },
        "passed": passed,
    }


async def _execute_submission(challenge: cm.Challenge, payload: WorkspaceRunIn):
    expected_output = challenge.expected_output
    if expected_output is None:
        expected_output = payload.expected_output

    submission = CodeSubmission(
        source_code=payload.source_code,
        language_id=payload.language_id,
        expected_output=expected_output,
    )
    return await judge_client.submit_code(submission)


def _determine_passed(challenge: cm.Challenge, execution_result) -> bool:
    if execution_result.status.id != 3:
        return False

    if challenge.expected_output is None:
        return not bool(execution_result.stderr) and not bool(execution_result.compile_output)

    expected = (challenge.expected_output or "").strip()
    actual = (execution_result.stdout or "").strip()
    return actual == expected


def _calculate_awarded_xp(
    challenge: cm.Challenge,
    passed: bool,
    attempt_number: int,
    exam_metrics: Optional[ExamMetricsIn],
) -> int:
    if not passed:
        return 0

    if challenge.challenge_type != cm.CHALLENGE_TYPE_EXAM:
        return int(challenge.xp_reward)

    max_exam_xp = int(min(100, challenge.xp_reward))
    if max_exam_xp <= 0:
        return 0

    if exam_metrics and exam_metrics.total_questions > 0:
        correctness_ratio = min(1.0, exam_metrics.correct_answers / exam_metrics.total_questions)
    else:
        correctness_ratio = 1.0

    optimization_bonus = 0.0
    if exam_metrics:
        optimization_bonus = exam_metrics.optimization_score * 0.2 * max_exam_xp

    attempt_penalty_factor = max(0.5, 1.0 - (0.1 * max(attempt_number - 1, 0)))
    raw_xp = ((correctness_ratio * max_exam_xp) + optimization_bonus) * attempt_penalty_factor
    return max(0, min(max_exam_xp, int(round(raw_xp))))


def _to_badge_out(badge: cm.Badge, base_url: str, earned_at: Optional[datetime] = None) -> BadgeOut:
    return BadgeOut(
        id=badge.id,
        name=badge.name,
        description=badge.description,
        image_url=_build_badge_url(badge, base_url),
        module_id=badge.module_id,
        earned_at=earned_at,
    )


def _award_module_badge_if_eligible(
    db: Session,
    user_id: int,
    module: cm.Module,
    unlock_eligible: bool,
    base_url: str,
) -> Optional[BadgeOut]:
    if not unlock_eligible or not module.badge:
        return None

    existing = db.query(cm.UserBadge).filter(
        cm.UserBadge.user_id == user_id,
        cm.UserBadge.badge_id == module.badge.id,
    ).first()
    if existing:
        return None

    earned = cm.UserBadge(user_id=user_id, badge_id=module.badge.id)
    db.add(earned)
    return _to_badge_out(module.badge, base_url)


def _to_module_gate_out(module_id: int, summary: dict) -> ModuleGateOut:
    return ModuleGateOut(
        module_id=module_id,
        total_available_xp=summary["total_available_xp"],
        earned_xp=summary["earned_xp"],
        progress_percent=summary["progress_percent"],
        unlock_threshold_percent=MODULE_UNLOCK_THRESHOLD_PERCENT,
        unlock_eligible=summary["unlock_eligible"],
        standard_levels_completed=summary["standard_levels_completed"],
        exam_required=summary["exam_required"],
        exam_completed=summary["exam_completed"],
    )


def _strip_html_excerpt(content_html: str, limit: int = 170) -> str:
    text = HTML_TAG_RE.sub(" ", content_html or "")
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit].rstrip()}..."


def _build_dynamic_exam_blueprint(module: cm.Module) -> ModuleExamBlueprintOut:
    standard_levels = [
        lvl for lvl in _published_levels(module)
        if lvl.challenge_type != cm.CHALLENGE_TYPE_EXAM
    ]

    if not standard_levels:
        return ModuleExamBlueprintOut(
            module_id=module.id,
            generated_at=datetime.utcnow(),
            question_count=0,
            max_xp=100,
            questions=[],
        )

    question_count = min(5, len(standard_levels))
    selected_levels = standard_levels[:question_count]
    base_points = 100 // question_count
    remainder = 100 % question_count

    questions: List[DynamicExamQuestionOut] = []
    for index, level in enumerate(selected_levels, start=1):
        display_title = level.custom_title or f"Level {level.level_number}"
        context = _strip_html_excerpt(level.content_html)
        points = base_points + (1 if index <= remainder else 0)

        questions.append(
            DynamicExamQuestionOut(
                id=f"q-{module.id}-{level.id}",
                level_reference=level.level_number,
                prompt=(
                    f"Question {index}: Write a solution that demonstrates the core concept from "
                    f"{display_title}. Context: {context}"
                ),
                max_points=points,
            )
        )

    return ModuleExamBlueprintOut(
        module_id=module.id,
        generated_at=datetime.utcnow(),
        question_count=len(questions),
        max_xp=100,
        questions=questions,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("/me/stats", response_model=UserStatsOut)
def get_my_stats(request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)

    completed = db.query(func.count(cm.ChallengeCompletion.id)).filter(
        cm.ChallengeCompletion.user_id == current_user.id
    ).scalar()
    badges = db.query(func.count(cm.UserBadge.id)).filter(
        cm.UserBadge.user_id == current_user.id
    ).scalar()

    return UserStatsOut(
        total_xp=current_user.total_xp,
        current_streak=current_user.current_streak,
        longest_streak=current_user.longest_streak,
        completed_challenges=int(completed or 0),
        badges_earned=int(badges or 0),
        avatar_url=current_user.avatar_url,
        username=current_user.username,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
    )


@router.get("/me/badges", response_model=List[BadgeOut])
def get_my_badges(request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)
    base_url = str(request.base_url).rstrip("/")

    rows = db.query(cm.UserBadge, cm.Badge).join(
        cm.Badge, cm.UserBadge.badge_id == cm.Badge.id
    ).filter(cm.UserBadge.user_id == current_user.id).all()

    return [_to_badge_out(badge, base_url, earned_at=user_badge.earned_at) for user_badge, badge in rows]


@router.get("/labs/{slug}/progress", response_model=LabProgressOut)
def get_lab_progress(slug: str, request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)

    lab = db.query(cm.Lab).filter(cm.Lab.slug == slug, cm.Lab.is_published == True).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")

    base_url = str(request.base_url).rstrip("/")
    lab_banner_url = f"{base_url}/uploads/{lab.banner_image_path}" if lab.banner_image_path else None

    completion_map = _get_completion_map(db, current_user.id)

    total_xp = 0
    earned_xp = 0
    previous_gate_open = True
    modules_out: List[ModuleProgressOut] = []

    modules_in_lab = sorted(lab.modules, key=lambda module: module.order_index)
    for module in modules_in_lab:
        summary = _module_gate_summary(module, completion_map)
        levels = summary["levels"]

        module_total_xp = summary["total_available_xp"]
        module_earned_xp = summary["earned_xp"]
        total_xp += module_total_xp
        earned_xp += module_earned_xp

        is_module_locked = not previous_gate_open

        badge_out = None
        if module.badge:
            earned_at = None
            earned_badge = db.query(cm.UserBadge).filter(
                cm.UserBadge.user_id == current_user.id,
                cm.UserBadge.badge_id == module.badge.id,
            ).first()
            if earned_badge:
                earned_at = earned_badge.earned_at
            badge_out = _to_badge_out(module.badge, base_url, earned_at=earned_at)

        previous_standard_done = True
        challenge_progress: List[ChallengeProgressOut] = []
        for level in levels:
            is_done = level.id in completion_map

            if level.challenge_type == cm.CHALLENGE_TYPE_EXAM:
                is_locked = is_module_locked or not summary["standard_levels_completed"]
                title = level.custom_title or "Module Exam"
            else:
                is_locked = is_module_locked or not previous_standard_done
                title = level.custom_title or f"Level {level.level_number}"
                if not is_done:
                    previous_standard_done = False

            challenge_progress.append(
                ChallengeProgressOut(
                    challenge_id=level.id,
                    level_number=level.level_number,
                    challenge_type=level.challenge_type,
                    display_title=title,
                    xp_reward=level.xp_reward,
                    is_completed=is_done,
                    is_locked=is_locked,
                )
            )

        module_banner_url = f"{base_url}/uploads/{module.banner_image_path}" if module.banner_image_path else None

        modules_out.append(
            ModuleProgressOut(
                module_id=module.id,
                unique_id=module.unique_id,
                slug=module.slug,
                title=module.title,
                description=module.description,
                banner_image_path=module.banner_image_path,
                banner_url=module_banner_url,
                order_index=module.order_index,
                total_xp=module_total_xp,
                earned_xp=module_earned_xp,
                progress_percent=summary["progress_percent"],
                unlock_threshold_percent=MODULE_UNLOCK_THRESHOLD_PERCENT,
                unlock_eligible=summary["unlock_eligible"],
                is_locked=is_module_locked,
                is_completed=summary["module_completed"],
                challenge_count=len(levels),
                completed_challenges=len([lvl for lvl in levels if lvl.id in completion_map]),
                badge=badge_out,
                challenges=challenge_progress,
            )
        )

        previous_gate_open = previous_gate_open and summary["unlock_eligible"]

    return LabProgressOut(
        lab_id=lab.id,
        slug=lab.slug,
        title=lab.title,
        description=lab.description,
        banner_url=lab_banner_url,
        hero_image_url=lab.hero_image_url,
        language_id=lab.language_id,
        total_xp=total_xp,
        earned_xp=earned_xp,
        modules=modules_out,
    )


@router.get("/modules/{module_id}/gate", response_model=ModuleGateOut)
def get_module_gate(module_id: int, request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)

    module = db.query(cm.Module).filter(cm.Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    completion_map = _get_completion_map(db, current_user.id)
    summary = _module_gate_summary(module, completion_map)
    return _to_module_gate_out(module_id, summary)


@router.get("/modules/{module_id}/exam/blueprint", response_model=ModuleExamBlueprintOut)
def get_dynamic_module_exam(module_id: int, request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)

    module = db.query(cm.Module).filter(cm.Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    completion_map = _get_completion_map(db, current_user.id)
    summary = _module_gate_summary(module, completion_map)

    if not summary["exam_required"]:
        raise HTTPException(status_code=404, detail="This module does not have a final exam level.")

    if not summary["standard_levels_completed"]:
        raise HTTPException(status_code=403, detail="Complete all standard levels before accessing the final exam.")

    return _build_dynamic_exam_blueprint(module)


@router.post("/challenges/{challenge_id}/complete")
def complete_challenge(challenge_id: int, request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)
    base_url = str(request.base_url).rstrip("/")

    challenge = db.query(cm.Challenge).filter(
        cm.Challenge.id == challenge_id,
        cm.Challenge.is_published == True,
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    completion_map = _get_completion_map(db, current_user.id)
    module_locked = _module_is_locked(challenge.module, completion_map)
    if _challenge_is_locked(challenge, module_locked, completion_map):
        raise HTTPException(status_code=403, detail="This level is still locked.")

    existing = completion_map.get(challenge_id)
    xp_gained = 0
    badge_earned = None

    if not existing:
        xp_awarded = int(challenge.xp_reward)

        completion = cm.ChallengeCompletion(
            user_id=current_user.id,
            challenge_id=challenge_id,
            xp_awarded=xp_awarded,
        )
        db.add(completion)

        attempt_number = _next_attempt_number(db, current_user.id, challenge_id)
        db.add(
            cm.ChallengeAttempt(
                user_id=current_user.id,
                challenge_id=challenge_id,
                attempt_number=attempt_number,
                status_id=3,
                is_passed=True,
                xp_awarded=xp_awarded,
            )
        )

        current_user.total_xp = int(current_user.total_xp or 0) + xp_awarded
        xp_gained = xp_awarded

        completion_map[challenge_id] = completion
        summary = _module_gate_summary(challenge.module, completion_map)
        badge_earned = _award_module_badge_if_eligible(
            db,
            current_user.id,
            challenge.module,
            summary["unlock_eligible"],
            base_url,
        )

        db.commit()
        db.refresh(current_user)
    else:
        summary = _module_gate_summary(challenge.module, completion_map)

    return {
        "xp_gained": xp_gained,
        "total_xp": int(current_user.total_xp or 0),
        "module_gate": _to_module_gate_out(challenge.module_id, summary).model_dump(),
        "badge_earned": badge_earned.model_dump() if badge_earned else None,
    }


@router.post("/workspace/levels/{challenge_id}/run", response_model=WorkspaceRunOut)
async def run_level_code(
    challenge_id: int,
    payload: WorkspaceRunIn,
    request: Request,
    db: Session = Depends(get_db),
):
    current_user, raw_token = _get_auth_context(request, db)

    challenge = db.query(cm.Challenge).filter(
        cm.Challenge.id == challenge_id,
        cm.Challenge.is_published == True,
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Level not found.")

    completion_map = _get_completion_map(db, current_user.id)
    module_locked = _module_is_locked(challenge.module, completion_map)
    if _challenge_is_locked(challenge, module_locked, completion_map):
        raise HTTPException(status_code=403, detail="This level is still locked.")

    result = await _execute_submission(challenge, payload)
    passed = _determine_passed(challenge, result)
    attempt_number = _next_attempt_number(db, current_user.id, challenge.id)

    db.add(
        cm.ChallengeAttempt(
            user_id=current_user.id,
            challenge_id=challenge.id,
            attempt_number=attempt_number,
            status_id=result.status.id,
            is_passed=passed,
            xp_awarded=0,
        )
    )
    db.commit()

    envelope = _encrypt_payload_for_client(_judge_result_payload(result, passed), raw_token)

    return WorkspaceRunOut(
        encrypted=True,
        envelope=envelope,
        status=JudgeStatusOut(id=result.status.id, description=result.status.description),
        passed=passed,
        attempt_number=attempt_number,
    )


@router.post("/workspace/levels/{challenge_id}/submit", response_model=WorkspaceSubmitOut)
async def submit_level_code(
    challenge_id: int,
    payload: WorkspaceSubmitIn,
    request: Request,
    db: Session = Depends(get_db),
):
    current_user, raw_token = _get_auth_context(request, db)
    base_url = str(request.base_url).rstrip("/")

    challenge = db.query(cm.Challenge).filter(
        cm.Challenge.id == challenge_id,
        cm.Challenge.is_published == True,
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Level not found.")

    completion_map = _get_completion_map(db, current_user.id)
    module_locked = _module_is_locked(challenge.module, completion_map)
    if _challenge_is_locked(challenge, module_locked, completion_map):
        raise HTTPException(status_code=403, detail="This level is still locked.")

    result = await _execute_submission(challenge, payload)
    passed = _determine_passed(challenge, result)
    attempt_number = _next_attempt_number(db, current_user.id, challenge.id)

    existing_completion = completion_map.get(challenge.id)
    xp_gained = 0

    if not existing_completion:
        xp_gained = _calculate_awarded_xp(challenge, passed, attempt_number, payload.exam_metrics)
        if xp_gained > 0:
            completion = cm.ChallengeCompletion(
                user_id=current_user.id,
                challenge_id=challenge.id,
                xp_awarded=xp_gained,
            )
            db.add(completion)
            completion_map[challenge.id] = completion
            current_user.total_xp = int(current_user.total_xp or 0) + xp_gained

    db.add(
        cm.ChallengeAttempt(
            user_id=current_user.id,
            challenge_id=challenge.id,
            attempt_number=attempt_number,
            status_id=result.status.id,
            is_passed=passed,
            xp_awarded=xp_gained,
            correct_answers=payload.exam_metrics.correct_answers if payload.exam_metrics else None,
            total_questions=payload.exam_metrics.total_questions if payload.exam_metrics else None,
            optimization_score=(
                int(round(payload.exam_metrics.optimization_score * 100))
                if payload.exam_metrics
                else None
            ),
        )
    )

    summary = _module_gate_summary(challenge.module, completion_map)
    badge_earned = _award_module_badge_if_eligible(
        db,
        current_user.id,
        challenge.module,
        summary["unlock_eligible"],
        base_url,
    )

    db.commit()
    db.refresh(current_user)

    envelope = _encrypt_payload_for_client(_judge_result_payload(result, passed), raw_token)

    return WorkspaceSubmitOut(
        encrypted=True,
        envelope=envelope,
        status=JudgeStatusOut(id=result.status.id, description=result.status.description),
        passed=passed,
        attempt_number=attempt_number,
        xp_gained=xp_gained,
        total_xp=int(current_user.total_xp or 0),
        module_gate=_to_module_gate_out(challenge.module_id, summary),
        badge_earned=badge_earned,
    )
