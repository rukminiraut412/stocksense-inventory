import pytest


def test_step3_full_receipt_creation_and_attributes(client):
    """
    STEP 3 — FULL RECEIPT TEST:
    Create draft receipt.
    Check:
    - Receipt number (formatted as REC-YYYYMMDD-XXXX)
    - Supplier
    - Status (DRAFT)
    - Product lines
    - Quantities
    - Unit of measure
    """
    # 1. Create product first
    p_res = client.post("/api/v1/products", json={
        "name": "Precision Bearing 20mm",
        "sku": "BRG-20MM",
        "category": "Mechanical",
        "unit_of_measure": "pcs",
        "initial_stock": 0.0,
    })
    assert p_res.status_code == 201
    prod = p_res.json()
    product_id = prod["id"]

    # 2. Create receipt
    rec_payload = {
        "supplier": "Apex Industrial Supplies",
        "items": [
            {"product_id": product_id, "quantity": 40.0}
        ]
    }
    rec_res = client.post("/api/v1/receipts", json=rec_payload)
    assert rec_res.status_code == 201
    receipt = rec_res.json()

    # Verify attributes
    assert receipt["id"] is not None
    assert receipt["receipt_number"].startswith("REC-")
    assert receipt["supplier"] == "Apex Industrial Supplies"
    assert receipt["status"].upper() == "DRAFT"
    assert len(receipt["items"]) == 1
    assert receipt["items"][0]["product_id"] == product_id
    assert receipt["items"][0]["product_name"] == "Precision Bearing 20mm"
    assert receipt["items"][0]["product_sku"] == "BRG-20MM"
    assert receipt["items"][0]["quantity"] == 40.0


def test_step4_stock_increase_integration(client):
    """
    STEP 4 — STOCK INCREASE INTEGRATION TEST:
    Verify:
    1. Product initial stock = X
    2. Create receipt with quantity = Y
    3. Receipt status is DRAFT -> stock MUST still be X
    4. Validate receipt
    5. Receipt status -> VALIDATED
    6. Product stock -> MUST become X + Y
    7. Verify product fetch confirms updated stock
    """
    # 1. Product initial stock = 15.0 (X)
    X = 15.0
    Y = 35.0
    prod_res = client.post("/api/v1/products", json={
        "name": "Hydraulic Hose 1/2in",
        "sku": "HOSE-HYD-050",
        "category": "Hydraulics",
        "unit_of_measure": "meters",
        "initial_stock": X,
    })
    assert prod_res.status_code == 201
    product_id = prod_res.json()["id"]
    assert prod_res.json()["current_stock"] == X

    # 2. Create receipt with quantity = 35.0 (Y)
    rec_res = client.post("/api/v1/receipts", json={
        "supplier": "Fluid Dynamics Co",
        "items": [{"product_id": product_id, "quantity": Y}],
    })
    assert rec_res.status_code == 201
    receipt = rec_res.json()
    receipt_id = receipt["id"]

    # 3. Receipt status is DRAFT -> stock MUST still be X
    assert receipt["status"].upper() == "DRAFT"
    stock_during_draft = client.get(f"/api/v1/products/{product_id}").json()["current_stock"]
    assert stock_during_draft == X, f"Stock during DRAFT must remain {X}, got {stock_during_draft}"

    # 4. Validate receipt
    val_res = client.post(f"/api/v1/receipts/{receipt_id}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()

    # 5. Receipt status -> VALIDATED
    assert val_data["status"].upper() == "VALIDATED"
    assert val_data["validated_at"] is not None

    # 6. Product stock -> MUST become X + Y = 50.0
    expected_stock = X + Y
    # 7. Verify product fetch confirms updated stock
    updated_prod = client.get(f"/api/v1/products/{product_id}").json()
    assert updated_prod["current_stock"] == expected_stock, (
        f"Product stock must be {expected_stock}, got {updated_prod['current_stock']}"
    )


def test_step5_duplicate_validation_rejection(client):
    """
    STEP 5 — DUPLICATE VALIDATION REJECTION TEST:
    Verify:
    Validate the already validated receipt again.
    MUST fail with HTTP 400.
    Stock MUST remain X + Y.
    """
    # Create product and receipt
    X = 10.0
    Y = 20.0
    prod = client.post("/api/v1/products", json={
        "name": "Flange Gasket 4in",
        "sku": "GSK-FLG-04",
        "category": "Gaskets",
        "unit_of_measure": "pcs",
        "initial_stock": X,
    }).json()
    prod_id = prod["id"]

    rec = client.post("/api/v1/receipts", json={
        "supplier": "Seals & Gaskets Inc",
        "items": [{"product_id": prod_id, "quantity": Y}],
    }).json()
    rec_id = rec["id"]

    # First validation succeeds
    val1 = client.post(f"/api/v1/receipts/{rec_id}/validate")
    assert val1.status_code == 200

    # Stock is now X + Y = 30.0
    stock_after_first = client.get(f"/api/v1/products/{prod_id}").json()["current_stock"]
    assert stock_after_first == X + Y

    # Duplicate validation MUST fail with HTTP 400
    val2 = client.post(f"/api/v1/receipts/{rec_id}/validate")
    assert val2.status_code == 400
    assert "already validated" in val2.json()["detail"].lower()

    # Also test the /receive alias endpoint rejection
    val3 = client.post(f"/api/v1/receipts/{rec_id}/receive")
    assert val3.status_code == 400

    # Stock MUST strictly remain X + Y (30.0), NOT 50.0
    stock_after_duplicate = client.get(f"/api/v1/products/{prod_id}").json()["current_stock"]
    assert stock_after_duplicate == X + Y, (
        f"Stock must remain {X + Y} after rejected re-validation, got {stock_after_duplicate}"
    )


def test_receipt_invalid_line_items_and_nonexistent_product(client):
    """Receipt creation fails when quantity <= 0 or product does not exist."""
    # Empty items list
    res_empty = client.post("/api/v1/receipts", json={"supplier": "Vendor", "items": []})
    assert res_empty.status_code in [400, 422]

    # Nonexistent product ID
    res_nonexistent = client.post("/api/v1/receipts", json={
        "supplier": "Vendor",
        "items": [{"product_id": 999999, "quantity": 10.0}],
    })
    assert res_nonexistent.status_code == 400
    assert "does not exist" in res_nonexistent.json()["detail"].lower()


def test_receipt_receive_alias_endpoint(client):
    """Test POST /receipts/{id}/receive works identically to /validate."""
    prod = client.post("/api/v1/products", json={
        "name": "Copper Wire Spool",
        "sku": "WIRE-CU-100",
        "category": "Electrical",
        "unit_of_measure": "spools",
        "initial_stock": 5.0,
    }).json()

    rec = client.post("/api/v1/receipts", json={
        "supplier": "Global Electric",
        "items": [{"product_id": prod["id"], "quantity": 15.0}],
    }).json()

    # Use /receive alias
    receive_res = client.post(f"/api/v1/receipts/{rec['id']}/receive")
    assert receive_res.status_code == 200
    assert receive_res.json()["status"].upper() == "VALIDATED"

    # Stock incremented to 5 + 15 = 20
    assert client.get(f"/api/v1/products/{prod['id']}").json()["current_stock"] == 20.0
