from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.database import engine, Base, init_db
import backend.app.models.product  # ensures Product model registered
import backend.app.models.receipt  # ensures Receipt & ReceiptItem models registered

from backend.app.routers.products import router as products_router
from backend.app.routers.receipts import router as receipts_router

# Initialize database tables and schema migrations
init_db()

app = FastAPI(
    title="StockSense – Inventory Management System",
    description="Backend API for StockSense Hackathon Project (Products & Receipts modules)",
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

# Include Routers
app.include_router(products_router)
app.include_router(receipts_router)

# Health check
@app.get("/api/health", tags=["Health"])
def health_check():
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
    def serve_frontend(product_id: str = None, receipt_id: str = None):
        return FileResponse(FRONTEND_DIR / "index.html")
