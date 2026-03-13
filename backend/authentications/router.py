from fastapi import APIRouter, Depends, HTTPException, status
from authentications import schemas, services, security
from datetime import timedelta

router = APIRouter()

@router.post("/login", response_model=schemas.TokenResponse)
async def login_for_access_token(login_data: schemas.LoginRequest):
    """
    Authenticates a user via Username/Email and Password returning a JWT token.
    Admin users receive an 'admin' role, regular users receive 'student'.
    """
    user = services.authenticate_user(login_data)
    
    # Generate JWT token
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user["email"], "role": user["role"], "id": user["id"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "role": user["role"],
        "user_id": user["id"],
        "message": "Login successful."
    }

@router.post("/forgot-password", response_model=schemas.BaseResponse)
async def forgot_password(request: schemas.ForgotPasswordRequest):
    """
    Triggers a password reset token to the given email address.
    Securely returns a generic response regardless of if the email exists.
    """
    return services.process_forgot_password(request.email)
