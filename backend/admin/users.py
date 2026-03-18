"""
admin/users.py — Campus404
Admin user-management API with activity insights, XP controls, and custom reset tooling.
"""
import json
from typing import Dict, List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import JWTError, jwt
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from authentications.security import ALGORITHM, SECRET_KEY
from database import get_db
import curriculum.models as cm
import models

router = APIRouter()


# ── Auth helpers ─────────────────────────────────────────────────────────────
def _get_current_user(request: Request, db: Session) -> models.User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def _require_admin(request: Request, db: Session) -> models.User:
    user = _get_current_user(request, db)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


def _managed_user_or_404(db: Session, user_id: int) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _role_for(user: models.User) -> str:
    if user.is_admin:
        return "admin"
    if user.is_editor:
        return "editor"
    return "student"


def _to_iso(value) -> Optional[str]:
    return value.isoformat() if value else None


def _json_dumps(value: Optional[dict]) -> Optional[str]:
    if value is None:
        return None
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def _json_loads(value: Optional[str]) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _write_audit_log(
    db: Session,
    actor_admin_id: Optional[int],
    target_user_id: Optional[int],
    action: str,
    reason: Optional[str] = None,
    context: Optional[dict] = None,
) -> None:
    db.add(
        models.AdminAuditLog(
            actor_admin_id=actor_admin_id,
            target_user_id=target_user_id,
            action=action,
            reason=reason,
            context_json=_json_dumps(context),
        )
    )


def _challenge_title(challenge: cm.Challenge) -> str:
    if challenge.challenge_type == cm.CHALLENGE_TYPE_EXAM:
        return challenge.custom_title or "Module Exam"
    return challenge.custom_title or f"Level {challenge.level_number}"


def _badge_image_url(badge: cm.Badge) -> Optional[str]:
    if badge.image_url:
        return badge.image_url
    if badge.image_path:
        return f"/uploads/{badge.image_path}"
    return None


def _module_badge_eligibility(db: Session, user_id: int, badge: cm.Badge) -> Tuple[bool, str]:
    if not badge.module_id:
        return True, "Standalone badge can be granted manually."

    total_levels = int(
        db.query(func.count(cm.Challenge.id))
        .filter(
            cm.Challenge.module_id == badge.module_id,
            cm.Challenge.is_published == True,
        )
        .scalar()
        or 0
    )
    if total_levels == 0:
        return True, "Module has no published levels yet."

    completed_levels = int(
        db.query(func.count(cm.ChallengeCompletion.id))
        .join(cm.Challenge, cm.Challenge.id == cm.ChallengeCompletion.challenge_id)
        .filter(
            cm.ChallengeCompletion.user_id == user_id,
            cm.Challenge.module_id == badge.module_id,
            cm.Challenge.is_published == True,
        )
        .scalar()
        or 0
    )
    if completed_levels >= total_levels:
        return True, "Eligible: all module levels are completed."
    return False, f"Needs full module completion ({completed_levels}/{total_levels})."


def _recalculate_user_xp(db: Session, user_id: int) -> int:
    total = (
        db.query(func.coalesce(func.sum(cm.ChallengeCompletion.xp_awarded), 0))
        .filter(cm.ChallengeCompletion.user_id == user_id)
        .scalar()
    )
    return int(total or 0)


# ── Input models ─────────────────────────────────────────────────────────────
class XpAdjustIn(BaseModel):
    operation: Literal["increase", "decrease", "set", "reset"]
    amount: int = Field(0, ge=0, le=1_000_000)
    reason: Optional[str] = Field(None, max_length=255)

    @model_validator(mode="after")
    def validate_payload(self):
        if self.operation in {"increase", "decrease"} and self.amount <= 0:
            raise ValueError("amount must be greater than zero for increase/decrease.")
        return self


class UserProgressResetIn(BaseModel):
    target_type: Literal["module", "level", "all"]
    module_id: Optional[int] = Field(None, ge=1)
    challenge_id: Optional[int] = Field(None, ge=1)
    clear_attempts: bool = True
    clear_completions: bool = True
    clear_badges: bool = False
    reset_streaks: bool = False
    set_xp_to: Optional[int] = Field(None, ge=0, le=1_000_000)
    reason: Optional[str] = Field(None, max_length=255)

    @model_validator(mode="after")
    def validate_payload(self):
        if self.target_type == "module" and not self.module_id:
            raise ValueError("module_id is required when target_type is 'module'.")
        if self.target_type == "level" and not self.challenge_id:
            raise ValueError("challenge_id is required when target_type is 'level'.")
        if not any([
            self.clear_attempts,
            self.clear_completions,
            self.clear_badges,
            self.reset_streaks,
            self.set_xp_to is not None,
        ]):
            raise ValueError("Select at least one reset operation.")
        return self


class BadgeGrantIn(BaseModel):
    badge_id: int = Field(..., ge=1)
    force: bool = False
    reason: Optional[str] = Field(None, max_length=255)


# ── GET /users — paginated with search + role filter ───────────────────────
@router.get("")
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    _require_admin(request, db)

    q = db.query(models.User)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (models.User.username.ilike(like))
            | (models.User.email.ilike(like))
            | (models.User.first_name.ilike(like))
            | (models.User.last_name.ilike(like))
        )
    if role == "admin":
        q = q.filter(models.User.is_admin == True)
    elif role == "editor":
        q = q.filter(models.User.is_editor == True, models.User.is_admin == False)
    elif role == "student":
        q = q.filter(
            models.User.is_admin == False,
            models.User.is_editor == False,
            models.User.is_banned == False,
        )
    elif role == "banned":
        q = q.filter(models.User.is_banned == True)

    total = q.count()
    users = q.order_by(models.User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "avatar_url": u.avatar_url,
                "role": _role_for(u),
                "is_banned": u.is_banned,
                "is_verified": u.is_verified,
                "total_xp": int(u.total_xp or 0),
                "current_streak": int(u.current_streak or 0),
                "created_at": _to_iso(u.created_at),
                "last_login_at": _to_iso(u.last_login_at),
            }
            for u in users
        ],
    }


# ── GET /{id}/activity — deep activity snapshot for admin popup ────────────
@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: int,
    request: Request,
    limit: int = Query(40, ge=10, le=200),
    db: Session = Depends(get_db),
):
    _require_admin(request, db)
    user = _managed_user_or_404(db, user_id)

    completion_rows = (
        db.query(cm.ChallengeCompletion)
        .options(
            joinedload(cm.ChallengeCompletion.challenge)
            .joinedload(cm.Challenge.module)
            .joinedload(cm.Module.lab)
        )
        .filter(cm.ChallengeCompletion.user_id == user_id)
        .all()
    )
    completion_map: Dict[int, cm.ChallengeCompletion] = {
        row.challenge_id: row for row in completion_rows if row.challenge is not None
    }

    attempt_agg_rows = (
        db.query(
            cm.ChallengeAttempt.challenge_id.label("challenge_id"),
            func.count(cm.ChallengeAttempt.id).label("attempt_count"),
            func.coalesce(
                func.sum(case((cm.ChallengeAttempt.is_passed == True, 1), else_=0)),
                0,
            ).label("passed_count"),
            func.max(cm.ChallengeAttempt.created_at).label("last_attempt_at"),
        )
        .filter(cm.ChallengeAttempt.user_id == user_id)
        .group_by(cm.ChallengeAttempt.challenge_id)
        .all()
    )
    attempt_map = {
        int(row.challenge_id): {
            "attempt_count": int(row.attempt_count or 0),
            "passed_count": int(row.passed_count or 0),
            "last_attempt_at": row.last_attempt_at,
        }
        for row in attempt_agg_rows
    }

    total_attempts = int(
        db.query(func.count(cm.ChallengeAttempt.id))
        .filter(cm.ChallengeAttempt.user_id == user_id)
        .scalar()
        or 0
    )
    attended_level_ids = set(attempt_map.keys()) | set(completion_map.keys())

    modules = (
        db.query(cm.Module)
        .options(joinedload(cm.Module.lab), joinedload(cm.Module.challenges))
        .order_by(cm.Module.lab_id.asc(), cm.Module.order_index.asc(), cm.Module.title.asc())
        .all()
    )

    module_progress = []
    reset_modules = []
    reset_levels = []
    total_published_levels = 0
    published_completed_levels = 0

    for module in modules:
        ordered_levels = sorted(module.challenges, key=lambda c: c.level_number)
        published_levels = [level for level in ordered_levels if level.is_published]
        published_total = len(published_levels)
        published_completed = len([level for level in published_levels if level.id in completion_map])
        published_attempted = len([level for level in published_levels if level.id in attended_level_ids])

        total_published_levels += published_total
        published_completed_levels += published_completed

        module_total_xp = int(sum(int(level.xp_reward or 0) for level in published_levels))
        module_earned_xp = int(
            sum(int(completion_map[level.id].xp_awarded or 0) for level in published_levels if level.id in completion_map)
        )

        levels_out = []
        for level in ordered_levels:
            completion = completion_map.get(level.id)
            attempt_stats = attempt_map.get(level.id, {"attempt_count": 0, "passed_count": 0, "last_attempt_at": None})
            level_item = {
                "challenge_id": level.id,
                "level_number": level.level_number,
                "display_title": _challenge_title(level),
                "challenge_type": level.challenge_type,
                "is_published": bool(level.is_published),
                "xp_reward": int(level.xp_reward or 0),
                "is_completed": completion is not None,
                "xp_awarded": int(completion.xp_awarded or 0) if completion else 0,
                "completed_at": _to_iso(completion.completed_at if completion else None),
                "attempt_count": int(attempt_stats["attempt_count"]),
                "passed_attempts": int(attempt_stats["passed_count"]),
                "last_attempt_at": _to_iso(attempt_stats["last_attempt_at"]),
            }
            levels_out.append(level_item)

            reset_levels.append(
                {
                    "challenge_id": level.id,
                    "module_id": module.id,
                    "module_title": module.title,
                    "lab_title": module.lab.title if module.lab else None,
                    "level_number": level.level_number,
                    "display_title": level_item["display_title"],
                    "challenge_type": level.challenge_type,
                }
            )

        module_progress.append(
            {
                "module_id": module.id,
                "module_title": module.title,
                "module_slug": module.slug,
                "lab_id": module.lab.id if module.lab else None,
                "lab_title": module.lab.title if module.lab else None,
                "published_levels": published_total,
                "completed_levels": published_completed,
                "attended_levels": published_attempted,
                "module_total_xp": module_total_xp,
                "module_earned_xp": module_earned_xp,
                "progress_percent": round((published_completed / published_total) * 100.0, 2) if published_total > 0 else 0.0,
                "is_completed": bool(published_total > 0 and published_completed >= published_total),
                "levels": levels_out,
            }
        )

        reset_modules.append(
            {
                "module_id": module.id,
                "module_title": module.title,
                "lab_title": module.lab.title if module.lab else None,
                "published_levels": published_total,
            }
        )

    owned_badge_rows = (
        db.query(cm.UserBadge, cm.Badge)
        .join(cm.Badge, cm.Badge.id == cm.UserBadge.badge_id)
        .filter(cm.UserBadge.user_id == user_id)
        .order_by(cm.UserBadge.earned_at.desc())
        .all()
    )
    owned_badges = [
        {
            "badge_id": badge.id,
            "name": badge.name,
            "description": badge.description,
            "module_id": badge.module_id,
            "module_title": badge.module.title if badge.module else None,
            "image_url": _badge_image_url(badge),
            "earned_at": _to_iso(user_badge.earned_at),
        }
        for user_badge, badge in owned_badge_rows
    ]
    owned_badge_ids = {badge["badge_id"] for badge in owned_badges}

    all_badges = (
        db.query(cm.Badge)
        .options(joinedload(cm.Badge.module).joinedload(cm.Module.lab))
        .order_by(cm.Badge.name.asc())
        .all()
    )
    badge_catalog = []
    for badge in all_badges:
        eligible, validation_message = _module_badge_eligibility(db, user_id, badge)
        badge_catalog.append(
            {
                "badge_id": badge.id,
                "name": badge.name,
                "description": badge.description,
                "module_id": badge.module_id,
                "module_title": badge.module.title if badge.module else None,
                "lab_title": badge.module.lab.title if badge.module and badge.module.lab else None,
                "image_url": _badge_image_url(badge),
                "already_owned": badge.id in owned_badge_ids,
                "eligible": eligible,
                "validation_message": validation_message,
            }
        )

    recent_attempts = (
        db.query(cm.ChallengeAttempt)
        .options(
            joinedload(cm.ChallengeAttempt.challenge)
            .joinedload(cm.Challenge.module)
            .joinedload(cm.Module.lab)
        )
        .filter(cm.ChallengeAttempt.user_id == user_id)
        .order_by(cm.ChallengeAttempt.created_at.desc())
        .limit(limit)
        .all()
    )
    recent_completions = (
        db.query(cm.ChallengeCompletion)
        .options(
            joinedload(cm.ChallengeCompletion.challenge)
            .joinedload(cm.Challenge.module)
            .joinedload(cm.Module.lab)
        )
        .filter(cm.ChallengeCompletion.user_id == user_id)
        .order_by(cm.ChallengeCompletion.completed_at.desc())
        .limit(limit)
        .all()
    )

    activity_rows: List[dict] = []
    for attempt in recent_attempts:
        challenge = attempt.challenge
        module = challenge.module if challenge else None
        lab = module.lab if module else None
        activity_rows.append(
            {
                "type": "attempt",
                "occurred_at": _to_iso(attempt.created_at),
                "_epoch": attempt.created_at.timestamp() if attempt.created_at else 0,
                "challenge_id": challenge.id if challenge else None,
                "level_number": challenge.level_number if challenge else None,
                "display_title": _challenge_title(challenge) if challenge else "Unknown level",
                "challenge_type": challenge.challenge_type if challenge else None,
                "module_id": module.id if module else None,
                "module_title": module.title if module else None,
                "lab_id": lab.id if lab else None,
                "lab_title": lab.title if lab else None,
                "attempt_number": attempt.attempt_number,
                "passed": bool(attempt.is_passed),
                "status_id": attempt.status_id,
                "xp_awarded": int(attempt.xp_awarded or 0),
            }
        )

    for completion in recent_completions:
        challenge = completion.challenge
        module = challenge.module if challenge else None
        lab = module.lab if module else None
        activity_rows.append(
            {
                "type": "completion",
                "occurred_at": _to_iso(completion.completed_at),
                "_epoch": completion.completed_at.timestamp() if completion.completed_at else 0,
                "challenge_id": challenge.id if challenge else None,
                "level_number": challenge.level_number if challenge else None,
                "display_title": _challenge_title(challenge) if challenge else "Unknown level",
                "challenge_type": challenge.challenge_type if challenge else None,
                "module_id": module.id if module else None,
                "module_title": module.title if module else None,
                "lab_id": lab.id if lab else None,
                "lab_title": lab.title if lab else None,
                "xp_awarded": int(completion.xp_awarded or 0),
            }
        )

    activity_rows.sort(key=lambda item: item.get("_epoch", 0), reverse=True)
    trimmed_activity = []
    for item in activity_rows[:limit]:
        item.pop("_epoch", None)
        trimmed_activity.append(item)

    completion_percent = round((published_completed_levels / total_published_levels) * 100.0, 2) if total_published_levels > 0 else 0.0

    admin_action_rows = (
        db.query(models.AdminAuditLog)
        .filter(models.AdminAuditLog.target_user_id == user_id)
        .order_by(models.AdminAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    actor_ids = sorted({int(row.actor_admin_id) for row in admin_action_rows if row.actor_admin_id is not None})
    actor_rows = []
    if actor_ids:
        actor_rows = (
            db.query(models.User)
            .filter(models.User.id.in_(actor_ids))
            .all()
        )
    actors_by_id = {
        actor.id: {
            "username": actor.username,
            "display_name": (
                f"{actor.first_name or ''} {actor.last_name or ''}".strip() if (actor.first_name or actor.last_name) else actor.username
            ),
        }
        for actor in actor_rows
    }

    recent_admin_actions = []
    for row in admin_action_rows:
        actor_info = actors_by_id.get(row.actor_admin_id or -1, None)
        recent_admin_actions.append(
            {
                "audit_id": row.id,
                "action": row.action,
                "reason": row.reason,
                "actor_admin_id": row.actor_admin_id,
                "actor_username": actor_info["username"] if actor_info else None,
                "actor_display_name": actor_info["display_name"] if actor_info else None,
                "created_at": _to_iso(row.created_at),
                "context": _json_loads(row.context_json),
            }
        )

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "avatar_url": user.avatar_url,
            "role": _role_for(user),
            "is_banned": bool(user.is_banned),
            "is_verified": bool(user.is_verified),
            "total_xp": int(user.total_xp or 0),
            "current_streak": int(user.current_streak or 0),
            "longest_streak": int(user.longest_streak or 0),
            "created_at": _to_iso(user.created_at),
            "last_login_at": _to_iso(user.last_login_at),
        },
        "summary": {
            "levels_attended": len(attended_level_ids),
            "total_attempts": total_attempts,
            "levels_completed": len(completion_map),
            "published_levels": total_published_levels,
            "completion_percent": completion_percent,
            "badges_earned": len(owned_badges),
        },
        "module_progress": module_progress,
        "owned_badges": owned_badges,
        "badge_catalog": badge_catalog,
        "recent_activity": trimmed_activity,
        "recent_admin_actions": recent_admin_actions,
        "reset_options": {
            "modules": reset_modules,
            "levels": reset_levels,
        },
    }


# ── POST /{id}/xp — increase/decrease/set/reset XP ─────────────────────────
@router.post("/{user_id}/xp")
async def adjust_user_xp(
    user_id: int,
    payload: XpAdjustIn,
    request: Request,
    db: Session = Depends(get_db),
):
    actor = _require_admin(request, db)
    user = _managed_user_or_404(db, user_id)

    before = int(user.total_xp or 0)
    if payload.operation == "increase":
        after = before + payload.amount
    elif payload.operation == "decrease":
        after = max(0, before - payload.amount)
    elif payload.operation == "set":
        after = max(0, payload.amount)
    else:
        after = 0

    user.total_xp = int(after)

    _write_audit_log(
        db,
        actor_admin_id=actor.id,
        target_user_id=user.id,
        action=f"user.xp.{payload.operation}",
        reason=payload.reason,
        context={
            "before_xp": before,
            "after_xp": int(after),
            "amount": int(payload.amount),
            "operation": payload.operation,
        },
    )

    db.commit()

    return {
        "message": "XP updated successfully.",
        "user_id": user_id,
        "operation": payload.operation,
        "reason": payload.reason,
        "before_xp": before,
        "after_xp": int(user.total_xp or 0),
    }


# ── POST /{id}/progress/reset — custom reset controls ───────────────────────
@router.post("/{user_id}/progress/reset")
async def reset_user_progress(
    user_id: int,
    payload: UserProgressResetIn,
    request: Request,
    db: Session = Depends(get_db),
):
    actor = _require_admin(request, db)
    user = _managed_user_or_404(db, user_id)

    target_module_id: Optional[int] = None
    challenge_ids: Optional[List[int]] = None

    if payload.target_type == "module":
        module = db.query(cm.Module).filter(cm.Module.id == payload.module_id).first()
        if not module:
            raise HTTPException(status_code=404, detail="Module not found.")
        target_module_id = module.id
        challenge_ids = [
            int(row[0])
            for row in db.query(cm.Challenge.id).filter(cm.Challenge.module_id == module.id).all()
        ]
    elif payload.target_type == "level":
        challenge = db.query(cm.Challenge).filter(cm.Challenge.id == payload.challenge_id).first()
        if not challenge:
            raise HTTPException(status_code=404, detail="Level not found.")
        challenge_ids = [challenge.id]
        target_module_id = challenge.module_id

    deleted_attempts = 0
    deleted_completions = 0
    deleted_badges = 0

    if payload.clear_attempts:
        q = db.query(cm.ChallengeAttempt).filter(cm.ChallengeAttempt.user_id == user_id)
        if challenge_ids is not None:
            if challenge_ids:
                q = q.filter(cm.ChallengeAttempt.challenge_id.in_(challenge_ids))
            else:
                q = q.filter(cm.ChallengeAttempt.challenge_id == -1)
        deleted_attempts = int(q.delete(synchronize_session=False) or 0)

    if payload.clear_completions:
        q = db.query(cm.ChallengeCompletion).filter(cm.ChallengeCompletion.user_id == user_id)
        if challenge_ids is not None:
            if challenge_ids:
                q = q.filter(cm.ChallengeCompletion.challenge_id.in_(challenge_ids))
            else:
                q = q.filter(cm.ChallengeCompletion.challenge_id == -1)
        deleted_completions = int(q.delete(synchronize_session=False) or 0)

    if payload.clear_badges:
        badge_ids: Optional[List[int]] = None
        if payload.target_type == "all":
            badge_ids = None
        elif target_module_id is not None:
            badge_ids = [
                int(row[0])
                for row in db.query(cm.Badge.id).filter(cm.Badge.module_id == target_module_id).all()
            ]

        q = db.query(cm.UserBadge).filter(cm.UserBadge.user_id == user_id)
        if badge_ids is not None:
            if badge_ids:
                q = q.filter(cm.UserBadge.badge_id.in_(badge_ids))
            else:
                q = q.filter(cm.UserBadge.badge_id == -1)
        deleted_badges = int(q.delete(synchronize_session=False) or 0)

    if payload.reset_streaks:
        user.current_streak = 0
        user.longest_streak = 0

    if payload.set_xp_to is not None:
        user.total_xp = int(payload.set_xp_to)
    else:
        user.total_xp = _recalculate_user_xp(db, user_id)

    _write_audit_log(
        db,
        actor_admin_id=actor.id,
        target_user_id=user.id,
        action="user.progress.reset",
        reason=payload.reason,
        context={
            "target_type": payload.target_type,
            "module_id": payload.module_id,
            "challenge_id": payload.challenge_id,
            "clear_attempts": bool(payload.clear_attempts),
            "clear_completions": bool(payload.clear_completions),
            "clear_badges": bool(payload.clear_badges),
            "reset_streaks": bool(payload.reset_streaks),
            "set_xp_to": payload.set_xp_to,
            "deleted_attempts": int(deleted_attempts),
            "deleted_completions": int(deleted_completions),
            "deleted_badges": int(deleted_badges),
            "result_total_xp": int(user.total_xp or 0),
        },
    )

    db.commit()

    return {
        "message": "User progress reset completed.",
        "user_id": user_id,
        "target_type": payload.target_type,
        "module_id": payload.module_id,
        "challenge_id": payload.challenge_id,
        "reason": payload.reason,
        "deleted_attempts": deleted_attempts,
        "deleted_completions": deleted_completions,
        "deleted_badges": deleted_badges,
        "current_streak": int(user.current_streak or 0),
        "longest_streak": int(user.longest_streak or 0),
        "total_xp": int(user.total_xp or 0),
    }


# ── POST /{id}/badges/grant — manual grant with validation ─────────────────
@router.post("/{user_id}/badges/grant")
async def grant_badge_to_user(
    user_id: int,
    payload: BadgeGrantIn,
    request: Request,
    db: Session = Depends(get_db),
):
    actor = _require_admin(request, db)
    _managed_user_or_404(db, user_id)

    badge = (
        db.query(cm.Badge)
        .options(joinedload(cm.Badge.module).joinedload(cm.Module.lab))
        .filter(cm.Badge.id == payload.badge_id)
        .first()
    )
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found.")

    existing = db.query(cm.UserBadge).filter(
        cm.UserBadge.user_id == user_id,
        cm.UserBadge.badge_id == badge.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already has this badge.")

    eligible, validation_message = _module_badge_eligibility(db, user_id, badge)
    if not eligible and not payload.force:
        raise HTTPException(status_code=422, detail=f"Validation failed: {validation_message}")

    user_badge = cm.UserBadge(user_id=user_id, badge_id=badge.id)
    db.add(user_badge)

    _write_audit_log(
        db,
        actor_admin_id=actor.id,
        target_user_id=user_id,
        action="user.badge.grant",
        reason=payload.reason,
        context={
            "badge_id": badge.id,
            "badge_name": badge.name,
            "module_id": badge.module_id,
            "eligible": bool(eligible),
            "granted_with_override": bool((not eligible) and payload.force),
        },
    )

    db.commit()
    db.refresh(user_badge)

    return {
        "message": "Badge granted successfully.",
        "user_id": user_id,
        "badge_id": badge.id,
        "badge_name": badge.name,
        "eligible": eligible,
        "granted_with_override": bool((not eligible) and payload.force),
        "validation_message": validation_message,
        "reason": payload.reason,
        "earned_at": _to_iso(user_badge.earned_at),
    }


# ── DELETE /{id}/badges/{badge_id} — revoke manually assigned/earned badge ─
@router.delete("/{user_id}/badges/{badge_id}")
async def revoke_badge_from_user(
    user_id: int,
    badge_id: int,
    request: Request,
    reason: Optional[str] = Query(None, max_length=255),
    db: Session = Depends(get_db),
):
    actor = _require_admin(request, db)
    _managed_user_or_404(db, user_id)

    badge = db.query(cm.Badge).filter(cm.Badge.id == badge_id).first()

    existing = db.query(cm.UserBadge).filter(
        cm.UserBadge.user_id == user_id,
        cm.UserBadge.badge_id == badge_id,
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="User does not have this badge.")

    _write_audit_log(
        db,
        actor_admin_id=actor.id,
        target_user_id=user_id,
        action="user.badge.revoke",
        reason=reason,
        context={
            "badge_id": badge_id,
            "badge_name": badge.name if badge else None,
            "module_id": badge.module_id if badge else None,
        },
    )

    db.delete(existing)
    db.commit()
    return {
        "message": "Badge revoked successfully.",
        "user_id": user_id,
        "badge_id": badge_id,
        "reason": reason,
    }


# ── PATCH /{id}/role — promote / demote ───────────────────────────────
@router.patch("/{user_id}/role")
async def update_role(
    user_id: int,
    request: Request,
    role: str = Query(..., enum=["admin", "editor", "student"]),
    reason: Optional[str] = Query(None, max_length=255),
    db: Session = Depends(get_db),
):
    caller = _require_admin(request, db)
    if caller.id == user_id:
        raise HTTPException(status_code=403, detail="You cannot change your own role.")

    user = _managed_user_or_404(db, user_id)
    before_role = _role_for(user)
    user.is_admin = role == "admin"
    user.is_editor = role == "editor"

    _write_audit_log(
        db,
        actor_admin_id=caller.id,
        target_user_id=user.id,
        action="user.role.update",
        reason=reason,
        context={
            "before_role": before_role,
            "after_role": role,
        },
    )

    db.commit()
    return {
        "message": f"Role updated to {role}",
        "user_id": user_id,
        "role": role,
        "reason": reason,
    }


# ── PATCH /{id}/ban — ban / unban ─────────────────────────────────────
@router.patch("/{user_id}/ban")
async def toggle_ban(
    user_id: int,
    request: Request,
    banned: bool = Query(...),
    reason: Optional[str] = Query(None, max_length=255),
    db: Session = Depends(get_db),
):
    caller = _require_admin(request, db)
    if caller.id == user_id:
        raise HTTPException(status_code=403, detail="You cannot ban yourself.")

    user = _managed_user_or_404(db, user_id)
    before_banned = bool(user.is_banned)
    user.is_banned = banned

    _write_audit_log(
        db,
        actor_admin_id=caller.id,
        target_user_id=user.id,
        action="user.ban.update",
        reason=reason,
        context={
            "before_banned": before_banned,
            "after_banned": bool(banned),
        },
    )

    db.commit()
    action = "banned" if banned else "unbanned"
    return {
        "message": f"User {action} successfully",
        "user_id": user_id,
        "is_banned": banned,
        "reason": reason,
    }


# ── DELETE /{id} — permanently delete ────────────────────────────────
@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    reason: Optional[str] = Query(None, max_length=255),
    db: Session = Depends(get_db),
):
    caller = _require_admin(request, db)
    if caller.id == user_id:
        raise HTTPException(status_code=403, detail="You cannot delete your own account.")

    user = _managed_user_or_404(db, user_id)

    _write_audit_log(
        db,
        actor_admin_id=caller.id,
        target_user_id=user.id,
        action="user.delete",
        reason=reason,
        context={
            "deleted_user_id": user.id,
            "username": user.username,
            "email": user.email,
            "role": _role_for(user),
            "is_banned": bool(user.is_banned),
            "total_xp": int(user.total_xp or 0),
        },
    )

    db.delete(user)
    db.commit()
    return {
        "message": "User permanently deleted",
        "user_id": user_id,
        "reason": reason,
    }
