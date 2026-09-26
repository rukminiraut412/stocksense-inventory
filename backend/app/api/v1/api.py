from fastapi import APIRouter
from app.api.v1.endpoints import auth, dashboard

api_router = APIRouter()

# Team Leader Core APIs
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)

# ==============================================================================
# INTEGRATION MOUNT POINTS FOR TEAMMATES:
# Teammates can connect their routers here during integration:
#
# Member 2 (Products & Receipts):
from app.api.v1.endpoints import products, receipts
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["Receipts"])
#
# Member 3 (Delivery Orders & Internal Transfers):
#   from app.api.v1.endpoints import deliveries, transfers
#   api_router.include_router(deliveries.router, prefix="/deliveries", tags=["Deliveries"])
#   api_router.include_router(transfers.router, prefix="/transfers", tags=["Transfers"])
#
# Member 4 (Adjustments & Stock Ledger / History):
#   from app.api.v1.endpoints import adjustments, ledger
#   api_router.include_router(adjustments.router, prefix="/adjustments", tags=["Adjustments"])
#   api_router.include_router(ledger.router, prefix="/ledger", tags=["Stock Ledger"])
# ==============================================================================
