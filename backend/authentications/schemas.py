from pydantic import BaseModel, EmailStr
from typing import Optional

class LoginRequest(BaseModel):
    identifier: str  # Can be email or username
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    message: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class BaseResponse(BaseModel):
    message: str
