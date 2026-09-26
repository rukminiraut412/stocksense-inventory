from flask import Blueprint, request, jsonify
from extensions import db
from models.transfer import InternalTransfer
from models.location import Location, LocationStock
from models.product import Product
from datetime import datetime
import uuid

transfers_bp = Blueprint("transfers", __name__)


def _generate_ref():
    return "TRF-" + uuid.uuid4().hex[:8].upper()


def _get_or_create_location_stock(location_id, product_id):
    """Return the LocationStock row, creating it with 0 qty if absent."""
    entry = LocationStock.query.filter_by(
        location_id=location_id, product_id=product_id
    ).first()
    if not entry:
        entry = LocationStock(location_id=location_id, product_id=product_id, quantity=0.0)
        db.session.add(entry)
        db.session.flush()  # get ID without committing
    return entry


# ---------------------------------------------------------------------------
# POST /api/transfers  – create
# ---------------------------------------------------------------------------

@transfers_bp.route("", methods=["POST"])
def create_transfer():
    data = request.get_json(force=True) or {}

    source_location_id = data.get("source_location_id")
    destination_location_id = data.get("destination_location_id")
    product_id = data.get("product_id")
    quantity = data.get("quantity")
    notes = data.get("notes", "")

    # --- basic validation ---
    if not all([source_location_id, destination_location_id, product_id, quantity]):
        return jsonify(
            {"error": "source_location_id, destination_location_id, product_id, and quantity are required."}
        ), 400

    quantity = float(quantity)
    if quantity <= 0:
        return jsonify({"error": "Quantity must be positive."}), 400

    if source_location_id == destination_location_id:
        return jsonify({"error": "Source and destination locations cannot be the same."}), 400

    # --- existence checks ---
    src = db.session.get(Location, source_location_id)
    if not src:
        return jsonify({"error": f"Source location {source_location_id} not found."}), 404

    dst = db.session.get(Location, destination_location_id)
    if not dst:
        return jsonify({"error": f"Destination location {destination_location_id} not found."}), 404

    product = db.session.get(Product, product_id)
    if not product:
        return jsonify({"error": f"Product {product_id} not found."}), 404

    transfer = InternalTransfer(
        reference=_generate_ref(),
        source_location_id=source_location_id,
        destination_location_id=destination_location_id,
        product_id=product_id,
        quantity=quantity,
        notes=notes,
        status="DRAFT",
    )
    db.session.add(transfer)
    db.session.commit()

    return jsonify(transfer.to_dict()), 201


# ---------------------------------------------------------------------------
# GET /api/transfers  – list
# ---------------------------------------------------------------------------

@transfers_bp.route("", methods=["GET"])
def list_transfers():
    transfers = InternalTransfer.query.order_by(InternalTransfer.created_at.desc()).all()
    return jsonify([t.to_dict() for t in transfers])


# ---------------------------------------------------------------------------
# GET /api/transfers/<id>  – detail
# ---------------------------------------------------------------------------

@transfers_bp.route("/<int:transfer_id>", methods=["GET"])
def get_transfer(transfer_id):
    transfer = db.session.get(InternalTransfer, transfer_id)
    if not transfer:
        return jsonify({"error": "Transfer not found."}), 404
    return jsonify(transfer.to_dict())


# ---------------------------------------------------------------------------
# POST /api/transfers/<id>/validate  – validate (atomic stock move)
# ---------------------------------------------------------------------------

@transfers_bp.route("/<int:transfer_id>/validate", methods=["POST"])
def validate_transfer(transfer_id):
    transfer = db.session.get(InternalTransfer, transfer_id)
    if not transfer:
        return jsonify({"error": "Transfer not found."}), 404

    # Guard: prevent double-validation
    if transfer.status == "VALIDATED":
        return jsonify(
            {"error": "Transfer is already validated. Stock has not changed."}
        ), 400

    # Existence checks (data may have been deleted since creation)
    src = db.session.get(Location, transfer.source_location_id)
    dst = db.session.get(Location, transfer.destination_location_id)
    product = db.session.get(Product, transfer.product_id)

    if not src:
        return jsonify({"error": "Source location no longer exists."}), 404
    if not dst:
        return jsonify({"error": "Destination location no longer exists."}), 404
    if not product:
        return jsonify({"error": "Product no longer exists."}), 404

    # Same-location guard (defensive, already checked on create)
    if transfer.source_location_id == transfer.destination_location_id:
        return jsonify({"error": "Source and destination cannot be the same."}), 400

    # --- Check source stock ---
    src_stock = _get_or_create_location_stock(
        transfer.source_location_id, transfer.product_id
    )
    if src_stock.quantity < transfer.quantity:
        return jsonify(
            {
                "error": (
                    f"Insufficient stock at source '{src.name}'. "
                    f"Available: {src_stock.quantity}, Requested: {transfer.quantity}"
                )
            }
        ), 400

    # --- Atomic stock move ---
    dst_stock = _get_or_create_location_stock(
        transfer.destination_location_id, transfer.product_id
    )

    src_stock.quantity -= transfer.quantity
    dst_stock.quantity += transfer.quantity
    # Product.current_stock is intentionally NOT changed (total stays same)

    transfer.status = "VALIDATED"
    transfer.validated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(
        {
            "message": "Transfer validated successfully. Stock moved atomically.",
            "transfer": transfer.to_dict(),
            "source_stock_after": src_stock.quantity,
            "destination_stock_after": dst_stock.quantity,
        }
    )
