import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.app.database import get_db
from backend.app.models.transfer import InternalTransfer, Warehouse, StockLevel
from backend.app.models.product import Product
from backend.app.schemas.transfer import (
    TransferCreate,
    TransferResponse,
    WarehouseResponse,
)

router = APIRouter(tags=["Transfers"])


def _gen_ref() -> str:
    return "TRF-" + uuid.uuid4().hex[:8].upper()


def _get_or_create_stock_level(
    db: Session, product_id: int, warehouse_id: int
) -> StockLevel:
    """Return existing StockLevel row, or create one with 0 qty if absent."""
    entry = db.query(StockLevel).filter(
        and_(
            StockLevel.product_id == product_id,
            StockLevel.warehouse_id == warehouse_id,
        )
    ).first()
    if not entry:
        entry = StockLevel(
            product_id=product_id, warehouse_id=warehouse_id, quantity=0.0
        )
        db.add(entry)
        db.flush()
    return entry


def _build_response(t: InternalTransfer) -> TransferResponse:
    src_name = t.source_warehouse.name if t.source_warehouse else None
    dst_name = t.destination_warehouse.name if t.destination_warehouse else None
    return TransferResponse(
        id=t.id,
        reference=t.reference,
        source_warehouse_id=t.source_warehouse_id,
        source_location_id=t.source_warehouse_id,
        source_warehouse_name=src_name,
        source_location_name=src_name,
        destination_warehouse_id=t.destination_warehouse_id,
        destination_location_id=t.destination_warehouse_id,
        destination_warehouse_name=dst_name,
        destination_location_name=dst_name,
        product_id=t.product_id,
        product_name=t.product.name if t.product else None,
        product_sku=t.product.sku if t.product else None,
        quantity=t.quantity,
        status=t.status,
        notes=t.notes,
        created_at=t.created_at,
        validated_at=t.validated_at,
    )


# ---------------------------------------------------------------------------
# GET /api/warehouses & /api/transfers/warehouses & /api/locations
# ---------------------------------------------------------------------------

@router.get("/api/transfers/warehouses", response_model=List[WarehouseResponse], tags=["Warehouses"])
@router.get("/api/warehouses", response_model=List[WarehouseResponse], tags=["Warehouses"])
@router.get("/api/locations", response_model=List[WarehouseResponse], tags=["Warehouses"])
def list_warehouses(db: Session = Depends(get_db)):
    """List all warehouses / locations available for transfers."""
    return db.query(Warehouse).order_by(Warehouse.name.asc()).all()


@router.post("/api/transfers/warehouses", response_model=WarehouseResponse, status_code=201, tags=["Warehouses"])
@router.post("/api/warehouses", response_model=WarehouseResponse, status_code=201, tags=["Warehouses"])
@router.post("/api/locations", response_model=WarehouseResponse, status_code=201, tags=["Warehouses"])
def create_warehouse(
    name: str,
    code: str,
    location: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Create a new warehouse location (for seeding / integration)."""
    existing = db.query(Warehouse).filter(Warehouse.code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Warehouse code '{code}' already exists.")
    wh = Warehouse(code=code, name=name, location=location)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


# ---------------------------------------------------------------------------
# GET & POST /api/transfers/stock-levels — query & seed warehouse stock levels
# ---------------------------------------------------------------------------

@router.post("/api/transfers/stock-levels", status_code=200, tags=["Transfers"])
def set_stock_level(
    product_id: int,
    warehouse_id: int,
    quantity: float,
    db: Session = Depends(get_db),
):
    """Seed or update stock level for a product in a warehouse."""
    entry = _get_or_create_stock_level(db, product_id, warehouse_id)
    entry.quantity = quantity
    db.commit()
    db.refresh(entry)
    return {"product_id": entry.product_id, "warehouse_id": entry.warehouse_id, "quantity": entry.quantity}


@router.get("/api/transfers/stock-levels", status_code=200, tags=["Transfers"])
def get_stock_level(
    product_id: int,
    warehouse_id: int,
    db: Session = Depends(get_db),
):
    """Get stock level for a product in a warehouse."""
    entry = _get_or_create_stock_level(db, product_id, warehouse_id)
    return {"product_id": entry.product_id, "warehouse_id": entry.warehouse_id, "quantity": entry.quantity}


# ---------------------------------------------------------------------------
# POST /api/transfers — create
# ---------------------------------------------------------------------------

@router.post("/api/transfers", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
def create_transfer(payload: TransferCreate, db: Session = Depends(get_db)):
    """Create an internal stock transfer between two warehouses."""
    src_id = payload.get_source_id()
    dst_id = payload.get_destination_id()

    # Same source/destination guard
    if src_id == dst_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination warehouses cannot be the same.",
        )

    if payload.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0.",
        )

    # Existence checks
    src = db.query(Warehouse).filter(Warehouse.id == src_id).first()
    if not src:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source warehouse {src_id} not found.",
        )
    dst = db.query(Warehouse).filter(Warehouse.id == dst_id).first()
    if not dst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination warehouse {dst_id} not found.",
        )
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {payload.product_id} not found.",
        )

    transfer = InternalTransfer(
        reference=_gen_ref(),
        source_warehouse_id=src_id,
        destination_warehouse_id=dst_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        notes=payload.notes,
        status="DRAFT",
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return _build_response(transfer)


# ---------------------------------------------------------------------------
# GET /api/transfers — list
# ---------------------------------------------------------------------------

@router.get("/api/transfers", response_model=List[TransferResponse])
def list_transfers(db: Session = Depends(get_db)):
    """Return all internal transfers, newest first."""
    transfers = (
        db.query(InternalTransfer)
        .order_by(InternalTransfer.created_at.desc())
        .all()
    )
    return [_build_response(t) for t in transfers]


# ---------------------------------------------------------------------------
# GET /api/transfers/{id} — detail
# ---------------------------------------------------------------------------

@router.get("/api/transfers/{transfer_id}", response_model=TransferResponse)
def get_transfer(transfer_id: int, db: Session = Depends(get_db)):
    """Return a single transfer."""
    t = db.query(InternalTransfer).filter(InternalTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transfer {transfer_id} not found.",
        )
    return _build_response(t)


# ---------------------------------------------------------------------------
# POST /api/transfers/{id}/validate — validate (atomic stock move)
# ---------------------------------------------------------------------------

@router.post("/api/transfers/{transfer_id}/validate", response_model=TransferResponse)
def validate_transfer(transfer_id: int, db: Session = Depends(get_db)):
    """
    Validate transfer: atomically move stock from source to destination warehouse.

    Invariant: Product.current_stock (total) does NOT change.
    Only stock_levels rows are updated.

    Guards:
    - Cannot validate twice.
    - Source and destination must differ.
    - Source warehouse must have sufficient stock.
    - Quantity must be > 0.
    """
    t = db.query(InternalTransfer).filter(InternalTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transfer {transfer_id} not found.",
        )

    # Double-validation guard
    if t.status == "VALIDATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer is already VALIDATED. Stock has NOT moved again.",
        )

    if t.source_warehouse_id == t.destination_warehouse_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination warehouses cannot be the same.",
        )

    if t.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer quantity must be > 0.",
        )

    # Check warehouses and product still exist
    src = db.query(Warehouse).filter(Warehouse.id == t.source_warehouse_id).first()
    dst = db.query(Warehouse).filter(Warehouse.id == t.destination_warehouse_id).first()
    product = db.query(Product).filter(Product.id == t.product_id).first()

    if not src:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source warehouse no longer exists.")
    if not dst:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination warehouse no longer exists.")
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product no longer exists.")

    try:
        # Check source has enough stock
        src_level = _get_or_create_stock_level(db, t.product_id, t.source_warehouse_id)
        if src_level.quantity < t.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock at '{src.name}'. "
                    f"Available: {src_level.quantity}, Requested: {t.quantity}"
                ),
            )

        # Atomic stock move — Product.current_stock NOT touched (total invariant)
        dst_level = _get_or_create_stock_level(db, t.product_id, t.destination_warehouse_id)
        src_level.quantity = round(src_level.quantity - t.quantity, 6)
        dst_level.quantity = round(dst_level.quantity + t.quantity, 6)

        t.status = "VALIDATED"
        t.validated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(t)
        return _build_response(t)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate transfer transaction: {str(exc)}",
        )
