from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    generate_otp,
)
from app.models.user import User
from app.schemas.user import UserSignup, UserLogin


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieve a user by their email address."""
    return db.query(User).filter(User.email == email.lower().strip()).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Retrieve a user by their ID."""
    return db.query(User).filter(User.id == user_id).first()


def signup_user(db: Session, signup_data: UserSignup) -> User:
    """Register a new user in the system."""
    normalized_email = signup_data.email.lower().strip()
    
    existing_user = get_user_by_email(db, normalized_email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )
    
    hashed_pwd = hash_password(signup_data.password)
    new_user = User(
        name=signup_data.name.strip(),
        email=normalized_email,
        password_hash=hashed_pwd,
        role=signup_data.role.value if hasattr(signup_data.role, 'value') else str(signup_data.role),
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def authenticate_user(db: Session, login_data: UserLogin) -> User:
    """Authenticate a user using their email and password."""
    normalized_email = login_data.email.lower().strip()
    user = get_user_by_email(db, normalized_email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user


def initiate_password_reset(db: Session, email: str) -> str:
    """
    Generate and save an OTP for password reset.
    Returns the generated OTP (modular foundation for email/SMS gateway).
    """
    normalized_email = email.lower().strip()
    user = get_user_by_email(db, normalized_email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account registered with this email address.",
        )
    
    otp = generate_otp(6)
    user.reset_otp = otp
    user.reset_otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    db.commit()
    
    # In production, dispatch OTP via SMTP / Twilio / SendGrid here.
    return otp


def complete_password_reset(db: Session, email: str, otp: str, new_password: str) -> bool:
    """Validate OTP and update user password."""
    normalized_email = email.lower().strip()
    user = get_user_by_email(db, normalized_email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account registered with this email address.",
        )
        
    if not user.reset_otp or user.reset_otp != otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or incorrect OTP code.",
        )
        
    now = datetime.now(timezone.utc)
    if not user.reset_otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new one.",
        )
        
    # Handle timezone-aware or naive comparison safely
    expires_at = user.reset_otp_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if now > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new one.",
        )
        
    user.password_hash = hash_password(new_password)
    user.reset_otp = None
    user.reset_otp_expires_at = None
    db.commit()
    return True
