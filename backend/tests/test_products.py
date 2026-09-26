import pytest


def test_create_product_success(client):
    """Step 2.1 & 2.4 & 2.5: Create product with valid data, verify persistence and retrieval."""
    payload = {
        "name": "Industrial Widget X",
        "sku": "WIDGET-X-001",
        "category": "Widgets",
        "unit_of_measure": "pcs",
        "initial_stock": 25.0,
        "low_stock_threshold": 5.0,
    }
    response = client.post("/api/v1/products", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["name"] == payload["name"]
    assert data["sku"] == payload["sku"]
    assert data["category"] == payload["category"]
    assert data["unit_of_measure"] == payload["unit_of_measure"]
    assert data["current_stock"] == 25.0
    assert data["initial_stock"] == 25.0
    assert data["low_stock_threshold"] == 5.0
    assert data["created_at"] is not None
    assert data["updated_at"] is not None

    # Fetch product by ID
    get_res = client.get(f"/api/v1/products/{data['id']}")
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["name"] == payload["name"]
    assert fetched["sku"] == payload["sku"]
    assert fetched["current_stock"] == 25.0


def test_product_required_field_validation(client):
    """Step 2.2: Required field validation - empty strings and missing fields are rejected."""
    # Missing name
    res1 = client.post("/api/v1/products", json={
        "sku": "SKU-VALID",
        "category": "Hardware",
        "unit_of_measure": "pcs",
    })
    assert res1.status_code == 422

    # Whitespace-only name
    res2 = client.post("/api/v1/products", json={
        "name": "   ",
        "sku": "SKU-VALID-2",
        "category": "Hardware",
        "unit_of_measure": "pcs",
    })
    assert res2.status_code == 422

    # Missing SKU
    res3 = client.post("/api/v1/products", json={
        "name": "Good Product",
        "category": "Hardware",
        "unit_of_measure": "pcs",
    })
    assert res3.status_code == 422


def test_duplicate_sku_rejection(client):
    """Step 2.3: Duplicate SKU is rejected with HTTP 400."""
    payload = {
        "name": "First Product",
        "sku": "UNIQUE-SKU-100",
        "category": "General",
        "unit_of_measure": "units",
        "initial_stock": 10.0,
    }
    res1 = client.post("/api/v1/products", json=payload)
    assert res1.status_code == 201

    # Attempt to create second product with exact same SKU
    dup_payload = {
        "name": "Second Product Different Name",
        "sku": "UNIQUE-SKU-100",
        "category": "General",
        "unit_of_measure": "units",
        "initial_stock": 5.0,
    }
    res2 = client.post("/api/v1/products", json=dup_payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()


def test_product_update(client):
    """Step 2.6: Product can be updated."""
    create_res = client.post("/api/v1/products", json={
        "name": "Original Name",
        "sku": "UPDATE-SKU-1",
        "category": "Original Cat",
        "unit_of_measure": "pcs",
        "initial_stock": 15.0,
        "low_stock_threshold": 10.0,
    })
    product_id = create_res.json()["id"]

    # Update name, category, and low stock threshold
    update_res = client.put(f"/api/v1/products/{product_id}", json={
        "name": "Updated Name",
        "category": "Updated Cat",
        "low_stock_threshold": 2.0,
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Updated Name"
    assert updated["category"] == "Updated Cat"
    assert updated["low_stock_threshold"] == 2.0
    assert updated["sku"] == "UPDATE-SKU-1"


def test_product_search_by_name_and_sku(client):
    """Step 2.7: Search works by name and SKU."""
    client.post("/api/v1/products", json={
        "name": "Hex Bolt 10mm",
        "sku": "FASTENER-HEX-10",
        "category": "Fasteners",
        "unit_of_measure": "pcs",
    })
    client.post("/api/v1/products", json={
        "name": "Nylon Washer 10mm",
        "sku": "FASTENER-WASH-10",
        "category": "Fasteners",
        "unit_of_measure": "pcs",
    })

    # Search by SKU using /search?q=
    res_sku = client.get("/api/v1/products/search?q=HEX-10")
    assert res_sku.status_code == 200
    results_sku = res_sku.json()
    assert len(results_sku) == 1
    assert results_sku[0]["sku"] == "FASTENER-HEX-10"

    # Search by Name using /search?q=
    res_name = client.get("/api/v1/products/search?q=Washer")
    assert res_name.status_code == 200
    results_name = res_name.json()
    assert len(results_name) == 1
    assert results_name[0]["name"] == "Nylon Washer 10mm"

    # Search using list query param ?search=
    res_param = client.get("/api/v1/products?search=Fastener")
    assert res_param.status_code == 200
    assert len(res_param.json()) == 2


def test_invalid_product_data_rejected(client):
    """Step 2.8: Invalid product data (e.g. negative stock) is rejected."""
    neg_stock_res = client.post("/api/v1/products", json={
        "name": "Negative Item",
        "sku": "NEG-001",
        "category": "Invalid",
        "unit_of_measure": "pcs",
        "initial_stock": -10.0,
    })
    assert neg_stock_res.status_code in [400, 422]


def test_product_low_stock_threshold(client):
    """Step 2.9: Low stock threshold field is supported, persisted, and configurable."""
    res = client.post("/api/v1/products", json={
        "name": "Safety Valve",
        "sku": "VALVE-SAFE-1",
        "category": "Plumbing",
        "unit_of_measure": "pcs",
        "initial_stock": 8.0,
        "low_stock_threshold": 12.0,
    })
    assert res.status_code == 201
    data = res.json()
    assert data["low_stock_threshold"] == 12.0
    assert data["current_stock"] == 8.0
    # current_stock (8) <= low_stock_threshold (12) indicates low stock alert
