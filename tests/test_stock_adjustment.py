"""
Automated verification tests for Stock Adjustment / Physical Stock Adjustment.
Verifies all 10 mandatory checks:
- TEST 1: Current 100 -> Counted 95 (Difference = -5, new stock = 95)
- TEST 2: Current 100 -> Counted 120 (Difference = +20, new stock = 120)
- TEST 3: Adjustment recorded in stock ledger / move history
- TEST 4: Product / Location selection works
- TEST 5: Invalid product / location rejected with 404
- TEST 6: Negative counted quantity rejected (400)
- TEST 7: Receipts regression check
- TEST 8: Deliveries regression check
- TEST 9: Internal Transfers regression check
- TEST 10: Dashboard / Health regression check
"""

import httpx
import pytest

BASE_URL = "http://127.0.0.1:8000"


def test_stock_adjustment_full_workflow():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # TEST 4: Product and warehouse selection
        p_res = client.get("/api/products")
        assert p_res.status_code == 200
        products = p_res.json()
        assert len(products) > 0
        product = products[0]
        pid = product["id"]

        w_res = client.get("/api/warehouses")
        assert w_res.status_code == 200
        warehouses = w_res.json()
        assert len(warehouses) > 0
        warehouse = warehouses[0]
        wid = warehouse["id"]

        # Seed baseline: stock = 100
        seed_res = client.post(
            "/api/transfers/stock-levels",
            params={"product_id": pid, "warehouse_id": wid, "quantity": 100.0},
        )
        assert seed_res.status_code == 200

        # Query recorded stock
        rec_res = client.get(
            "/api/adjustments/recorded-stock",
            params={"productId": pid, "warehouseId": wid},
        )
        assert rec_res.status_code == 200
        rec_data = rec_res.json()
        assert rec_data["recorded_quantity"] == 100.0

        # TEST 1: Counted = 95 -> Diff = -5
        adj1_res = client.post(
            "/api/adjustments",
            json={
                "product_id": pid,
                "warehouse_id": wid,
                "counted_quantity": 95.0,
                "reason": "Cycle count shrinkage",
                "user": "Lead Auditor",
            },
        )
        assert adj1_res.status_code == 201
        adj1 = adj1_res.json()
        assert adj1["recorded_quantity"] == 100.0
        assert adj1["physical_quantity"] == 95.0
        assert adj1["difference"] == -5.0
        assert adj1["status"] == "APPLIED"

        # Verify new stock persisted at 95
        check1 = client.get(
            "/api/adjustments/recorded-stock",
            params={"productId": pid, "warehouseId": wid},
        )
        assert check1.json()["recorded_quantity"] == 95.0

        # Reset to 100 for TEST 2
        client.post(
            "/api/transfers/stock-levels",
            params={"product_id": pid, "warehouse_id": wid, "quantity": 100.0},
        )

        # TEST 2: Counted = 120 -> Diff = +20
        adj2_res = client.post(
            "/api/adjustments",
            json={
                "product_id": pid,
                "warehouse_id": wid,
                "counted_quantity": 120.0,
                "reason": "Found misplaced inventory",
                "user": "Lead Auditor",
            },
        )
        assert adj2_res.status_code == 201
        adj2 = adj2_res.json()
        assert adj2["recorded_quantity"] == 100.0
        assert adj2["physical_quantity"] == 120.0
        assert adj2["difference"] == 20.0
        assert adj2["status"] == "APPLIED"

        # Verify new stock persisted at 120
        check2 = client.get(
            "/api/adjustments/recorded-stock",
            params={"productId": pid, "warehouseId": wid},
        )
        assert check2.json()["recorded_quantity"] == 120.0

        # TEST 3: Verify recorded in stock ledger
        ledger_res = client.get(
            "/api/ledger",
            params={"product_id": pid, "warehouse_id": wid, "movement_type": "ADJUSTMENT"},
        )
        assert ledger_res.status_code == 200
        ledger = ledger_res.json()
        assert len(ledger) >= 2
        latest = ledger[0]
        assert latest["movement_type"] == "ADJUSTMENT"
        assert latest["new_stock"] == 120.0
        assert latest["quantity"] == 20.0
        assert "reference_id" in latest

        # TEST 5: Invalid product or warehouse rejected with 404
        inv_prod = client.post(
            "/api/adjustments",
            json={"product_id": 999999, "warehouse_id": wid, "counted_quantity": 50.0},
        )
        assert inv_prod.status_code == 404

        inv_wh = client.post(
            "/api/adjustments",
            json={"product_id": pid, "warehouse_id": 999999, "counted_quantity": 50.0},
        )
        assert inv_wh.status_code == 404

        # TEST 6: Negative counted quantity rejected
        neg_res = client.post(
            "/api/adjustments",
            json={"product_id": pid, "warehouse_id": wid, "counted_quantity": -15.0},
        )
        assert neg_res.status_code in [400, 422]

        # TEST 7: Regression - Receipts
        receipts_res = client.get("/api/receipts")
        assert receipts_res.status_code == 200

        # TEST 8: Regression - Deliveries
        deliveries_res = client.get("/api/deliveries")
        assert deliveries_res.status_code == 200

        # TEST 9: Regression - Transfers
        transfers_res = client.get("/api/transfers")
        assert transfers_res.status_code == 200

        # TEST 10: Regression - Health & Dashboard
        health_res = client.get("/health")
        assert health_res.status_code == 200
        api_health_res = client.get("/api/health")
        assert api_health_res.status_code == 200


if __name__ == "__main__":
    test_stock_adjustment_full_workflow()
    print("ALL 10 MANDATORY STOCK ADJUSTMENT TESTS PASSED!")
