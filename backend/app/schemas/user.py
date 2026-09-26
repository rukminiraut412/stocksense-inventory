from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator


class UserRole(str, Enum):
    INVENTORY_MANAGER = "inventory_manager"
    WAREHOUSE_STAFF = "warehouse_staff"


class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Full name of user")
    email: EmailStr = Field(..., description="Valid corporate or user email address")


class UserSignup(UserBase):
    password: str = Field(..., min_length=6, max_length=128, description="Plaintext password, minimum 6 characters")
    role: UserRole = Field(default=UserRole.INVENTORY_MANAGER, description="Assigned role")


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    dev_otp: Optional[str] = None  # Included in development mode for easy hackathon testing


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=10)
    new_password: str = Field(..., min_length=6, max_length=128)


class ResetPasswordResponse(BaseModel):
    message: str
