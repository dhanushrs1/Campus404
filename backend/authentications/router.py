from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from authentications import schemas, services, security
from database import get_db
from datetime import timedelta

router = APIRouter()

@router.get("/check-username/{username}")
async def check_username(username: str, db: Session = Depends(get_db)):
    """Real-time username availability check."""
    available = services.check_username_available(db, username)
    return {"username": username, "available": available}

@router.post("/login", response_model=schemas.TokenResponse)
async def login_for_access_token(login_data: schemas.LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user via Username/Email and Password returning a JWT token.
    Admin users receive an 'admin' role, regular users receive 'student'.
    """
    user = services.authenticate_user(db, login_data)
    
    # Determine role based on is_admin flag
    role = "admin" if user.is_admin else "student"
    
    # Generate JWT token
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email, "role": role, "id": user.id},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "role": role,
        "user_id": user.id,
        "message": "Login successful."
    }

@router.post("/register", response_model=schemas.TokenResponse)
async def register_user(reg_data: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """
    Creates a new user account and returns an access token.
    """
    user = services.register_user(db, reg_data)
    
    # New users are students by default
    role = "student"
    
    # Generate JWT token
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email, "role": role, "id": user.id},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "role": role,
        "user_id": user.id,
        "message": "Registration successful."
    }

@router.post("/forgot-password", response_model=schemas.BaseResponse)
async def forgot_password(request: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Triggers a password reset token to the given email address.
    Securely returns a generic response regardless of if the email exists.
    """
    return services.process_forgot_password(db, request.email)
