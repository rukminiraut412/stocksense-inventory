from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from backend.app.database import get_db
from backend.app.models.product import Product
from backend.app.models.receipt import Receipt, ReceiptItem
from backend.app.schemas.receipt import (
    ReceiptCreate,
    ReceiptResponse,
    ReceiptItemResponse
)

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])


def utcnow():
    return datetime.now(timezone.utc)


def format_receipt_response(receipt: Receipt) -> ReceiptResponse:
    item_responses = []
    for item in receipt.items:
        item_responses.append(
            ReceiptItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else "Unknown",
                product_sku=item.product.sku if item.product else "Unknown",
                quantity=item.quantity
            )
        )
    return ReceiptResponse(
        id=receipt.id,
        receipt_number=receipt.receipt_number,
        supplier=receipt.supplier,
        status=receipt.status,
        created_at=receipt.created_at,
        validated_at=receipt.validated_at,
        items=item_responses,
        items_count=len(receipt.items)
    )


def generate_receipt_number(db: Session) -> str:
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    count_today = db.query(Receipt).filter(Receipt.receipt_number.like(f"REC-{today_str}-%")).count()
    return f"REC-{today_str}-{(count_today + 1):04d}"


@router.post("", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_receipt(receipt_in: ReceiptCreate, db: Session = Depends(get_db)):
    """Create a new receipt in DRAFT status. Stock is NOT increased until validation."""
    if not receipt_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt must contain at least one line item."
        )

    # Validate all items have positive quantities and products exist
    for item in receipt_in.items:
        if item.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item quantity must be strictly positive (> 0). Given: {item.quantity}"
            )
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with ID {item.product_id} does not exist."
            )

    receipt_number = generate_receipt_number(db)
    receipt = Receipt(
        receipt_number=receipt_number,
        supplier=receipt_in.supplier,
        status="DRAFT"
    )
    try:
        db.add(receipt)
        db.flush()  # obtain receipt.id

        for item in receipt_in.items:
            db_item = ReceiptItem(
                receipt_id=receipt.id,
                product_id=item.product_id,
                quantity=item.quantity
            )
            db.add(db_item)

        db.commit()
        db.refresh(receipt)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create receipt: {str(exc)}"
        )
    return format_receipt_response(receipt)


@router.get("", response_model=List[ReceiptResponse])
def list_receipts(
    product_id: Optional[int] = Query(None, description="Filter receipts by product ID"),
    db: Session = Depends(get_db)
):
    """List all receipts ordered by latest first."""
    query = db.query(Receipt).options(
        joinedload(Receipt.items).joinedload(ReceiptItem.product)
    )
    if product_id is not None:
        query = query.filter(Receipt.items.any(ReceiptItem.product_id == product_id))

    receipts = query.order_by(Receipt.id.desc()).all()
    return [format_receipt_response(r) for r in receipts]


@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    """Get details of a specific receipt."""
    receipt = db.query(Receipt).options(
        joinedload(Receipt.items).joinedload(ReceiptItem.product)
    ).filter(Receipt.id == receipt_id).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt with ID {receipt_id} not found."
        )

    return format_receipt_response(receipt)


@router.post("/{receipt_id}/validate", response_model=ReceiptResponse)
def validate_receipt(receipt_id: int, db: Session = Depends(get_db)):
    """
    Validate a receipt:
    - Moves status from DRAFT -> VALIDATED
    - Increases product stock: current_stock = current_stock + received_quantity
    - Idempotent/Strict: Cannot be validated twice (returns 400).
    - Consistency: Executed within an atomic transaction.
    """
    try:
        receipt = db.query(Receipt).options(
            joinedload(Receipt.items)
        ).filter(Receipt.id == receipt_id).with_for_update(nowait=False).first()
    except Exception:
        # For SQLite without row-level lock support, standard query
        receipt = db.query(Receipt).options(
            joinedload(Receipt.items)
        ).filter(Receipt.id == receipt_id).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt with ID {receipt_id} not found."
        )

    if receipt.status == "VALIDATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Receipt {receipt.receipt_number} is already validated. Duplicate validation is not allowed."
        )

    if receipt.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Receipt cannot be validated from status '{receipt.status}'."
        )

    if not receipt.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot validate a receipt with no items."
        )

    # Perform stock increment within transaction atomically
    try:
        for item in receipt.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product with ID {item.product_id} no longer exists. Validation aborted."
                )
            # Increase current stock
            product.current_stock += item.quantity

        receipt.status = "VALIDATED"
        receipt.validated_at = utcnow()

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed due to database transaction error: {str(exc)}"
        )

    db.refresh(receipt)
    return format_receipt_response(receipt)
