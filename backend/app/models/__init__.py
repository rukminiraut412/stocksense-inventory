"""Shared database models package.

Teammates should import Base to declare their models:
    from app.core.database import Base
"""
from app.core.database import Base
from app.models.user import User

__all__ = ["Base", "User"]
