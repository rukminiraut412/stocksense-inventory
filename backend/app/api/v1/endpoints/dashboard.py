from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardKPIResponse
from app.services.dashboard_service import get_dashboard_kpis

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/kpis",
    response_model=DashboardKPIResponse,
    summary="Get aggregated Inventory Dashboard KPIs",
)
def get_kpis(
    time_range: Optional[str] = Query("all", description="Time window filter (e.g. today, week, month, all)"),
    warehouse_id: Optional[int] = Query(None, description="Optional warehouse filter ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the 5 key inventory indicators:
    1. Total Products in Stock (Member 2 integration)
    2. Low Stock / Out of Stock (Member 4 integration)
    3. Pending Receipts (Member 2 integration)
    4. Pending Deliveries (Member 3 integration)
    5. Internal Transfers Scheduled (Member 3 integration)

    If teammate tables or modules are not yet registered, safe default/zero counts
    are returned along with clear module connection status so no fake data is shown.
    """
    return get_dashboard_kpis(db)
