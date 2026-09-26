from extensions import db
from datetime import datetime

# Delivery status lifecycle
DELIVERY_STATUSES = ["DRAFT", "PICKED", "PACKED", "VALIDATED"]


class DeliveryOrder(db.Model):
    """
    A delivery order moves stock from the warehouse to a customer.
    Status lifecycle: DRAFT → PICKED → PACKED → VALIDATED.
    Stock decreases ONLY when status transitions to VALIDATED.
    """
    __tablename__ = "delivery_orders"

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(100), unique=True, nullable=False)
    customer_name = db.Column(db.String(200))
    status = db.Column(db.String(20), default="DRAFT", nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    validated_at = db.Column(db.DateTime, nullable=True)

    # relationships
    lines = db.relationship(
        "DeliveryLine", back_populates="delivery", cascade="all, delete-orphan"
    )

    def to_dict(self, include_lines=False):
        data = {
            "id": self.id,
            "reference": self.reference,
            "customer_name": self.customer_name,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "validated_at": self.validated_at.isoformat() if self.validated_at else None,
        }
        if include_lines:
            data["lines"] = [l.to_dict() for l in self.lines]
        return data


class DeliveryLine(db.Model):
    """
    One product line inside a delivery order.
    """
    __tablename__ = "delivery_lines"

    id = db.Column(db.Integer, primary_key=True)
    delivery_id = db.Column(
        db.Integer, db.ForeignKey("delivery_orders.id"), nullable=False
    )
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id"), nullable=False
    )
    quantity = db.Column(db.Float, nullable=False)

    # relationships
    delivery = db.relationship("DeliveryOrder", back_populates="lines")
    product = db.relationship("Product")

    def to_dict(self):
        return {
            "id": self.id,
            "delivery_id": self.delivery_id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "product_sku": self.product.sku if self.product else None,
            "quantity": self.quantity,
        }
