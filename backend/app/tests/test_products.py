import pytest


def test_create_product_success(client):
    payload = {
        "name": "Standard Laptop Stand",
        "sku": "STAND-001",
        "category": "Accessories",
        "unit_of_measure": "pcs",
        "initial_stock": 25.0
    }
    response = client.post("/api/products", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["name"] == "Standard Laptop Stand"
    assert data["sku"] == "STAND-001"
    assert data["category"] == "Accessories"
    assert data["unit_of_measure"] == "pcs"
    assert data["initial_stock"] == 25.0
    assert data["current_stock"] == 25.0
    assert "created_at" in data
    assert "updated_at" in data


def test_create_product_default_stock(client):
    payload = {
        "name": "Mechanical Keyboard",
        "sku": "KB-001",
        "category": "Peripherals",
        "unit_of_measure": "pcs"
    }
    response = client.post("/api/products", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["initial_stock"] == 0.0
    assert data["current_stock"] == 0.0


def test_create_product_duplicate_sku(client):
    payload = {
        "name": "USB-C Cable 1m",
        "sku": "CABLE-001",
        "category": "Cables",
        "unit_of_measure": "pcs",
        "initial_stock": 10
    }
    res1 = client.post("/api/products", json=payload)
    assert res1.status_code == 201

    # Attempt to create product with duplicate SKU
    res2 = client.post("/api/products", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_create_product_negative_stock(client):
    payload = {
        "name": "Invalid Item",
        "sku": "INV-001",
        "category": "Misc",
        "unit_of_measure": "pcs",
        "initial_stock": -5
    }
    response = client.post("/api/products", json=payload)
    # Pydantic ge=0 validation rejects with 422
    assert response.status_code == 422


def test_list_products(client):
    client.post("/api/products", json={
        "name": "Mouse Pad",
        "sku": "PAD-001",
        "category": "Accessories",
        "unit_of_measure": "pcs",
        "initial_stock": 15
    })
    client.post("/api/products", json={
        "name": "Webcam 1080p",
        "sku": "CAM-001",
        "category": "Electronics",
        "unit_of_measure": "pcs",
        "initial_stock": 5
    })

    res = client.get("/api/products")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2


def test_search_products_by_sku_and_name(client):
    client.post("/api/products", json={
        "name": "Ultra HD Monitor 27inch",
        "sku": "MON-UHD-27",
        "category": "Displays",
        "unit_of_measure": "pcs",
        "initial_stock": 8
    })
    client.post("/api/products", json={
        "name": "Desk Lamp",
        "sku": "LAMP-001",
        "category": "Lighting",
        "unit_of_measure": "pcs",
        "initial_stock": 12
    })

    # Search by SKU substring
    res = client.get("/api/products/search?q=MON-UHD")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["sku"] == "MON-UHD-27"

    # Search by name substring
    res2 = client.get("/api/products/search?q=Lamp")
    assert res2.status_code == 200
    results2 = res2.json()
    assert len(results2) == 1
    assert results2[0]["name"] == "Desk Lamp"


def test_update_product(client):
    create_res = client.post("/api/products", json={
        "name": "Old Monitor",
        "sku": "MON-001",
        "category": "Displays",
        "unit_of_measure": "pcs",
        "initial_stock": 10
    })
    product_id = create_res.json()["id"]

    update_payload = {
        "name": "New Gaming Monitor 144Hz",
        "category": "Gaming",
        "unit_of_measure": "box"
    }
    update_res = client.put(f"/api/products/{product_id}", json=update_payload)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "New Gaming Monitor 144Hz"
    assert updated_data["category"] == "Gaming"
    assert updated_data["unit_of_measure"] == "box"
    # Current stock remains unchanged
    assert updated_data["current_stock"] == 10.0


def test_get_product_by_id(client):
    create_res = client.post("/api/products", json={
        "name": "Headphones",
        "sku": "AUDIO-001",
        "category": "Audio",
        "unit_of_measure": "pcs"
    })
    product_id = create_res.json()["id"]

    get_res = client.get(f"/api/products/{product_id}")
    assert get_res.status_code == 200
    assert get_res.json()["sku"] == "AUDIO-001"

    notFound_res = client.get("/api/products/999999")
    assert notFound_res.status_code == 404
