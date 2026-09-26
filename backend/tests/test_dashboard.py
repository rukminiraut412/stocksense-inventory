import pytest


def test_dashboard_unauthenticated(client):
    """Test dashboard fails without authentication token."""
    response = client.get("/api/v1/dashboard/kpis")
    assert response.status_code == 401


def test_dashboard_authenticated_and_kpis(client):
    """Test dashboard KPIs are returned with safe defaults and zero fake numbers."""
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Dashboard Tester",
            "email": "dash.test@example.com",
            "password": "Password123!",
            "role": "inventory_manager",
        },
    )
    token = signup_res.json()["access_token"]
    
    response = client.get(
        "/api/v1/dashboard/kpis",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    
    # Verify all 5 KPI cards exist
    assert "total_products_in_stock" in data
    assert "low_stock_out_of_stock" in data
    assert "pending_receipts" in data
    assert "pending_deliveries" in data
    assert "internal_transfers_scheduled" in data
    
    # Verify values are safe defaults (0) and not fake numbers
    kpi_keys = [
        "total_products_in_stock",
        "low_stock_out_of_stock",
        "pending_receipts",
        "pending_deliveries",
        "internal_transfers_scheduled",
    ]
    for key in kpi_keys:
        card = data[key]
        assert "title" in card
        assert "value" in card
        assert "status" in card
        assert "module_owner" in card
        assert "module_name" in card
        assert card["value"] == 0  # Safe default, zero fake data!
        
    assert data["total_products_in_stock"]["module_owner"] == "Member 2"
    assert data["pending_receipts"]["module_owner"] == "Member 2"
    assert data["pending_deliveries"]["module_owner"] == "Member 3"
    assert data["internal_transfers_scheduled"]["module_owner"] == "Member 3"
    assert data["low_stock_out_of_stock"]["module_owner"] == "Member 4"
