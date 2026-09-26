from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class KPICardItem(BaseModel):
    key: str
    title: str
    value: int = 0
    unit: str = "items"
    status: str = "default"  # "default", "connected", "pending_module"
    module_owner: str  # e.g., "Member 2", "Member 3", "Member 4"
    module_name: str
    description: str
    is_connected: bool = False


class DashboardKPIResponse(BaseModel):
    total_products_in_stock: KPICardItem
    low_stock_out_of_stock: KPICardItem
    pending_receipts: KPICardItem
    pending_deliveries: KPICardItem
    internal_transfers_scheduled: KPICardItem
    system_status: str = "StockSense Foundation Operational"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    summary_counts: Dict[str, int] = Field(
        default_factory=lambda: {
            "total_products_in_stock": 0,
            "low_stock_out_of_stock": 0,
            "pending_receipts": 0,
            "pending_deliveries": 0,
            "internal_transfers_scheduled": 0,
        }
    )
