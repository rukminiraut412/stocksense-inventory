from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from backend.app.database import get_db
from backend.app.models.product import Product
from backend.app.models.transfer import Warehouse, StockLevel
from backend.app.models.adjustment import Adjustment, StockLedger
from backend.app.schemas.adjustment import (
    AdjustmentCreate,
    AdjustmentResponse,
    RecordedStockResponse,
)

router = APIRouter(tags=["Stock Adjustments"])


def _build_adjustment_response(adj: Adjustment) -> AdjustmentResponse:
    prod_name = adj.product.name if adj.product else None
    prod_sku = adj.product.sku if adj.product else None
    wh_name = adj.warehouse.name if adj.warehouse else None
    ref_id = f"ADJ-{adj.id:04d}"
    return AdjustmentResponse(
        id=adj.id,
        reference_id=ref_id,
        product_id=adj.product_id,
        product_name=prod_name,
        product_sku=prod_sku,
        warehouse_id=adj.warehouse_id,
        warehouse_name=wh_name,
        recorded_quantity=adj.recorded_quantity,
        previous_quantity=adj.recorded_quantity,
        physical_quantity=adj.physical_quantity,
        counted_quantity=adj.physical_quantity,
        difference=adj.difference,
        reason=adj.reason,
        status=adj.status,
        created_by=adj.created_by,
        created_at=str(adj.created_at),
    )


@router.get("/api/adjustments/recorded-stock", response_model=RecordedStockResponse)
def get_recorded_stock(
    product_id: Optional[int] = Query(None, alias="productId"),
    warehouse_id: Optional[int] = Query(None, alias="warehouseId"),
    location_id: Optional[int] = Query(None, alias="location_id"),
    p_id: Optional[int] = Query(None, alias="product_id"),
    w_id: Optional[int] = Query(None, alias="warehouse_id"),
    db: Session = Depends(get_db),
):
    """Fetch current recorded stock for a given product and warehouse location."""
    final_pid = product_id or p_id
    final_wid = warehouse_id or w_id or location_id

    if not final_pid or not final_wid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both product_id and warehouse_id are required in query params.",
        )

    product = db.query(Product).filter(Product.id == final_pid).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {final_pid} does not exist",
        )

    warehouse = db.query(Warehouse).filter(Warehouse.id == final_wid).first()
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {final_wid} does not exist",
        )

    stock_entry = db.query(StockLevel).filter(
        and_(StockLevel.product_id == final_pid, StockLevel.warehouse_id == final_wid)
    ).first()

    recorded_qty = float(stock_entry.quantity) if stock_entry else 0.0

    return RecordedStockResponse(
        product_id=product.id,
        product_name=product.name,
        product_sku=product.sku,
        warehouse_id=warehouse.id,
        warehouse_name=warehouse.name,
        recorded_quantity=recorded_qty,
        productId=product.id,
        productName=product.name,
        sku=product.sku,
        warehouseId=warehouse.id,
        warehouseName=warehouse.name,
        recordedQuantity=recorded_qty,
    )


@router.post(
    "/api/adjustments",
    response_model=AdjustmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and apply stock adjustment",
)
def create_adjustment(payload: AdjustmentCreate, db: Session = Depends(get_db)):
    """
    Apply physical stock adjustment:
    1. Verifies product and warehouse exist (404 if missing).
    2. Validates physical quantity >= 0 (400 if negative).
    3. Calculates difference = counted_quantity - recorded_quantity.
    4. Updates stock level for that warehouse to counted_quantity.
    5. Updates overall product.current_stock.
    6. Logs the adjustment record and writes an entry to stock_ledger.
    """
    pid = payload.get_product_id()
    wid = payload.get_warehouse_id()
    counted_qty = payload.get_counted_quantity()

    if counted_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Physical counted quantity must be a non-negative integer (>= 0)",
        )

    product = db.query(Product).filter(Product.id == pid).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {pid} not found",
        )

    warehouse = db.query(Warehouse).filter(Warehouse.id == wid).first()
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {wid} not found",
        )

    # Check client reference idempotency
    if payload.client_reference:
        existing = db.query(Adjustment).filter(Adjustment.client_reference == payload.client_reference).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Adjustment with reference '{payload.client_reference}' has already been applied.",
            )

    try:
        # 1. Fetch or create stock level for product at this warehouse
        stock_entry = db.query(StockLevel).filter(
            and_(StockLevel.product_id == pid, StockLevel.warehouse_id == wid)
        ).first()

        recorded_qty = float(stock_entry.quantity) if stock_entry else 0.0
        difference = round(counted_qty - recorded_qty, 4)

        if stock_entry:
            stock_entry.quantity = counted_qty
        else:
            stock_entry = StockLevel(product_id=pid, warehouse_id=wid, quantity=counted_qty)
            db.add(stock_entry)
        db.flush()

        # 2. Update overall product stock across all warehouses
        total_stock = db.query(func.coalesce(func.sum(StockLevel.quantity), 0.0)).filter(
            StockLevel.product_id == pid
        ).scalar()
        product.current_stock = float(total_stock)

        # 3. Create Adjustment record
        adj = Adjustment(
            product_id=pid,
            warehouse_id=wid,
            recorded_quantity=recorded_qty,
            physical_quantity=counted_qty,
            difference=difference,
            reason=payload.reason or "Physical Count Reconciliation",
            status="APPLIED",
            created_by=payload.user or "Inventory Specialist",
            client_reference=payload.client_reference,
        )
        db.add(adj)
        db.flush()

        ref_id = f"ADJ-{adj.id:04d}"

        # 4. Record in Stock Ledger / Move History
        ledger_entry = StockLedger(
            product_id=product.id,
            product_name=product.name,
            sku=product.sku,
            warehouse_id=warehouse.id,
            warehouse_name=warehouse.name,
            movement_type="ADJUSTMENT",
            quantity=difference,
            previous_stock=recorded_qty,
            new_stock=counted_qty,
            reference_id=ref_id,
            user=payload.user or "Inventory Specialist",
        )
        db.add(ledger_entry)

        db.commit()
        db.refresh(adj)
        return _build_adjustment_response(adj)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record stock adjustment: {str(exc)}",
        )


@router.get("/api/adjustments", response_model=List[AdjustmentResponse])
def list_adjustments(
    product_id: Optional[int] = Query(None, alias="productId"),
    warehouse_id: Optional[int] = Query(None, alias="warehouseId"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List recorded stock adjustments with filtering."""
    query = db.query(Adjustment)
    if product_id:
        query = query.filter(Adjustment.product_id == product_id)
    if warehouse_id:
        query = query.filter(Adjustment.warehouse_id == warehouse_id)

    adjustments = query.order_by(Adjustment.id.desc()).offset(offset).limit(limit).all()
    return [_build_adjustment_response(a) for a in adjustments]


@router.get("/api/adjustments/{adjustment_id}", response_model=AdjustmentResponse)
def get_adjustment_by_id(adjustment_id: int, db: Session = Depends(get_db)):
    """Get single stock adjustment details."""
    adj = db.query(Adjustment).filter(Adjustment.id == adjustment_id).first()
    if not adj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Adjustment with ID {adjustment_id} not found",
        )
    return _build_adjustment_response(adj)


@router.get("/api/ledger")
def list_ledger_entries(
    product_id: Optional[int] = Query(None, alias="productId"),
    warehouse_id: Optional[int] = Query(None, alias="warehouseId"),
    movement_type: Optional[str] = Query(None, alias="movementType"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List stock movement audit ledger entries."""
    query = db.query(StockLedger)
    if product_id:
        query = query.filter(StockLedger.product_id == product_id)
    if warehouse_id:
        query = query.filter(StockLedger.warehouse_id == warehouse_id)
    if movement_type:
        query = query.filter(StockLedger.movement_type == movement_type.upper())

    entries = query.order_by(StockLedger.id.desc()).offset(offset).limit(limit).all()
    return [
        {
            "id": e.id,
            "product_id": e.product_id,
            "productId": e.product_id,
            "product_name": e.product_name,
            "productName": e.product_name,
            "sku": e.sku,
            "warehouse_id": e.warehouse_id,
            "warehouseId": e.warehouse_id,
            "warehouse_name": e.warehouse_name,
            "warehouseName": e.warehouse_name,
            "movement_type": e.movement_type,
            "movementType": e.movement_type,
            "quantity": e.quantity,
            "previous_stock": e.previous_stock,
            "previousStock": e.previous_stock,
            "new_stock": e.new_stock,
            "newStock": e.new_stock,
            "reference_id": e.reference_id,
            "referenceId": e.reference_id,
            "user": e.user,
            "timestamp": str(e.timestamp),
        }
        for e in entries
    ]
