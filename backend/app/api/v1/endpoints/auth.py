from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.user import (
    UserSignup,
    UserLogin,
    UserResponse,
    Token,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.services.auth_service import (
    signup_user,
    authenticate_user,
    initiate_password_reset,
    complete_password_reset,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def signup(signup_data: UserSignup, db: Session = Depends(get_db)):
    """
    Register a new user with full validation.
    Returns the user data and an initial JWT access token.
    """
    user = signup_user(db, signup_data)
    access_token = create_access_token(subject=user.id, role=user.role)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=Token,
    summary="Authenticate existing user and retrieve JWT token",
)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate with email and password.
    Returns a signed JWT access token and sanitized user profile.
    """
    user = authenticate_user(db, login_data)
    access_token = create_access_token(subject=user.id, role=user.role)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Fetch the currently authenticated user's profile.
    Excludes password_hash and internal security secrets.
    """
    return UserResponse.model_validate(current_user)


@router.post(
    "/logout",
    summary="Sign out current user and terminate session",
)
def logout(current_user: User = Depends(get_current_user)):
    """
    Logout endpoint for the authenticated session.
    Clients should clear their local token store.
    """
    return {
        "status": "success",
        "message": f"User {current_user.email} successfully logged out.",
    }


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Initiate OTP-based password reset",
)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Request a 6-digit OTP code for resetting forgotten password.
    In development mode, the OTP is returned in the response for seamless testing.
    """
    otp = initiate_password_reset(db, req.email)
    
    # In development mode, provide dev_otp so tests and demo users can test without email setup
    dev_otp = otp if settings.ENVIRONMENT == "development" else None
    
    return ForgotPasswordResponse(
        message=f"Password reset OTP has been generated. Expires in {settings.OTP_EXPIRE_MINUTES} minutes.",
        dev_otp=dev_otp,
    )


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    summary="Complete password reset using verified OTP",
)
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Verify the 6-digit OTP code and securely update to the new password.
    """
    complete_password_reset(
        db,
        email=req.email,
        otp=req.otp,
        new_password=req.new_password,
    )
    return ResetPasswordResponse(
        message="Password has been reset successfully. You can now login with your new password."
    )
