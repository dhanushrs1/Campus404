"""
guide/schemas.py — Campus404
Pydantic schemas for Guide page APIs.
"""
from datetime import datetime
import re
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator

SLUG_RE = r"^[a-z0-9-]+$"
_SAFE_PATH_RE = re.compile(r"^[\w/.-]+$")


def _validate_image_path(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if v.startswith("/") or ".." in v or not _SAFE_PATH_RE.match(v):
        raise ValueError("Invalid image path — must be a relative path without traversal sequences.")
    return v


def _normalize_module_ids(module_ids: List[int]) -> List[int]:
    seen = set()
    normalized: List[int] = []
    for module_id in module_ids:
        if module_id < 1:
            raise ValueError("module_ids must contain positive integers.")
        if module_id in seen:
            continue
        seen.add(module_id)
        normalized.append(module_id)
    return normalized


def _normalize_single_module_id(module_id: Optional[int]) -> Optional[int]:
    if module_id is None:
        return None
    if module_id < 1:
        raise ValueError("module_id must be a positive integer.")
    return module_id


class GuidePageCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255, pattern=SLUG_RE)
    excerpt: Optional[str] = Field(None, max_length=320)
    content_html: str = Field(..., min_length=1)
    featured_image_path: Optional[str] = None
    is_published: bool = False
    module_id: Optional[int] = None
    module_ids: List[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_fields(self):
        self.featured_image_path = _validate_image_path(self.featured_image_path)
        self.module_id = _normalize_single_module_id(self.module_id)
        self.module_ids = _normalize_module_ids(self.module_ids)
        if self.module_id is None and self.module_ids:
            self.module_id = self.module_ids[0]
        if self.module_id is not None and self.module_ids and self.module_id not in self.module_ids:
            raise ValueError("module_id must match module_ids when both are provided.")
        return self


class GuidePageUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255, pattern=SLUG_RE)
    excerpt: Optional[str] = Field(None, max_length=320)
    content_html: Optional[str] = Field(None, min_length=1)
    featured_image_path: Optional[str] = None
    is_published: Optional[bool] = None
    module_id: Optional[int] = None
    module_ids: Optional[List[int]] = None

    @model_validator(mode="after")
    def validate_fields(self):
        if "featured_image_path" in self.model_fields_set:
            self.featured_image_path = _validate_image_path(self.featured_image_path)
        if "module_id" in self.model_fields_set:
            self.module_id = _normalize_single_module_id(self.module_id)
        if self.module_ids is not None:
            self.module_ids = _normalize_module_ids(self.module_ids)
            if "module_id" not in self.model_fields_set:
                self.module_id = self.module_ids[0] if self.module_ids else None
        if self.module_id is not None and self.module_ids and self.module_id not in self.module_ids:
            raise ValueError("module_id must match module_ids when both are provided.")
        return self


class GuideModuleRef(BaseModel):
    module_id: int
    module_title: str
    module_slug: str
    lab_id: int
    lab_title: str
    lab_slug: str


class GuidePageListItem(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: Optional[str]
    is_published: bool
    module_id: Optional[int]
    module_title: Optional[str]
    module_slug: Optional[str]
    module_count: int
    featured_image_path: Optional[str]
    featured_image_url: Optional[str]
    created_at: datetime
    updated_at: datetime


class GuidePageAdminResponse(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: Optional[str]
    content_html: str
    is_published: bool
    featured_image_path: Optional[str]
    featured_image_url: Optional[str]
    module_id: Optional[int]
    module_ids: List[int]
    modules: List[GuideModuleRef]
    created_at: datetime
    updated_at: datetime


class GuidePagePublicResponse(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: Optional[str]
    content_html: str
    featured_image_url: Optional[str]
    module_id: Optional[int]
    modules: List[GuideModuleRef]
    updated_at: datetime


class ModuleGuideCard(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: Optional[str]
    featured_image_url: Optional[str]
    reading_minutes: int
    updated_at: datetime


class GuideModuleOption(BaseModel):
    module_id: int
    module_title: str
    module_slug: str
    lab_id: int
    lab_title: str
    lab_slug: str
