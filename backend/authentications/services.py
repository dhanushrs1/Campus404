from fastapi import HTTPException, status
from authentications import schemas, security

# Mock User Database Table
# In a real app, this database query would be done via SQLAlchemy/Motor
USERS_DB = [
    {
        "id": 1,
        "username": "admin_dhanu",
        "email": "admin@campus404.com",
        "role": "admin",
        # Hashed value for "AdminPass123!" using bcrypt auto-scaling cost
        "hashed_password": security.get_password_hash("AdminPass123!") 
    },
    {
        "id": 2,
        "username": "student_john",
        "email": "john@campus404.com",
        "role": "student",
        # Hashed value for "StudentPass123!"
        "hashed_password": security.get_password_hash("StudentPass123!") 
    }
]

def authenticate_user(login_data: schemas.LoginRequest) -> dict:
    # Look up user by email or username
    user = next((u for u in USERS_DB if u["email"] == login_data.identifier or u["username"] == login_data.identifier), None)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Securely verify password
    if not security.verify_password(login_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user

def process_forgot_password(email: str):
    """
    Simulates sending a forgot password email.
    We don't raise a 404 if the user isn't found to prevent email enumeration attacks.
    """
    user = next((u for u in USERS_DB if u["email"] == email), None)
    
    if user:
        # Here we would normally generate a reset token and trigger sendgrid/AWS SES
        pass
        
    return {"message": "If an account exists with that email, a password reset link has been sent."}
