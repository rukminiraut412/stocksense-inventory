from extensions import db
from datetime import datetime


class Location(db.Model):
    """
    Warehouse / storage location.
    Each location can hold stock for multiple products tracked via LocationStock.
    """
    __tablename__ = "locations"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    warehouse = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # relationships
    stock_entries = db.relationship(
        "LocationStock", back_populates="location", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "warehouse": self.warehouse,
            "created_at": self.created_at.isoformat(),
        }


class LocationStock(db.Model):
    """
    Per-product stock quantity at a specific location.
    Used exclusively by the Internal Transfer module to move stock
    between locations while keeping total company stock unchanged.
    """
    __tablename__ = "location_stock"

    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(
        db.Integer, db.ForeignKey("locations.id"), nullable=False
    )
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id"), nullable=False
    )
    quantity = db.Column(db.Float, default=0.0, nullable=False)

    # relationships
    location = db.relationship("Location", back_populates="stock_entries")
    product = db.relationship("Product")

    __table_args__ = (
        db.UniqueConstraint("location_id", "product_id", name="uq_location_product"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "location_id": self.location_id,
            "location_name": self.location.name if self.location else None,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "quantity": self.quantity,
        }
