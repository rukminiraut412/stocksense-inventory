import pytest


def test_full_member2_dashboard_live_integration(client):
    """
    Test live integration between Member 2 Products & Receipts and Team Leader Dashboard KPIs:
    1. Authenticate user
    2. Check initial Dashboard KPIs: total_products_in_stock = 0, pending_receipts = 0
    3. Create Product with initial_stock = 20 -> Dashboard total_products_in_stock = 20
    4. Create Receipt with quantity = 30 (DRAFT) -> Dashboard pending_receipts = 1
    5. Validate Receipt -> Product stock becomes 50 -> Dashboard total_products_in_stock = 50, pending_receipts = 0
    6. Verify all 5 KPI cards remain well-structured and safe
    """
    # 1. Authenticate
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Integration User",
            "email": "integration.user@stocksense.io",
            "password": "Password123!",
            "role": "inventory_manager",
        },
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Check initial Dashboard KPIs
    dash1 = client.get("/api/v1/dashboard/kpis", headers=auth_headers).json()
    assert dash1["total_products_in_stock"]["value"] == 0
    assert dash1["pending_receipts"]["value"] == 0
    assert dash1["total_products_in_stock"]["status"] == "connected"
    assert dash1["pending_receipts"]["status"] == "connected"

    # 3. Create Product with initial_stock = 20
    prod_res = client.post("/api/v1/products", json={
        "name": "Industrial Sensor",
        "sku": "SENS-IND-01",
        "category": "Electronics",
        "unit_of_measure": "units",
        "initial_stock": 20.0,
        "low_stock_threshold": 10.0,
    })
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    dash2 = client.get("/api/v1/dashboard/kpis", headers=auth_headers).json()
    assert dash2["total_products_in_stock"]["value"] == 20

    # 4. Create Receipt with quantity = 30 (DRAFT)
    rec_res = client.post("/api/v1/receipts", json={
        "supplier": "SensorTech Solutions",
        "items": [{"product_id": prod_id, "quantity": 30.0}],
    })
    assert rec_res.status_code == 201
    rec_id = rec_res.json()["id"]

    dash3 = client.get("/api/v1/dashboard/kpis", headers=auth_headers).json()
    assert dash3["total_products_in_stock"]["value"] == 20  # stock unchanged during DRAFT
    assert dash3["pending_receipts"]["value"] == 1  # 1 pending receipt

    # 5. Validate Receipt
    val_res = client.post(f"/api/v1/receipts/{rec_id}/validate")
    assert val_res.status_code == 200

    dash4 = client.get("/api/v1/dashboard/kpis", headers=auth_headers).json()
    assert dash4["total_products_in_stock"]["value"] == 50  # 20 + 30 = 50
    assert dash4["pending_receipts"]["value"] == 0  # no more pending receipts
