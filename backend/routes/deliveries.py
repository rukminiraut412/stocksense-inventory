from flask import Blueprint, request, jsonify
from extensions import db
from models.delivery import DeliveryOrder, DeliveryLine, DELIVERY_STATUSES
from models.product import Product
from datetime import datetime
import uuid

deliveries_bp = Blueprint("deliveries", __name__)

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _next_status(current):
    idx = DELIVERY_STATUSES.index(current)
    if idx < len(DELIVERY_STATUSES) - 1:
        return DELIVERY_STATUSES[idx + 1]
    return None


def _generate_ref():
    return "DEL-" + uuid.uuid4().hex[:8].upper()


# ---------------------------------------------------------------------------
# POST /api/deliveries  – create
# ---------------------------------------------------------------------------

@deliveries_bp.route("", methods=["POST"])
def create_delivery():
    data = request.get_json(force=True) or {}
    customer_name = data.get("customer_name", "")
    notes = data.get("notes", "")
    lines_data = data.get("lines", [])

    if not lines_data:
        return jsonify({"error": "At least one product line is required."}), 400

    # validate lines
    line_objects = []
    for line in lines_data:
        product_id = line.get("product_id")
        quantity = line.get("quantity")

        if not product_id:
            return jsonify({"error": "Each line must have a product_id."}), 400
        if not quantity or float(quantity) <= 0:
            return jsonify({"error": "Quantity must be positive."}), 400

        product = db.session.get(Product, product_id)
        if not product:
            return jsonify({"error": f"Product {product_id} not found."}), 404

        line_objects.append(
            DeliveryLine(product_id=product_id, quantity=float(quantity))
        )

    delivery = DeliveryOrder(
        reference=_generate_ref(),
        customer_name=customer_name,
        notes=notes,
        status="DRAFT",
    )
    delivery.lines = line_objects
    db.session.add(delivery)
    db.session.commit()

    return jsonify(delivery.to_dict(include_lines=True)), 201


# ---------------------------------------------------------------------------
# GET /api/deliveries  – list
# ---------------------------------------------------------------------------

@deliveries_bp.route("", methods=["GET"])
def list_deliveries():
    deliveries = DeliveryOrder.query.order_by(DeliveryOrder.created_at.desc()).all()
    return jsonify([d.to_dict() for d in deliveries])


# ---------------------------------------------------------------------------
# GET /api/deliveries/<id>  – detail
# ---------------------------------------------------------------------------

@deliveries_bp.route("/<int:delivery_id>", methods=["GET"])
def get_delivery(delivery_id):
    delivery = db.session.get(DeliveryOrder, delivery_id)
    if not delivery:
        return jsonify({"error": "Delivery not found."}), 404
    return jsonify(delivery.to_dict(include_lines=True))


# ---------------------------------------------------------------------------
# PATCH /api/deliveries/<id>/status  – advance status (DRAFT→PICKED→PACKED)
# ---------------------------------------------------------------------------

@deliveries_bp.route("/<int:delivery_id>/status", methods=["PATCH"])
def update_delivery_status(delivery_id):
    delivery = db.session.get(DeliveryOrder, delivery_id)
    if not delivery:
        return jsonify({"error": "Delivery not found."}), 404

    if delivery.status == "VALIDATED":
        return jsonify({"error": "Delivery is already validated."}), 400

    next_status = _next_status(delivery.status)
    if next_status == "VALIDATED":
        return jsonify(
            {"error": "Use POST /validate to validate a delivery."}
        ), 400

    if next_status is None:
        return jsonify({"error": "Delivery is already at final status."}), 400

    delivery.status = next_status
    db.session.commit()
    return jsonify(delivery.to_dict(include_lines=True))


# ---------------------------------------------------------------------------
# POST /api/deliveries/<id>/validate  – validate delivery (decrements stock)
# ---------------------------------------------------------------------------

@deliveries_bp.route("/<int:delivery_id>/validate", methods=["POST"])
def validate_delivery(delivery_id):
    delivery = db.session.get(DeliveryOrder, delivery_id)
    if not delivery:
        return jsonify({"error": "Delivery not found."}), 404

    # Guard: prevent double-validation
    if delivery.status == "VALIDATED":
        return jsonify(
            {"error": "Delivery is already validated. Stock has not changed."}
        ), 400

    if not delivery.lines:
        return jsonify({"error": "Delivery has no product lines."}), 400

    # --- Pre-validation: check every line has sufficient stock ---
    for line in delivery.lines:
        product = db.session.get(Product, line.product_id)
        if not product:
            return jsonify({"error": f"Product {line.product_id} not found."}), 404
        if product.current_stock < line.quantity:
            return jsonify(
                {
                    "error": (
                        f"Insufficient stock for product '{product.name}'. "
                        f"Available: {product.current_stock}, Requested: {line.quantity}"
                    )
                }
            ), 400

    # --- Decrement stock atomically per line ---
    for line in delivery.lines:
        product = db.session.get(Product, line.product_id)
        product.current_stock -= line.quantity

    delivery.status = "VALIDATED"
    delivery.validated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(
        {
            "message": "Delivery validated successfully. Stock decremented.",
            "delivery": delivery.to_dict(include_lines=True),
        }
    )


# ---------------------------------------------------------------------------
# POST /api/deliveries/<id>/lines  – add a line to a DRAFT delivery
# ---------------------------------------------------------------------------

@deliveries_bp.route("/<int:delivery_id>/lines", methods=["POST"])
def add_delivery_line(delivery_id):
    delivery = db.session.get(DeliveryOrder, delivery_id)
    if not delivery:
        return jsonify({"error": "Delivery not found."}), 404

    if delivery.status != "DRAFT":
        return jsonify({"error": "Lines can only be added to DRAFT deliveries."}), 400

    data = request.get_json(force=True) or {}
    product_id = data.get("product_id")
    quantity = data.get("quantity")

    if not product_id:
        return jsonify({"error": "product_id is required."}), 400
    if not quantity or float(quantity) <= 0:
        return jsonify({"error": "Quantity must be positive."}), 400

    product = db.session.get(Product, product_id)
    if not product:
        return jsonify({"error": f"Product {product_id} not found."}), 404

    line = DeliveryLine(
        delivery_id=delivery_id,
        product_id=product_id,
        quantity=float(quantity),
    )
    db.session.add(line)
    db.session.commit()
    return jsonify(line.to_dict()), 201
