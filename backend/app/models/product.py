from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from backend.app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    unit_of_measure = Column(String(50), nullable=False)
    current_stock = Column(Float, nullable=False, default=0.0)
    initial_stock = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
