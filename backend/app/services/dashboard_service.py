from datetime import datetime, timezone
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from app.schemas.dashboard import DashboardKPIResponse, KPICardItem


def get_dashboard_kpis(db: Session) -> DashboardKPIResponse:
    """
    Integration-friendly service interface for dashboard KPIs.
    
    This function checks for the presence of tables created by teammates:
    - Member 2: Products, Receipts
    - Member 3: Deliveries, Internal Transfers
    - Member 4: Low-stock logic / adjustments
    
    If those modules have not yet created their tables or logic, safe empty/default (0)
    states are returned with explicit attribution, ensuring NO fake data is presented.
    """
    inspector = inspect(db.bind)
    existing_tables = set(inspector.get_table_names())
    
    # 1. Total Products in Stock (Member 2)
    products_count = 0
    products_connected = False
    if "products" in existing_tables:
        try:
            result = db.execute(text("SELECT COALESCE(SUM(current_stock), 0) FROM products")).scalar()
            products_count = int(result or 0)
            products_connected = True
        except Exception:
            products_count = 0
            
    total_products_item = KPICardItem(
        key="total_products_in_stock",
        title="Total Products in Stock",
        value=products_count,
        unit="units",
        status="connected" if products_connected else "awaiting_module",
        module_owner="Member 2",
        module_name="Products",
        description="Aggregated on-hand inventory count across all warehouse SKUs.",
        is_connected=products_connected
    )
    
    # 2. Low Stock / Out of Stock (Member 4)
    low_stock_count = 0
    low_stock_connected = False
    if "products" in existing_tables:
        try:
            # If products table exists and has min_stock or reorder_level column
            columns = [col["name"] for col in inspector.get_columns("products")]
            if "min_stock" in columns:
                result = db.execute(text("SELECT COUNT(*) FROM products WHERE current_stock <= min_stock")).scalar()
                low_stock_count = int(result or 0)
                low_stock_connected = True
        except Exception:
            low_stock_count = 0

    low_stock_item = KPICardItem(
        key="low_stock_out_of_stock",
        title="Low Stock / Out of Stock",
        value=low_stock_count,
        unit="alerts",
        status="connected" if low_stock_connected else "awaiting_module",
        module_owner="Member 4",
        module_name="Inventory Adjustments & Low-Stock",
        description="SKUs requiring immediate replenishment attention.",
        is_connected=low_stock_connected
    )
    
    # 3. Pending Receipts (Member 2)
    pending_receipts_count = 0
    receipts_connected = False
    if "receipts" in existing_tables:
        try:
            result = db.execute(text("SELECT COUNT(*) FROM receipts WHERE status IN ('pending', 'draft', 'in_progress')")).scalar()
            pending_receipts_count = int(result or 0)
            receipts_connected = True
        except Exception:
            pending_receipts_count = 0

    pending_receipts_item = KPICardItem(
        key="pending_receipts",
        title="Pending Receipts",
        value=pending_receipts_count,
        unit="orders",
        status="connected" if receipts_connected else "awaiting_module",
        module_owner="Member 2",
        module_name="Receipts",
        description="Incoming vendor deliveries waiting for dock processing.",
        is_connected=receipts_connected
    )
    
    # 4. Pending Deliveries (Member 3)
    pending_deliveries_count = 0
    deliveries_connected = False
    if "delivery_orders" in existing_tables or "deliveries" in existing_tables:
        table_name = "delivery_orders" if "delivery_orders" in existing_tables else "deliveries"
        try:
            result = db.execute(text(f"SELECT COUNT(*) FROM {table_name} WHERE status IN ('pending', 'processing', 'scheduled')")).scalar()
            pending_deliveries_count = int(result or 0)
            deliveries_connected = True
        except Exception:
            pending_deliveries_count = 0

    pending_deliveries_item = KPICardItem(
        key="pending_deliveries",
        title="Pending Deliveries",
        value=pending_deliveries_count,
        unit="shipments",
        status="connected" if deliveries_connected else "awaiting_module",
        module_owner="Member 3",
        module_name="Delivery Orders",
        description="Outbound customer orders awaiting picking and dispatch.",
        is_connected=deliveries_connected
    )
    
    # 5. Internal Transfers Scheduled (Member 3)
    transfers_count = 0
    transfers_connected = False
    if "internal_transfers" in existing_tables or "transfers" in existing_tables:
        table_name = "internal_transfers" if "internal_transfers" in existing_tables else "transfers"
        try:
            result = db.execute(text(f"SELECT COUNT(*) FROM {table_name} WHERE status IN ('scheduled', 'pending', 'in_transit')")).scalar()
            transfers_count = int(result or 0)
            transfers_connected = True
        except Exception:
            transfers_count = 0

    transfers_item = KPICardItem(
        key="internal_transfers_scheduled",
        title="Internal Transfers Scheduled",
        value=transfers_count,
        unit="transfers",
        status="connected" if transfers_connected else "awaiting_module",
        module_owner="Member 3",
        module_name="Internal Transfers",
        description="Relocations between warehouse bays or storage locations.",
        is_connected=transfers_connected
    )
    
    return DashboardKPIResponse(
        total_products_in_stock=total_products_item,
        low_stock_out_of_stock=low_stock_item,
        pending_receipts=pending_receipts_item,
        pending_deliveries=pending_deliveries_item,
        internal_transfers_scheduled=transfers_item,
        system_status="StockSense Team Leader Foundation Active",
        timestamp=datetime.now(timezone.utc),
        summary_counts={
            "total_products_in_stock": products_count,
            "low_stock_out_of_stock": low_stock_count,
            "pending_receipts": pending_receipts_count,
            "pending_deliveries": pending_deliveries_count,
            "internal_transfers_scheduled": transfers_count,
        }
    )
