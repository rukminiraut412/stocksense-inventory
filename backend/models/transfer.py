from extensions import db
from datetime import datetime

TRANSFER_STATUSES = ["DRAFT", "VALIDATED"]


class InternalTransfer(db.Model):
    """
    Moves stock of a product from one location to another.
    Validation atomically decrements source and increments destination.
    Total company stock (Product.current_stock) stays unchanged.
    """
    __tablename__ = "internal_transfers"

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(100), unique=True, nullable=False)
    source_location_id = db.Column(
        db.Integer, db.ForeignKey("locations.id"), nullable=False
    )
    destination_location_id = db.Column(
        db.Integer, db.ForeignKey("locations.id"), nullable=False
    )
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id"), nullable=False
    )
    quantity = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default="DRAFT", nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    validated_at = db.Column(db.DateTime, nullable=True)

    # relationships
    source_location = db.relationship(
        "Location", foreign_keys=[source_location_id]
    )
    destination_location = db.relationship(
        "Location", foreign_keys=[destination_location_id]
    )
    product = db.relationship("Product")

    def to_dict(self):
        return {
            "id": self.id,
            "reference": self.reference,
            "source_location_id": self.source_location_id,
            "source_location_name": (
                self.source_location.name if self.source_location else None
            ),
            "destination_location_id": self.destination_location_id,
            "destination_location_name": (
                self.destination_location.name if self.destination_location else None
            ),
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "quantity": self.quantity,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "validated_at": self.validated_at.isoformat() if self.validated_at else None,
        }
