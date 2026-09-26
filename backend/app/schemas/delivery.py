from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


# --------------- Line schemas ---------------

class DeliveryLineCreate(BaseModel):
    product_id: int = Field(..., gt=0, description="ID of an existing product")
    quantity: float = Field(..., gt=0, description="Quantity to deliver (must be > 0)")

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v


class DeliveryLineResponse(BaseModel):
    id: int
    delivery_id: int
    product_id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    quantity: float

    model_config = ConfigDict(from_attributes=True)


# --------------- Delivery schemas ---------------

class DeliveryCreate(BaseModel):
    customer_name: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=500)
    lines: List[DeliveryLineCreate] = Field(..., min_length=1)


class DeliveryStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: PICKED or PACKED")

    @field_validator("status")
    @classmethod
    def valid_manual_status(cls, v: str) -> str:
        allowed = {"PICKED", "PACKED"}
        if v not in allowed:
            raise ValueError(f"Manual status update only allows: {allowed}")
        return v


class DeliveryResponse(BaseModel):
    id: int
    reference: str
    customer_name: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    validated_at: Optional[datetime]
    lines: Optional[List[DeliveryLineResponse]] = None

    model_config = ConfigDict(from_attributes=True)
