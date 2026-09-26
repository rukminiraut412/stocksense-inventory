from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class TransferCreate(BaseModel):
    source_warehouse_id: Optional[int] = Field(default=None, gt=0)
    source_location_id: Optional[int] = Field(default=None, gt=0)
    destination_warehouse_id: Optional[int] = Field(default=None, gt=0)
    destination_location_id: Optional[int] = Field(default=None, gt=0)
    product_id: int = Field(..., gt=0)
    quantity: float = Field(..., gt=0)
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v

    @model_validator(mode="after")
    def validate_locations(self):
        src = self.source_warehouse_id or self.source_location_id
        dst = self.destination_warehouse_id or self.destination_location_id
        if not src:
            raise ValueError("Either source_warehouse_id or source_location_id is required.")
        if not dst:
            raise ValueError("Either destination_warehouse_id or destination_location_id is required.")
        if src == dst:
            raise ValueError("Source and destination warehouses cannot be the same.")
        return self

    def get_source_id(self) -> int:
        return self.source_warehouse_id or self.source_location_id

    def get_destination_id(self) -> int:
        return self.destination_warehouse_id or self.destination_location_id


class WarehouseResponse(BaseModel):
    id: int
    code: str
    name: str
    location: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TransferResponse(BaseModel):
    id: int
    reference: str
    source_warehouse_id: int
    source_location_id: Optional[int] = None
    source_warehouse_name: Optional[str] = None
    source_location_name: Optional[str] = None
    destination_warehouse_id: int
    destination_location_id: Optional[int] = None
    destination_warehouse_name: Optional[str] = None
    destination_location_name: Optional[str] = None
    product_id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    quantity: float
    status: str
    notes: Optional[str]
    created_at: datetime
    validated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
