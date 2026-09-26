from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.database import Base


def utcnow_str():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class Adjustment(Base):
    __tablename__ = "adjustments"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    recorded_quantity = Column(Float, nullable=False)
    physical_quantity = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)
    reason = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="APPLIED")
    created_by = Column(String(255), nullable=True, default="Inventory Specialist")
    created_at = Column(String(50), nullable=True, default=utcnow_str)
    client_reference = Column(String(100), nullable=True)

    product = relationship("backend.app.models.product.Product")
    warehouse = relationship("backend.app.models.transfer.Warehouse")


class StockLedger(Base):
    __tablename__ = "stock_ledger"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_name = Column(String(255), nullable=False)
    sku = Column(String(100), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    warehouse_name = Column(String(255), nullable=False)
    movement_type = Column(String(50), nullable=False)
    quantity = Column(Float, nullable=False)
    previous_stock = Column(Float, nullable=False)
    new_stock = Column(Float, nullable=False)
    reference_id = Column(String(100), nullable=True)
    user = Column(String(255), nullable=True, default="System")
    timestamp = Column(String(50), nullable=True, default=utcnow_str)
