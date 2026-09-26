# StockSense – Inventory Management System

StockSense is an inventory management platform built for hackathons and production warehouses.

## Team Member 2 Modules: Products & Receipts

Branch: `feature/products-receipts`

### Features Implemented
1. **Products Module**:
   - Product creation, listing, updating, deleting.
   - Dedicated SKU / Name search.
   - Unique SKU enforcement and non-negative initial stock validation.
   - Auto-generated timestamps (`created_at`, `updated_at`).
2. **Receipts Module**:
   - Create receipts in `DRAFT` status with dynamic line items and supplier.
   - View detailed receipts with line items.
   - Transaction-safe receipt validation: transitions `DRAFT` → `VALIDATED`.
   - Increases product stock (`current_stock = current_stock + received_quantity`) strictly upon validation.
   - Prevents duplicate validations (safe against race conditions and double stock increments).
3. **Frontend UI**:
   - Interactive dashboard with Products and Receipts tabs.
   - Modals for adding products, editing products, creating receipts, and viewing details.
   - Real-time search filter and instant stock synchronization upon receipt validation.
4. **API Contract & Tests**:
   - Complete documentation in `docs/API_CONTRACT.md`.
   - Comprehensive test suite in `backend/app/tests/`.

---

## Quickstart

### 1. Requirements
- Python 3.10+
- Dependencies: `pip install -r requirements.txt`

### 2. Start Application
```bash
python -m uvicorn backend.app.main:app --port 8000
```
- Web UI: http://localhost:8000
- Swagger API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/api/health

### 3. Run Automated Tests
```bash
pytest backend/app/tests -v
```

---

## Project Structure

```
stocksense-inventory/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application & static mounts
│   │   ├── database.py          # SQLAlchemy SQLite configuration
│   │   ├── models/
│   │   │   ├── product.py       # Product model
│   │   │   └── receipt.py       # Receipt & ReceiptItem models
│   │   ├── schemas/
│   │   │   ├── product.py       # Pydantic schemas for Products
│   │   │   └── receipt.py       # Pydantic schemas for Receipts
│   │   ├── routers/
│   │   │   ├── products.py      # Products REST endpoints
│   │   │   └── receipts.py      # Receipts REST endpoints & validation
│   │   └── tests/
│   │       ├── conftest.py      # Pytest fixtures
│   │       ├── test_products.py # Product tests
│   │       └── test_receipts.py # Receipt & Stock Validation tests
├── frontend/
│   ├── index.html               # Main dashboard with tabs
│   ├── css/styles.css           # Styling
│   └── js/
│       ├── api.js               # API helper
│       ├── products.js          # Products UI
│       └── receipts.js          # Receipts UI
├── data/
│   └── stocksense.db            # Persistent SQLite database
├── docs/
│   └── API_CONTRACT.md          # Full REST API Contract
├── requirements.txt
└── README.md
```
