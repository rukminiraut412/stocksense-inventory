import pytest


def test_receipt_lifecycle_and_stock_increase(client):
    # 1. Create a product with stock 0
    prod_res = client.post("/api/products", json={
        "name": "Steel Bolt M8",
        "sku": "BOLT-M8",
        "category": "Fasteners",
        "unit_of_measure": "pcs",
        "initial_stock": 0.0
    })
    assert prod_res.status_code == 201
    prod_data = prod_res.json()
    product_id = prod_data["id"]
    assert prod_data["current_stock"] == 0.0

    # 2. Create a receipt for quantity 50
    receipt_payload = {
        "supplier": "Fastener World Ltd",
        "items": [
            {"product_id": product_id, "quantity": 50.0}
        ]
    }
    rec_res = client.post("/api/receipts", json=receipt_payload)
    assert rec_res.status_code == 201
    receipt = rec_res.json()
    receipt_id = receipt["id"]
    assert receipt["status"] == "DRAFT"
    assert receipt["supplier"] == "Fastener World Ltd"
    assert len(receipt["items"]) == 1
    assert receipt["items"][0]["quantity"] == 50.0

    # 3. Verify stock is still 0 while receipt is DRAFT
    prod_check = client.get(f"/api/products/{product_id}").json()
    assert prod_check["current_stock"] == 0.0

    # 4. Validate the receipt
    val_res = client.post(f"/api/receipts/{receipt_id}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["status"] == "VALIDATED"
    assert val_data["validated_at"] is not None

    # 5. Verify stock becomes 50
    prod_after_val = client.get(f"/api/products/{product_id}").json()
    assert prod_after_val["current_stock"] == 50.0

    # 6. Try validating the same receipt again
    dup_val_res = client.post(f"/api/receipts/{receipt_id}/validate")
    assert dup_val_res.status_code == 400
    assert "already validated" in dup_val_res.json()["detail"].lower()

    # 7. Verify stock remains 50 and is NOT increased to 100
    prod_after_dup = client.get(f"/api/products/{product_id}").json()
    assert prod_after_dup["current_stock"] == 50.0


def test_receipt_invalid_quantities(client):
    # Create product
    prod = client.post("/api/products", json={
        "name": "Sample Bearing",
        "sku": "BRG-001",
        "category": "Hardware",
        "unit_of_measure": "pcs",
        "initial_stock": 10.0
    }).json()

    # Test negative quantity (rejected by Pydantic gt=0 with 422)
    neg_res = client.post("/api/receipts", json={
        "supplier": "Test Supplier",
        "items": [{"product_id": prod["id"], "quantity": -5.0}]
    })
    assert neg_res.status_code == 422

    # Test zero quantity (rejected by Pydantic gt=0 with 422)
    zero_res = client.post("/api/receipts", json={
        "supplier": "Test Supplier",
        "items": [{"product_id": prod["id"], "quantity": 0.0}]
    })
    assert zero_res.status_code == 422


def test_receipt_nonexistent_product(client):
    res = client.post("/api/receipts", json={
        "supplier": "Phantom Supplier",
        "items": [{"product_id": 99999, "quantity": 10.0}]
    })
    assert res.status_code == 400
    assert "does not exist" in res.json()["detail"]


def test_receipt_details_and_listing(client):
    # Create product
    prod = client.post("/api/products", json={
        "name": "Copper Pipe 15mm",
        "sku": "PIPE-15",
        "category": "Plumbing",
        "unit_of_measure": "meters",
        "initial_stock": 5.0
    }).json()

    # Create receipt
    rec = client.post("/api/receipts", json={
        "supplier": "PlumbCorp",
        "items": [{"product_id": prod["id"], "quantity": 25.0}]
    }).json()

    # List receipts
    list_res = client.get("/api/receipts")
    assert list_res.status_code == 200
    all_receipts = list_res.json()
    assert len(all_receipts) >= 1

    # Get receipt details
    detail_res = client.get(f"/api/receipts/{rec['id']}")
    assert detail_res.status_code == 200
    details = detail_res.json()
    assert details["receipt_number"] == rec["receipt_number"]
    assert details["supplier"] == "PlumbCorp"
    assert len(details["items"]) == 1
    assert details["items"][0]["product_name"] == "Copper Pipe 15mm"
    assert details["items"][0]["product_sku"] == "PIPE-15"
    assert details["items"][0]["quantity"] == 25.0


def test_receipt_validation_stock_increase_exact_calculation(client):
    # Initial stock = 20, Receipt quantity = 50 -> Before val: 20, After val: 70
    prod = client.post("/api/products", json={
        "name": "Precision Sensor",
        "sku": "SENS-020",
        "category": "Sensors",
        "unit_of_measure": "pcs",
        "initial_stock": 20.0
    }).json()
    prod_id = prod["id"]
    assert prod["current_stock"] == 20.0

    # Create receipt
    rec = client.post("/api/receipts", json={
        "supplier": "SensorTech Inc",
        "items": [{"product_id": prod_id, "quantity": 50.0}]
    }).json()
    rec_id = rec["id"]

    # Before validation: stock = 20
    check1 = client.get(f"/api/products/{prod_id}").json()
    assert check1["current_stock"] == 20.0

    # Validate
    val = client.post(f"/api/receipts/{rec_id}/validate")
    assert val.status_code == 200

    # After validation: stock = 70
    check2 = client.get(f"/api/products/{prod_id}").json()
    assert check2["current_stock"] == 70.0

    # Re-validate rejected, stock remains 70
    reval = client.post(f"/api/receipts/{rec_id}/validate")
    assert reval.status_code == 400
    check3 = client.get(f"/api/products/{prod_id}").json()
    assert check3["current_stock"] == 70.0


def test_receipt_validation_atomic_rollback_on_failure(client, db_session):
    # Product A (stock 10), Product B (stock 5)
    prod_a = client.post("/api/products", json={
        "name": "Component Alpha",
        "sku": "COMP-ALPHA",
        "category": "Components",
        "unit_of_measure": "pcs",
        "initial_stock": 10.0
    }).json()

    prod_b = client.post("/api/products", json={
        "name": "Component Beta",
        "sku": "COMP-BETA",
        "category": "Components",
        "unit_of_measure": "pcs",
        "initial_stock": 5.0
    }).json()

    # Create multi-item receipt
    rec = client.post("/api/receipts", json={
        "supplier": "Multi Vendor",
        "items": [
            {"product_id": prod_a["id"], "quantity": 30.0},
            {"product_id": prod_b["id"], "quantity": 15.0}
        ]
    }).json()

    # Now delete product B from database to trigger an error during validation loop
    client.delete(f"/api/products/{prod_b['id']}")

    # Attempt to validate receipt - must fail
    val_res = client.post(f"/api/receipts/{rec['id']}/validate")
    assert val_res.status_code == 400
    assert "no longer exists" in val_res.json()["detail"].lower()

    # Product A stock must NOT have been incremented (atomic rollback)
    check_a = client.get(f"/api/products/{prod_a['id']}").json()
    assert check_a["current_stock"] == 10.0, "Product A stock must remain 10.0 due to atomic rollback"

    # Receipt must remain DRAFT
    rec_check = client.get(f"/api/receipts/{rec['id']}").json()
    assert rec_check["status"] == "DRAFT"
