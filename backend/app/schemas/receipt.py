from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ReceiptItemCreate(BaseModel):
    product_id: int = Field(..., gt=0, description="Product ID to receive")
    quantity: float = Field(..., gt=0.0, description="Quantity received, must be strictly greater than 0")


class ReceiptCreate(BaseModel):
    supplier: str = Field(..., min_length=1, max_length=255, description="Supplier name")
    items: List[ReceiptItemCreate] = Field(..., min_length=1, description="List of items to receive")

    @field_validator("supplier")
    @classmethod
    def strip_and_validate_supplier(cls, v: str) -> str:
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Supplier name cannot be empty or only whitespace")
        return v_stripped


class ReceiptItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    quantity: float

    model_config = ConfigDict(from_attributes=True)


class ReceiptResponse(BaseModel):
    id: int
    receipt_number: str
    supplier: str
    status: str
    created_at: datetime
    validated_at: Optional[datetime] = None
    items: List[ReceiptItemResponse] = []
    items_count: int = 0

    model_config = ConfigDict(from_attributes=True)
