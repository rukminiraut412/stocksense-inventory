from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator


class AdjustmentCreate(BaseModel):
    product_id: Optional[int] = Field(default=None, description="Product ID")
    productId: Optional[int] = Field(default=None, description="Product ID alias")
    warehouse_id: Optional[int] = Field(default=None, description="Warehouse ID")
    warehouseId: Optional[int] = Field(default=None, description="Warehouse ID alias")
    location_id: Optional[int] = Field(default=None, description="Location ID alias")
    counted_quantity: Optional[float] = Field(default=None, description="Counted quantity")
    physical_quantity: Optional[float] = Field(default=None, description="Physical quantity alias")
    physicalQuantity: Optional[float] = Field(default=None, description="Physical quantity alias")
    countedQuantity: Optional[float] = Field(default=None, description="Counted quantity alias")
    reason: Optional[str] = Field(default="Physical Count Reconciliation", max_length=500)
    user: Optional[str] = Field(default="Inventory Specialist", max_length=255)
    client_reference: Optional[str] = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def resolve_aliases(self):
        p_id = self.product_id or self.productId
        w_id = self.warehouse_id or self.warehouseId or self.location_id
        qty = self.counted_quantity
        if qty is None:
            qty = self.physical_quantity
        if qty is None:
            qty = self.physicalQuantity
        if qty is None:
            qty = self.countedQuantity

        if p_id is None:
            raise ValueError("product_id is required")
        if w_id is None:
            raise ValueError("warehouse_id is required")
        if qty is None:
            raise ValueError("counted_quantity (or physical_quantity) is required")
        if qty < 0:
            raise ValueError("Physical counted quantity must be non-negative (>= 0)")

        self.product_id = p_id
        self.warehouse_id = w_id
        self.counted_quantity = float(qty)
        return self

    def get_product_id(self) -> int:
        return self.product_id

    def get_warehouse_id(self) -> int:
        return self.warehouse_id

    def get_counted_quantity(self) -> float:
        return self.counted_quantity


class AdjustmentResponse(BaseModel):
    id: int
    reference_id: str
    product_id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    warehouse_id: int
    warehouse_name: Optional[str] = None
    recorded_quantity: float
    previous_quantity: float
    physical_quantity: float
    counted_quantity: float
    difference: float
    reason: Optional[str] = None
    status: str
    created_by: Optional[str] = None
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RecordedStockResponse(BaseModel):
    product_id: int
    product_name: str
    product_sku: str
    warehouse_id: int
    warehouse_name: str
    recorded_quantity: float
    # CamelCase aliases for frontend compatibility
    productId: int
    productName: str
    sku: str
    warehouseId: int
    warehouseName: str
    recordedQuantity: float
