from extensions import db
from datetime import datetime


class Product(db.Model):
    """
    Stub model – owned by Products team (Team Member 1/2).
    Defined here so that Delivery and Transfer modules can reference it
    via foreign keys without duplicating logic.
    """
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    sku = db.Column(db.String(100), unique=True, nullable=False)
    # current_stock tracks total company-wide stock (all locations combined)
    current_stock = db.Column(db.Float, default=0.0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "sku": self.sku,
            "current_stock": self.current_stock,
            "created_at": self.created_at.isoformat(),
        }
