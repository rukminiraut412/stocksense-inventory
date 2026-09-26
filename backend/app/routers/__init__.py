from backend.app.routers.products import router as products_router
from backend.app.routers.receipts import router as receipts_router
from backend.app.routers.deliveries import router as deliveries_router
from backend.app.routers.transfers import router as transfers_router

__all__ = [
    "products_router",
    "receipts_router",
    "deliveries_router",
    "transfers_router",
]
