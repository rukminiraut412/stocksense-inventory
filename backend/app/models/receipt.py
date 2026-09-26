from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    receipt_number = Column(String(50), unique=True, nullable=False, index=True)
    supplier = Column(String(255), nullable=False)
    status = Column(String(20, collation="NOCASE"), nullable=False, default="DRAFT", index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    validated_at = Column(DateTime(timezone=True), nullable=True)

    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)

    receipt = relationship("Receipt", back_populates="items")
    product = relationship("Product")
