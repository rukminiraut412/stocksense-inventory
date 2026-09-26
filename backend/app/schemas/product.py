from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the product")
    sku: str = Field(..., min_length=1, max_length=100, description="Unique SKU/Code")
    category: str = Field(..., min_length=1, max_length=100, description="Product category")
    unit_of_measure: str = Field(..., min_length=1, max_length=50, description="Unit of measure (e.g., pcs, kg)")
    initial_stock: Optional[float] = Field(default=0.0, ge=0.0, description="Initial stock quantity, must be >= 0")
    low_stock_threshold: Optional[float] = Field(default=10.0, ge=0.0, description="Low stock warning threshold")

    @field_validator("name", "sku", "category", "unit_of_measure")
    @classmethod
    def strip_and_validate_non_empty(cls, v: str) -> str:
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Field cannot be empty or only whitespace")
        return v_stripped


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    unit_of_measure: Optional[str] = Field(default=None, min_length=1, max_length=50)
    sku: Optional[str] = Field(default=None, min_length=1, max_length=100)
    low_stock_threshold: Optional[float] = Field(default=None, ge=0.0)

    @field_validator("name", "category", "unit_of_measure", "sku")
    @classmethod
    def strip_if_present(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("Field cannot be empty or only whitespace")
            return v_stripped
        return v


class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    category: str
    unit_of_measure: str
    current_stock: float
    initial_stock: float
    low_stock_threshold: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
