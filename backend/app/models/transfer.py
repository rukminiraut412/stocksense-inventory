from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class InternalTransfer(Base):
    """
    Moves stock of a product between two warehouse locations.
    On VALIDATED:
        source warehouse stock_levels.quantity  -= quantity
        destination warehouse stock_levels.quantity += quantity
    Product.current_stock (total) is NOT changed — invariant maintained.
    Cannot be validated twice.
    """
    __tablename__ = "internal_transfers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reference = Column(String(50), unique=True, nullable=False, index=True)
    # FK to warehouses table (owned by Team 4 / shared schema)
    source_warehouse_id = Column(
        Integer, ForeignKey("warehouses.id"), nullable=False
    )
    destination_warehouse_id = Column(
        Integer, ForeignKey("warehouses.id"), nullable=False
    )
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="DRAFT", index=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    validated_at = Column(DateTime(timezone=True), nullable=True)

    source_warehouse = relationship(
        "Warehouse", foreign_keys=[source_warehouse_id]
    )
    destination_warehouse = relationship(
        "Warehouse", foreign_keys=[destination_warehouse_id]
    )
    product = relationship("backend.app.models.product.Product")


class Warehouse(Base):
    """
    Warehouse / storage location.
    This model mirrors the warehouses table created by Team 4 (adjustment-ledger).
    We declare it here so SQLAlchemy can resolve FK references on our branch.
    Team 4 owns the write logic for this table; we only READ from it.
    """
    __tablename__ = "warehouses"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    created_at = Column(String(50), nullable=True)


class StockLevel(Base):
    """
    Per-product, per-warehouse stock quantity.
    Mirrors stock_levels table from Team 4.
    We READ source stock and WRITE both source and destination on transfer validation.
    """
    __tablename__ = "stock_levels"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    updated_at = Column(String(50), nullable=True)
