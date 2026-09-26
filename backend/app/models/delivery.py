from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

DELIVERY_STATUSES = ["DRAFT", "PICKED", "PACKED", "VALIDATED"]


def utcnow():
    return datetime.now(timezone.utc)


class DeliveryOrder(Base):
    """
    A delivery order ships stock from the warehouse to a customer.
    Status lifecycle: DRAFT -> PICKED -> PACKED -> VALIDATED.
    Stock (Product.current_stock) is decremented ONLY when VALIDATED.
    A validated delivery cannot be validated again.
    """
    __tablename__ = "delivery_orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reference = Column(String(50), unique=True, nullable=False, index=True)
    customer_name = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT", index=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    validated_at = Column(DateTime(timezone=True), nullable=True)

    lines = relationship(
        "DeliveryLine", back_populates="delivery", cascade="all, delete-orphan"
    )


class DeliveryLine(Base):
    """A single product-quantity line within a delivery order."""
    __tablename__ = "delivery_lines"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    delivery_id = Column(
        Integer, ForeignKey("delivery_orders.id", ondelete="CASCADE"), nullable=False
    )
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)

    delivery = relationship("DeliveryOrder", back_populates="lines")
    product = relationship("backend.app.models.product.Product")
