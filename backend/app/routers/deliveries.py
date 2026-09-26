import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.delivery import DeliveryOrder, DeliveryLine, DELIVERY_STATUSES
from backend.app.models.product import Product
from backend.app.schemas.delivery import (
    DeliveryCreate,
    DeliveryResponse,
    DeliveryLineResponse,
    DeliveryLineCreate,
    DeliveryStatusUpdate,
)

router = APIRouter(prefix="/api/deliveries", tags=["Deliveries"])

_NEXT_STATUS = {
    "DRAFT": "PICKED",
    "PICKED": "PACKED",
}


def _gen_ref() -> str:
    return "DEL-" + uuid.uuid4().hex[:8].upper()


def _build_response(delivery: DeliveryOrder, include_lines: bool = True) -> DeliveryResponse:
    lines = None
    if include_lines:
        lines = [
            DeliveryLineResponse(
                id=line.id,
                delivery_id=line.delivery_id,
                product_id=line.product_id,
                product_name=line.product.name if line.product else None,
                product_sku=line.product.sku if line.product else None,
                quantity=line.quantity,
            )
            for line in delivery.lines
        ]
    return DeliveryResponse(
        id=delivery.id,
        reference=delivery.reference,
        customer_name=delivery.customer_name,
        status=delivery.status,
        notes=delivery.notes,
        created_at=delivery.created_at,
        validated_at=delivery.validated_at,
        lines=lines,
    )


# ---------------------------------------------------------------------------
# POST /api/deliveries — create
# ---------------------------------------------------------------------------

@router.post("", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
def create_delivery(payload: DeliveryCreate, db: Session = Depends(get_db)):
    """Create a new delivery order in DRAFT status."""
    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one product line is required.",
        )

    line_objects = []
    for line in payload.lines:
        if line.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quantity must be greater than 0.",
            )
        product = db.query(Product).filter(Product.id == line.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {line.product_id} not found.",
            )
        line_objects.append(
            DeliveryLine(product_id=line.product_id, quantity=line.quantity)
        )

    delivery = DeliveryOrder(
        reference=_gen_ref(),
        customer_name=payload.customer_name,
        notes=payload.notes,
        status="DRAFT",
    )
    delivery.lines = line_objects
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return _build_response(delivery)


# ---------------------------------------------------------------------------
# GET /api/deliveries — list
# ---------------------------------------------------------------------------

@router.get("", response_model=List[DeliveryResponse])
def list_deliveries(db: Session = Depends(get_db)):
    """Return all delivery orders, newest first."""
    deliveries = (
        db.query(DeliveryOrder)
        .order_by(DeliveryOrder.created_at.desc())
        .all()
    )
    return [_build_response(d, include_lines=False) for d in deliveries]


# ---------------------------------------------------------------------------
# GET /api/deliveries/{id} — detail
# ---------------------------------------------------------------------------

@router.get("/{delivery_id}", response_model=DeliveryResponse)
def get_delivery(delivery_id: int, db: Session = Depends(get_db)):
    """Return a single delivery with its lines."""
    delivery = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery {delivery_id} not found.",
        )
    return _build_response(delivery)


# ---------------------------------------------------------------------------
# PATCH /api/deliveries/{id}/status — advance status (DRAFT→PICKED→PACKED)
# ---------------------------------------------------------------------------

@router.patch("/{delivery_id}/status", response_model=DeliveryResponse)
def advance_delivery_status(
    delivery_id: int,
    payload: Optional[DeliveryStatusUpdate] = None,
    db: Session = Depends(get_db),
):
    """
    Advance delivery status: DRAFT -> PICKED -> PACKED.
    Validates legal status transitions. VALIDATED can only be reached via POST /validate.
    """
    delivery = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery {delivery_id} not found.",
        )

    if delivery.status == "VALIDATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery is already VALIDATED.",
        )

    if payload is not None and payload.status:
        target = payload.status.upper()
        if delivery.status == "PACKED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery is already PACKED. Use POST /validate to validate it.",
            )
        if delivery.status == "DRAFT":
            if target != "PICKED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status transition: Cannot transition from DRAFT to {target}. Must transition to PICKED first.",
                )
            next_status = "PICKED"
        elif delivery.status == "PICKED":
            if target != "PACKED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status transition: Cannot transition from PICKED to {target}. Must transition to PACKED.",
                )
            next_status = "PACKED"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from status '{delivery.status}'.",
            )
    else:
        if delivery.status == "PACKED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery is PACKED — use POST /validate to validate it.",
            )
        next_status = _NEXT_STATUS.get(delivery.status)
        if not next_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot advance from status '{delivery.status}'.",
            )

    delivery.status = next_status
    db.commit()
    db.refresh(delivery)
    return _build_response(delivery)


# ---------------------------------------------------------------------------
# POST /api/deliveries/{id}/validate — validate (decrements stock)
# ---------------------------------------------------------------------------

@router.post("/{delivery_id}/validate", response_model=DeliveryResponse)
def validate_delivery(delivery_id: int, db: Session = Depends(get_db)):
    """
    Validate delivery: PACKED -> VALIDATED.
    Decrements Product.current_stock for each line inside an atomic DB transaction.
    Guards:
    - Must not already be VALIDATED (idempotency guard).
    - Delivery must be in PACKED status.
    - All lines must have sufficient stock (pre-flight verified before any decrement).
    - Quantity must be > 0.
    """
    delivery = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery {delivery_id} not found.",
        )

    # Idempotent guard: prevent double validation
    if delivery.status == "VALIDATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery is already VALIDATED. Stock has NOT been decremented again.",
        )

    # Status workflow guard
    if delivery.status != "PACKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition: Delivery must be in PACKED status to validate. Current status is '{delivery.status}'.",
        )

    if not delivery.lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery has no product lines.",
        )

    # Pre-flight: check all lines before touching any stock
    for line in delivery.lines:
        if line.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid quantity {line.quantity} on line {line.id}.",
            )
        product = db.query(Product).filter(Product.id == line.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {line.product_id} not found.",
            )
        if product.current_stock < line.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for '{product.name}' (SKU: {product.sku}). "
                    f"Available: {product.current_stock}, Requested: {line.quantity}"
                ),
            )

    # Commit stock decrements atomically inside a transaction
    try:
        for line in delivery.lines:
            product = db.query(Product).filter(Product.id == line.product_id).first()
            product.current_stock = round(product.current_stock - line.quantity, 6)

        delivery.status = "VALIDATED"
        delivery.validated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(delivery)
        return _build_response(delivery)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate delivery transaction: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# POST /api/deliveries/{id}/lines — add line to DRAFT delivery
# ---------------------------------------------------------------------------

@router.post("/{delivery_id}/lines", response_model=DeliveryLineResponse, status_code=201)
def add_delivery_line(
    delivery_id: int, payload: DeliveryLineCreate, db: Session = Depends(get_db)
):
    """Add a product line to a DRAFT delivery."""
    delivery = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found.")
    if delivery.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail="Lines can only be added to DRAFT deliveries.",
        )

    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {payload.product_id} not found.")
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be > 0.")

    line = DeliveryLine(
        delivery_id=delivery_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
    )
    db.add(line)
    db.commit()
    db.refresh(line)
    return DeliveryLineResponse(
        id=line.id,
        delivery_id=line.delivery_id,
        product_id=line.product_id,
        product_name=line.product.name if line.product else None,
        product_sku=line.product.sku if line.product else None,
        quantity=line.quantity,
    )
