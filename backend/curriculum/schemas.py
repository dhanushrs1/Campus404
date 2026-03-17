"""
curriculum/schemas.py — Campus404
Pydantic v2 schemas for Labs, Modules, Challenges, and ChallengeFiles.
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, model_validator
import re

_SAFE_PATH_RE = re.compile(r'^[\w/.-]+$')


def _validate_image_path(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if v.startswith("/") or ".." in v or not _SAFE_PATH_RE.match(v):
        raise ValueError("Invalid image path — must be a relative path without traversal sequences.")
    return v


# ── LAB ───────────────────────────────────────────────────────────────────────
class LabCreate(BaseModel):
    title:             str           = Field(..., min_length=1, max_length=255)
    slug:              str           = Field(..., min_length=1, max_length=255, pattern=r'^[a-z0-9-]+$')
    description:       Optional[str] = Field(None, max_length=160)
    banner_image_path: Optional[str] = None
    language_id:       int           = Field(71, ge=1)   # Judge0 language id; default Python 3
    is_published:      bool          = False

    @model_validator(mode='after')
    def check_path(self):
        self.banner_image_path = _validate_image_path(self.banner_image_path)
        return self


class LabUpdate(BaseModel):
    title:             Optional[str]  = Field(None, min_length=1, max_length=255)
    slug:              Optional[str]  = Field(None, pattern=r'^[a-z0-9-]+$')
    description:       Optional[str]  = Field(None, max_length=160)
    banner_image_path: Optional[str]  = None
    hero_image_url:    Optional[str]  = None
    language_id:       Optional[int]  = Field(None, ge=1)
    is_published:      Optional[bool] = None

    @model_validator(mode='after')
    def check_path(self):
        self.banner_image_path = _validate_image_path(self.banner_image_path)
        return self


class LabResponse(BaseModel):
    id:                int
    title:             str
    slug:              str
    description:       Optional[str] = None
    banner_image_path: Optional[str] = None
    banner_url:        Optional[str] = None
    hero_image_url:    Optional[str] = None
    language_id:       int
    is_published:      bool
    total_xp:          int
    module_count:      int
    created_at:        datetime

    model_config = {"from_attributes": True}


# ── MODULE ────────────────────────────────────────────────────────────────────
class ModuleCreate(BaseModel):
    lab_id:      int            = Field(..., ge=1)
    title:       str            = Field(..., min_length=1, max_length=255)
    description: Optional[str]  = Field(None, max_length=160)
    banner_image_path: Optional[str] = None
    order_index: int            = Field(0, ge=0)

    @model_validator(mode='after')
    def check_path(self):
        self.banner_image_path = _validate_image_path(self.banner_image_path)
        return self


class ModuleUpdate(BaseModel):
    title:       Optional[str]  = Field(None, min_length=1, max_length=255)
    description: Optional[str]  = Field(None, max_length=160)
    banner_image_path: Optional[str] = None
    order_index: Optional[int]  = Field(None, ge=0)

    @model_validator(mode='after')
    def check_path(self):
        self.banner_image_path = _validate_image_path(self.banner_image_path)
        return self


class ModuleResponse(BaseModel):
    id:              int
    unique_id:       str
    slug:            str
    lab_id:          int
    title:           str
    description:     Optional[str]
    banner_image_path: Optional[str] = None
    banner_url:      Optional[str] = None
    order_index:     int
    challenge_count: int
    total_xp:        int
    created_at:      datetime

    model_config = {"from_attributes": True}


# ── CHALLENGE FILE ─────────────────────────────────────────────────────────────
class ChallengeFileCreate(BaseModel):
    filename:   str  = Field(..., min_length=1, max_length=100)
    content:    str  = ""
    is_main:    bool = False
    order_index: int = Field(0, ge=0)


class ChallengeFileUpdate(BaseModel):
    filename:    Optional[str]  = Field(None, min_length=1, max_length=100)
    content:     Optional[str]  = None
    is_main:     Optional[bool] = None
    order_index: Optional[int]  = Field(None, ge=0)


class ChallengeFileResponse(BaseModel):
    id:          int
    challenge_id: int
    filename:    str
    content:     str
    is_main:     bool
    order_index: int

    model_config = {"from_attributes": True}


# ── CHALLENGE ─────────────────────────────────────────────────────────────────
class ChallengeCreate(BaseModel):
    module_id:    int            = Field(..., ge=1)
    custom_title: Optional[str] = Field(None, max_length=255)
    xp_reward:    int            = Field(50, ge=1, le=10000)
    content_html: str            = Field(..., min_length=1)
    is_published: bool           = False
    files:        List[ChallengeFileCreate] = []
    # level_number intentionally NOT accepted — auto-calculated


class ChallengeUpdate(BaseModel):
    custom_title: Optional[str]  = Field(None, max_length=255)
    xp_reward:    Optional[int]  = Field(None, ge=1, le=10000)
    content_html: Optional[str]  = Field(None, min_length=1)
    is_published: Optional[bool] = None


class ChallengeResponse(BaseModel):
    id:            int
    module_id:     int
    level_number:  int
    custom_title:  Optional[str]
    display_title: str
    xp_reward:     int
    content_html:  str
    is_published:  bool
    files:         List[ChallengeFileResponse] = []
    created_at:    datetime
    updated_at:    datetime

    model_config = {"from_attributes": True}


# ── LANGUAGE ──────────────────────────────────────────────────────────────────
class LanguageResponse(BaseModel):
    id:        int
    name:      str
    extension: str
