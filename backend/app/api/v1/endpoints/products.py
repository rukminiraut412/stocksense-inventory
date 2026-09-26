from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api.deps import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter()


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, summary="Create a new product")
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product with unique SKU and optional initial stock and low stock threshold."""
    # Check for duplicate SKU
    existing = db.query(Product).filter(Product.sku == product_in.sku).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with SKU '{product_in.sku}' already exists."
        )

    initial_stock = product_in.initial_stock if product_in.initial_stock is not None else 0.0
    if initial_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Initial stock cannot be negative."
        )

    low_stock_threshold = product_in.low_stock_threshold if product_in.low_stock_threshold is not None else 10.0

    product = Product(
        name=product_in.name,
        sku=product_in.sku,
        category=product_in.category,
        unit_of_measure=product_in.unit_of_measure,
        initial_stock=initial_stock,
        current_stock=initial_stock,
        low_stock_threshold=low_stock_threshold
    )
    try:
        db.add(product)
        db.commit()
        db.refresh(product)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create product: {str(exc)}"
        )
    return product


@router.get("", response_model=List[ProductResponse], summary="List all products")
def list_products(
    search: Optional[str] = Query(None, description="Search by SKU, name, or category"),
    db: Session = Depends(get_db)
):
    """List all products, with optional search query."""
    query = db.query(Product)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_pattern),
                Product.sku.ilike(search_pattern),
                Product.category.ilike(search_pattern)
            )
        )
    return query.order_by(Product.id.desc()).all()


@router.get("/search", response_model=List[ProductResponse], summary="Search products by SKU or name")
def search_products(
    q: str = Query(..., min_length=1, description="Search query for SKU or product name"),
    db: Session = Depends(get_db)
):
    """Dedicated search endpoint for products by SKU or name."""
    search_pattern = f"%{q.strip()}%"
    return db.query(Product).filter(
        or_(
            Product.name.ilike(search_pattern),
            Product.sku.ilike(search_pattern)
        )
    ).order_by(Product.name.asc()).all()


@router.get("/{product_id}", response_model=ProductResponse, summary="Get product details")
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Retrieve details of a single product by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return product


@router.put("/{product_id}", response_model=ProductResponse, summary="Update product")
def update_product(product_id: int, product_in: ProductUpdate, db: Session = Depends(get_db)):
    """Update product information (name, category, unit of measure, SKU, or low_stock_threshold)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    # If updating SKU, ensure no conflict
    if product_in.sku is not None and product_in.sku != product.sku:
        existing = db.query(Product).filter(
            Product.sku == product_in.sku,
            Product.id != product_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{product_in.sku}' already exists."
            )
        product.sku = product_in.sku

    if product_in.name is not None:
        product.name = product_in.name
    if product_in.category is not None:
        product.category = product_in.category
    if product_in.unit_of_measure is not None:
        product.unit_of_measure = product_in.unit_of_measure
    if product_in.low_stock_threshold is not None:
        product.low_stock_threshold = product_in.low_stock_threshold

    try:
        db.commit()
        db.refresh(product)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update product: {str(exc)}"
        )
    return product


@router.delete("/{product_id}", status_code=status.HTTP_200_OK, summary="Delete product")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    try:
        db.delete(product)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete product: {str(exc)}"
        )
    return {"detail": f"Product {product_id} deleted successfully."}
