"""
progress/router.py — Campus404
Public API for user progress: challenge completion, module progress, XP, badges.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime
from jose import jwt, JWTError

from database import get_db
from authentications.security import SECRET_KEY, ALGORITHM
import models as user_models
import curriculum.models as cm

router = APIRouter()


# ── Auth helper ─────────────────────────────────────────────────────────────────
def _get_current_user(request: Request, db: Session) -> user_models.User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    user = db.query(user_models.User).filter(user_models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


# ── Schemas ─────────────────────────────────────────────────────────────────────
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


# ── Helpers ─────────────────────────────────────────────────────────────────────
def _build_badge_url(badge: cm.Badge, base_url: str) -> Optional[str]:
    if badge.image_url:
        return badge.image_url
    if badge.image_path:
        return f"{base_url}/uploads/{badge.image_path}"
    return None


def _get_completed_ids(db: Session, user_id: int) -> set:
    rows = db.query(cm.ChallengeCompletion.challenge_id).filter(
        cm.ChallengeCompletion.user_id == user_id
    ).all()
    return {r[0] for r in rows}


# ── Endpoints ───────────────────────────────────────────────────────────────────
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
        completed_challenges=int(completed),
        badges_earned=int(badges),
        avatar_url=current_user.avatar_url,
        username=current_user.username,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
    )


@router.get("/me/badges", response_model=List[BadgeOut])
def get_my_badges(request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)
    rows = db.query(cm.UserBadge, cm.Badge).join(
        cm.Badge, cm.UserBadge.badge_id == cm.Badge.id
    ).filter(cm.UserBadge.user_id == current_user.id).all()
    return [
        BadgeOut(
            id=badge.id, name=badge.name, description=badge.description,
            image_url=badge.image_url or (f"/uploads/{badge.image_path}" if badge.image_path else None),
            module_id=badge.module_id, earned_at=ub.earned_at
        )
        for ub, badge in rows
    ]


@router.get("/labs/{slug}/progress", response_model=LabProgressOut)
def get_lab_progress(slug: str, request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)

    lab = db.query(cm.Lab).filter(cm.Lab.slug == slug, cm.Lab.is_published == True).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")

    base_url = str(request.base_url).rstrip("/")
    banner_url = f"{base_url}/uploads/{lab.banner_image_path}" if lab.banner_image_path else None
    completed_ids = _get_completed_ids(db, current_user.id)

    total_xp = 0
    earned_xp = 0
    prev_module_complete = True  # first module always unlocked

    modules_out = []
    for module in lab.modules:
        challenges = [c for c in module.challenges if c.is_published]
        module_banner_url = f"{base_url}/uploads/{module.banner_image_path}" if module.banner_image_path else None
        module_challenge_ids = {c.id for c in challenges}
        module_completed_ids = module_challenge_ids & completed_ids
        module_complete = len(challenges) > 0 and module_completed_ids == module_challenge_ids
        module_xp = sum(c.xp_reward for c in challenges)
        module_earned = sum(c.xp_reward for c in challenges if c.id in completed_ids)
        total_xp += module_xp
        earned_xp += module_earned

        badge_out = None
        if module.badge:
            earned_at = None
            ub = db.query(cm.UserBadge).filter(
                cm.UserBadge.user_id == current_user.id,
                cm.UserBadge.badge_id == module.badge.id
            ).first()
            if ub:
                earned_at = ub.earned_at
            badge_out = BadgeOut(
                id=module.badge.id, name=module.badge.name,
                description=module.badge.description,
                image_url=_build_badge_url(module.badge, base_url),
                module_id=module.id, earned_at=earned_at,
            )

        is_module_locked = not prev_module_complete

        prev_ch_done = True
        ch_out = []
        for ch in challenges:
            is_ch_locked = is_module_locked or not prev_ch_done
            is_ch_done = ch.id in completed_ids
            ch_out.append(ChallengeProgressOut(
                challenge_id=ch.id,
                level_number=ch.level_number,
                display_title=ch.custom_title or f"Level {ch.level_number}",
                xp_reward=ch.xp_reward,
                is_completed=is_ch_done,
                is_locked=is_ch_locked,
            ))
            if not is_ch_done:
                prev_ch_done = False

        modules_out.append(ModuleProgressOut(
            module_id=module.id,
            unique_id=module.unique_id,
            slug=module.slug,
            title=module.title,
            description=module.description,
            banner_image_path=module.banner_image_path,
            banner_url=module_banner_url,
            order_index=module.order_index,
            total_xp=module_xp,
            earned_xp=module_earned,
            is_locked=is_module_locked,
            is_completed=module_complete,
            challenge_count=len(challenges),
            completed_challenges=len(module_completed_ids),
            badge=badge_out,
            challenges=ch_out,
        ))
        prev_module_complete = module_complete

    return LabProgressOut(
        lab_id=lab.id, slug=lab.slug, title=lab.title,
        description=lab.description,
        banner_url=banner_url, hero_image_url=lab.hero_image_url,
        language_id=lab.language_id,
        total_xp=total_xp, earned_xp=earned_xp,
        modules=modules_out,
    )


@router.post("/challenges/{challenge_id}/complete")
def complete_challenge(challenge_id: int, request: Request, db: Session = Depends(get_db)):
    current_user = _get_current_user(request, db)

    challenge = db.query(cm.Challenge).filter(
        cm.Challenge.id == challenge_id,
        cm.Challenge.is_published == True
    ).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found.")

    existing = db.query(cm.ChallengeCompletion).filter(
        cm.ChallengeCompletion.user_id == current_user.id,
        cm.ChallengeCompletion.challenge_id == challenge_id,
    ).first()

    xp_gained = 0
    badge_earned = None

    if not existing:
        db.add(cm.ChallengeCompletion(
            user_id=current_user.id,
            challenge_id=challenge_id,
            xp_awarded=challenge.xp_reward,
        ))
        # Award XP
        user = db.query(user_models.User).filter(user_models.User.id == current_user.id).first()
        user.total_xp = (user.total_xp or 0) + challenge.xp_reward
        xp_gained = challenge.xp_reward
        db.commit()
        db.refresh(user)

        # Auto-grant module badge if all challenges done
        module = challenge.module
        pub_challenges = [c for c in module.challenges if c.is_published]
        pub_ids = {c.id for c in pub_challenges}
        done_ids = _get_completed_ids(db, current_user.id)
        if pub_ids and pub_ids.issubset(done_ids) and module.badge:
            already = db.query(cm.UserBadge).filter(
                cm.UserBadge.user_id == current_user.id,
                cm.UserBadge.badge_id == module.badge.id,
            ).first()
            if not already:
                db.add(cm.UserBadge(user_id=current_user.id, badge_id=module.badge.id))
                db.commit()
                badge_earned = {"name": module.badge.name, "description": module.badge.description}

    return {
        "xp_gained": xp_gained,
        "total_xp": (current_user.total_xp or 0) + xp_gained,
        "badge_earned": badge_earned,
    }
