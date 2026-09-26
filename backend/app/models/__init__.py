"""Shared database models package.

Teammates declare models using the shared Base:
    from app.core.database import Base
"""
from app.core.database import Base
from app.models.user import User
from app.models.product import Product
from app.models.receipt import Receipt, ReceiptItem

__all__ = ["Base", "User", "Product", "Receipt", "ReceiptItem"]
