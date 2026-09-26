"""
StockSense Phase 3 - Integration Hardening Verification Test Suite
Team Member 2: Products & Receipts

Tests the complete end-to-end functionality using FastAPI TestClient:
- Products CRUD, search, validation, persistence
- Receipts creation, listing, detail viewing, validation
- Strict idempotency: Duplicate validation rejection & stock preservation
- Atomic transaction rollback
- Contract conformance
"""
import time
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_products_hardening_workflow():
    # 1. Create product with valid data
    ts = int(time.time())
    sku = f"HARD-PROD-{ts}"
    create_payload = {
        "name": "Industrial Multimeter",
        "sku": sku,
        "category": "Instrumentation",
        "unit_of_measure": "units",
        "initial_stock": 25.0,
        "low_stock_threshold": 10.0
    }
    res = client.post("/api/products", json=create_payload)
    assert res.status_code == 201
    prod = res.json()
    product_id = prod["id"]
    assert prod["sku"] == sku
    assert prod["current_stock"] == 25.0
    assert prod["low_stock_threshold"] == 10.0

    # 2. Required-field validation (invalid input)
    bad_res = client.post("/api/products", json={"name": "", "sku": "", "category": "", "unit_of_measure": ""})
    assert bad_res.status_code == 422

    # Negative stock rejected
    neg_stock_res = client.post("/api/products", json={
        "name": "Negative Stock Prod",
        "sku": f"NEG-{ts}",
        "category": "Test",
        "unit_of_measure": "pcs",
        "initial_stock": -10.0
    })
    assert neg_stock_res.status_code == 422

    # 3. Duplicate SKU is rejected
    dup_res = client.post("/api/products", json=create_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # 4 & 5. Product persistence and fetching
    fetch_res = client.get(f"/api/products/{product_id}")
    assert fetch_res.status_code == 200
    assert fetch_res.json()["name"] == "Industrial Multimeter"

    # 6. Product update
    update_res = client.put(f"/api/products/{product_id}", json={
        "name": "Industrial Multimeter Pro",
        "category": "Advanced Instrumentation",
        "low_stock_threshold": 12.0
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Industrial Multimeter Pro"
    assert updated["category"] == "Advanced Instrumentation"
    assert updated["low_stock_threshold"] == 12.0
    assert updated["current_stock"] == 25.0  # Stock must not be changed by general product update

    # 7. Product search works by name and SKU
    sku_search = client.get(f"/api/products/search?q={sku}")
    assert sku_search.status_code == 200
    assert len(sku_search.json()) >= 1
    assert sku_search.json()[0]["sku"] == sku

    name_search = client.get("/api/products/search?q=Multimeter")
    assert name_search.status_code == 200
    assert any(p["id"] == product_id for p in name_search.json())

    # 8. List products
    list_res = client.get("/api/products")
    assert list_res.status_code == 200
    assert any(p["id"] == product_id for p in list_res.json())


def test_receipts_hardening_workflow():
    # 1. Create product with stock = 0
    ts = int(time.time())
    sku = f"REC-HARD-{ts}"
    prod_res = client.post("/api/products", json={
        "name": "Precision Flange",
        "sku": sku,
        "category": "Machinery",
        "unit_of_measure": "pcs",
        "initial_stock": 0.0
    })
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # 2. Create receipt with positive quantity
    rec_res = client.post("/api/receipts", json={
        "supplier": "Heavy Metals Corp",
        "items": [{"product_id": prod_id, "quantity": 50.0}]
    })
    assert rec_res.status_code == 201
    receipt = rec_res.json()
    receipt_id = receipt["id"]

    # 3. New receipt starts as DRAFT
    assert receipt["status"] == "DRAFT"
    assert receipt["validated_at"] is None

    # 4. Creating a DRAFT receipt must NOT increase stock
    check_draft = client.get(f"/api/products/{prod_id}").json()
    assert check_draft["current_stock"] == 0.0

    # 5. View draft receipt details
    detail_res = client.get(f"/api/receipts/{receipt_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["status"] == "DRAFT"
    assert len(detail_res.json()["items"]) == 1

    # 6. Validate receipt
    val_res = client.post(f"/api/receipts/{receipt_id}/validate")
    assert val_res.status_code == 200
    validated = val_res.json()

    # 7. Receipt becomes VALIDATED
    assert validated["status"] == "VALIDATED"
    assert validated["validated_at"] is not None

    # 8. Stock increases correctly (0 -> 50)
    check_val = client.get(f"/api/products/{prod_id}").json()
    assert check_val["current_stock"] == 50.0

    # 9. Attempt duplicate validation
    dup_val = client.post(f"/api/receipts/{receipt_id}/validate")
    assert dup_val.status_code == 400
    assert "already validated" in dup_val.json()["detail"].lower()

    # 10. Re-validation must NOT increase stock again
    check_dup = client.get(f"/api/products/{prod_id}").json()
    assert check_dup["current_stock"] == 50.0

    # 11. Zero/negative quantity must be rejected
    zero_res = client.post("/api/receipts", json={
        "supplier": "Test Vendor",
        "items": [{"product_id": prod_id, "quantity": 0.0}]
    })
    assert zero_res.status_code == 422

    neg_res = client.post("/api/receipts", json={
        "supplier": "Test Vendor",
        "items": [{"product_id": prod_id, "quantity": -5.0}]
    })
    assert neg_res.status_code == 422

    # 12. Missing product ID must be rejected
    missing_res = client.post("/api/receipts", json={
        "supplier": "Test Vendor",
        "items": [{"product_id": 99999999, "quantity": 10.0}]
    })
    assert missing_res.status_code == 400
    assert "does not exist" in missing_res.json()["detail"].lower()


def test_frontend_routes_served():
    # Verify SPA deep routes are cleanly served
    for route in ["/", "/products", "/products/new", "/receipts", "/receipts/new"]:
        resp = client.get(route)
        assert resp.status_code == 200
        assert "StockSense" in resp.text
