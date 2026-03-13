from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from authentications import schemas, security
import models

def authenticate_user(db: Session, login_data: schemas.LoginRequest) -> models.User:
    # Look up user by email or username
    user = db.query(models.User).filter(
        (models.User.email == login_data.identifier) | 
        (models.User.username == login_data.identifier)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Securely verify password
    if not security.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Stamp last login time
    from datetime import datetime, timezone
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)  # Re-load user attributes after commit to avoid DetachedInstanceError
        
    return user

def register_user(db: Session, reg_data: schemas.RegisterRequest) -> models.User:
    username_lower = reg_data.username.lower().strip()

    # Check if username exists (case-insensitive)
    if db.query(models.User).filter(models.User.username == username_lower).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Check if email exists
    if db.query(models.User).filter(models.User.email == reg_data.email.lower().strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user with all profile fields — username saved as lowercase
    hashed_pwd = security.get_password_hash(reg_data.password)
    new_user = models.User(
        username=username_lower,
        email=reg_data.email.lower().strip(),
        hashed_password=hashed_pwd,
        first_name=reg_data.first_name.strip() or None,
        last_name=reg_data.last_name.strip() or None,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def process_forgot_password(db: Session, email: str):
    """
    Simulates sending a forgot password email.
    We don't raise a 404 if the user isn't found to prevent email enumeration attacks.
    """
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if user:
        # Here we would normally generate a reset token and trigger sendgrid/AWS SES
        pass
        
    return {"message": "If an account exists with that email, a password reset link has been sent."}

def check_username_available(db: Session, username: str) -> bool:
    """Returns True if the username is available, False if already taken."""
    existing = db.query(models.User).filter(
        models.User.username == username.lower()
    ).first()
    return existing is None
