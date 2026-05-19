"""
campus404 Auth — SQLAlchemy User model.
OAuth2-only: no password column.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(256), unique=True, index=True, nullable=False)
    first_name = Column(String(128), nullable=False)
    last_name = Column(String(128), nullable=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    auth_provider = Column(String(32), nullable=False)   # "google" | "github"
    avatar = Column(String(512), nullable=True)          # Real profile image
    role = Column(String(32), nullable=False, default="student")
    session_version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, default=True, nullable=False)
    ban_reason = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("AdminActivityLog", back_populates="user")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} role={self.role!r}>"


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    login_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    logout_time = Column(DateTime, nullable=True)
    ip_address = Column(String(64), nullable=True)
    device_info = Column(String(512), nullable=True)  # User-Agent string
    refresh_token_hash = Column(String(128), nullable=True)
    refresh_expires_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")

    def __repr__(self) -> str:
        return f"<UserSession id={self.id} user_id={self.user_id} login_time={self.login_time}>"


class AdminActivityLog(Base):
    __tablename__ = "admin_activity_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    username = Column(String(64), nullable=True, index=True)
    role = Column(String(32), nullable=True, index=True)
    activity_type = Column(String(64), nullable=False, index=True)
    activity_context = Column(String(64), nullable=True)
    target_path = Column(String(256), nullable=True)
    ip_address = Column(String(64), nullable=True)
    country = Column(String(64), nullable=True)
    region = Column(String(128), nullable=True)
    city = Column(String(128), nullable=True)
    state = Column(String(128), nullable=True)
    timezone = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="activity_logs")

    def __repr__(self) -> str:
        return (
            f"<AdminActivityLog id={self.id} username={self.username!r} "
            f"activity_type={self.activity_type!r} created_at={self.created_at}>"
        )
