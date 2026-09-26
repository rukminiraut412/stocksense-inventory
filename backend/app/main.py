import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.app.database import engine, Base, init_db
import backend.app.models.product  # ensures Product model registered
import backend.app.models.receipt  # ensures Receipt & ReceiptItem models registered
import backend.app.models.delivery  # ensures DeliveryOrder & DeliveryLine registered
import backend.app.models.transfer  # ensures InternalTransfer, Warehouse, StockLevel registered
import backend.app.models.user  # ensures User model registered
import backend.app.core.database

# Ensure namespace aliasing for app.* -> backend.app.*
sys.modules['app.models.product'] = backend.app.models.product
sys.modules['app.models.receipt'] = backend.app.models.receipt
sys.modules['app.models.delivery'] = backend.app.models.delivery
sys.modules['app.models.transfer'] = backend.app.models.transfer
sys.modules['app.models.user'] = backend.app.models.user
sys.modules['app.core.database'] = backend.app.core.database

from backend.app.routers.products import router as products_router
from backend.app.routers.receipts import router as receipts_router
from backend.app.routers.deliveries import router as deliveries_router
from backend.app.routers.transfers import router as transfers_router
from backend.app.routers.adjustments import router as adjustments_router
from backend.app.api.v1.endpoints.auth import router as auth_router
from backend.app.api.v1.endpoints.dashboard import router as dashboard_router

# Initialize database tables and schema migrations
init_db()

app = FastAPI(
    title="StockSense - Inventory Management System",
    description="Backend API for StockSense Hackathon Project",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class V1AliasMiddleware(BaseHTTPMiddleware):
    """Maps /api/v1/<endpoint> requests to /api/<endpoint> for shared routers."""
    async def dispatch(self, request: Request, call_next):
        path = request.scope.get("path", "")
        if path.startswith("/api/v1/"):
            subpath = path[len("/api/v1/"):]
            if not subpath.startswith(("auth", "dashboard")):
                request.scope["path"] = f"/api/{subpath}"
        return await call_next(request)


app.add_middleware(V1AliasMiddleware)

# Include Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api")

app.include_router(products_router)
app.include_router(receipts_router)
app.include_router(deliveries_router)   # Team Member 3
app.include_router(transfers_router)    # Team Member 3
app.include_router(adjustments_router)  # Stock Adjustment

# Health checks
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy", "system": "StockSense Inventory"}


@app.get("/api/health", tags=["Health"])
def api_health_check():
    return {"status": "ok", "system": "StockSense Inventory"}

# Frontend static files mounting
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    @app.get("/products", include_in_schema=False)
    @app.get("/products/new", include_in_schema=False)
    @app.get("/products/{product_id}", include_in_schema=False)
    @app.get("/receipts", include_in_schema=False)
    @app.get("/receipts/new", include_in_schema=False)
    @app.get("/receipts/{receipt_id}", include_in_schema=False)
    @app.get("/deliveries", include_in_schema=False)
    @app.get("/deliveries/new", include_in_schema=False)
    @app.get("/deliveries/{delivery_id}", include_in_schema=False)
    @app.get("/transfers", include_in_schema=False)
    @app.get("/transfers/new", include_in_schema=False)
    @app.get("/transfers/{transfer_id}", include_in_schema=False)
    def serve_frontend(
        product_id: str = None,
        receipt_id: str = None,
        delivery_id: str = None,
        transfer_id: str = None,
    ):
        return FileResponse(FRONTEND_DIR / "index.html")

