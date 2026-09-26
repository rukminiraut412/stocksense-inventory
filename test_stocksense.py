# -*- coding: utf-8 -*-
# StockSense - Team Member 3 Integration Test Suite
# Tests all 18 scenarios required by the task spec.
# Run with: python test_stocksense.py
# Server must be running on http://localhost:5000

import requests
import sys
import uuid

BASE = "http://localhost:5000/api"
PASS_LBL = "[PASS]"
FAIL_LBL = "[FAIL]"
INFO_LBL = "[INFO]"

results = []


def check(label, condition, detail=""):
    if condition:
        print(f"{PASS_LBL} {label}")
        results.append((True, label))
    else:
        print(f"{FAIL_LBL} {label} {detail}")
        results.append((False, label))


def post(path, body):
    r = requests.post(f"{BASE}{path}", json=body)
    return r.status_code, r.json()


def get(path):
    r = requests.get(f"{BASE}{path}")
    return r.status_code, r.json()


def patch(path, body=None):
    r = requests.patch(f"{BASE}{path}", json=body or {})
    return r.status_code, r.json()


# ============================================================
# SETUP: Create a product with stock 100
# ============================================================
print("\n" + "=" * 60)
print("SETUP - Create product with stock 100")
print("=" * 60)

sc, product = post("/products", {
    "name": "Test Widget",
    "sku": f"TW-TEST-{uuid.uuid4().hex[:6]}",
    "current_stock": 100
})
print(f"{INFO_LBL} Created product: {product}")
check("Product created with stock 100", sc == 201 and product.get("current_stock") == 100)
PID = product["id"]

# ============================================================
# DELIVERY TESTS
# ============================================================
print("\n" + "=" * 60)
print("DELIVERY TESTS")
print("=" * 60)

# Test 1 - Create delivery for quantity 20
print("\n--- Test 1: Create delivery for qty 20 ---")
sc, delivery = post("/deliveries", {
    "customer_name": "Test Customer",
    "lines": [{"product_id": PID, "quantity": 20}]
})
check("T1: Delivery created (status DRAFT)", sc == 201 and delivery.get("status") == "DRAFT")
DEL_ID = delivery["id"]

# Test 2 - Stock remains 100 before validation
print("\n--- Test 2: Stock remains 100 before validation ---")
sc, prod = get(f"/products/{PID}")
check("T2: Stock is still 100 before validation", prod["current_stock"] == 100,
      f"(got {prod.get('current_stock')})")

# Advance status: DRAFT -> PICKED -> PACKED
print("\n--- Advance status to PACKED for validation ---")
sc, d = patch(f"/deliveries/{DEL_ID}/status")
check("Status advanced to PICKED", sc == 200 and d.get("status") == "PICKED")
sc, d = patch(f"/deliveries/{DEL_ID}/status")
check("Status advanced to PACKED", sc == 200 and d.get("status") == "PACKED")

# Test 3 - Validate delivery
print("\n--- Test 3: Validate delivery ---")
sc, res = post(f"/deliveries/{DEL_ID}/validate", {})
check("T3: Validation returns 200", sc == 200, f"(got {sc}, {res})")
check("T3: Status is VALIDATED", res.get("delivery", {}).get("status") == "VALIDATED")

# Test 4 - Stock decremented to 80
print("\n--- Test 4: Verify stock is now 80 ---")
sc, prod = get(f"/products/{PID}")
check("T4: Stock is now 80", prod["current_stock"] == 80,
      f"(got {prod.get('current_stock')})")

# Test 5 - Try validating again (double-validation guard)
print("\n--- Test 5: Try validating delivery again ---")
sc, res = post(f"/deliveries/{DEL_ID}/validate", {})
check("T5: Second validation rejected (400)", sc == 400, f"(got {sc})")

# Test 6 - Stock still 80 after rejected second validation
print("\n--- Test 6: Stock remains 80 after duplicate validation attempt ---")
sc, prod = get(f"/products/{PID}")
check("T6: Stock is still 80", prod["current_stock"] == 80,
      f"(got {prod.get('current_stock')})")

# Test 7 - Try delivery quantity > available stock
print("\n--- Test 7: Try delivery qty > available stock ---")
sc, big_delivery = post("/deliveries", {
    "customer_name": "Overflow Customer",
    "lines": [{"product_id": PID, "quantity": 9999}]
})
BIG_DEL_ID = big_delivery.get("id")
check("T7: Big delivery created as DRAFT", sc == 201)
# Advance to PACKED
patch(f"/deliveries/{BIG_DEL_ID}/status")
patch(f"/deliveries/{BIG_DEL_ID}/status")
sc, res = post(f"/deliveries/{BIG_DEL_ID}/validate", {})
check("T7: Validation of oversized delivery fails (400)", sc == 400, f"(got {sc}, {res})")
print(f"{INFO_LBL} Error: {res.get('error')}")

# Test 8 - Stock safe after failed large delivery
print("\n--- Test 8: Stock unchanged after failed large delivery ---")
sc, prod = get(f"/products/{PID}")
check("T8: Stock is still 80", prod["current_stock"] == 80,
      f"(got {prod.get('current_stock')})")

# ============================================================
# TRANSFER TESTS
# ============================================================
print("\n" + "=" * 60)
print("TRANSFER TESTS")
print("=" * 60)

# Setup: Create product with stock 120 (A=100, B=20)
sc, tprod = post("/products", {
    "name": "Transfer Widget",
    "sku": f"TR-TEST-{uuid.uuid4().hex[:6]}",
    "current_stock": 120
})
check("Setup: Transfer product created (stock=120)", sc == 201)
TPID = tprod["id"]

# Create 2 locations
sc, locA = post("/locations", {"name": "Warehouse A", "warehouse": "Main"})
check("Setup: Location A created", sc == 201)
LID_A = locA["id"]

sc, locB = post("/locations", {"name": "Warehouse B", "warehouse": "Main"})
check("Setup: Location B created", sc == 201)
LID_B = locB["id"]

# Seed location stocks
sc, _ = post(f"/locations/{LID_A}/stock", {"product_id": TPID, "quantity": 100})
check("Setup: Location A stock set to 100", sc == 200)
sc, _ = post(f"/locations/{LID_B}/stock", {"product_id": TPID, "quantity": 20})
check("Setup: Location B stock set to 20", sc == 200)

# Transfer Test T1 - Create transfer 30 from A -> B
print("\n--- Transfer Test T1: Create transfer A->B qty=30 ---")
sc, transfer = post("/transfers", {
    "source_location_id": LID_A,
    "destination_location_id": LID_B,
    "product_id": TPID,
    "quantity": 30,
    "notes": "Test transfer"
})
check("TT1: Transfer created (status DRAFT)", sc == 201 and transfer.get("status") == "DRAFT",
      f"(got {sc}, {transfer})")
TID = transfer["id"]

# Transfer Test T2 - Validate transfer
print("\n--- Transfer Test T2: Validate transfer ---")
sc, res = post(f"/transfers/{TID}/validate", {})
check("TT2: Validation returns 200", sc == 200, f"(got {sc}, {res})")
check("TT2: Source stock after = 70", res.get("source_stock_after") == 70,
      f"(got {res.get('source_stock_after')})")
check("TT2: Destination stock after = 50", res.get("destination_stock_after") == 50,
      f"(got {res.get('destination_stock_after')})")

# Transfer Test T3 - Total stock unchanged (still 120)
print("\n--- Transfer Test T3: Verify total stock unchanged ---")
sc, tprod2 = get(f"/products/{TPID}")
check("TT3: Total product stock still 120", tprod2["current_stock"] == 120,
      f"(got {tprod2.get('current_stock')})")

# Transfer Test T4 - Try validating same transfer again
print("\n--- Transfer Test T4: Double-validation guard ---")
sc, res = post(f"/transfers/{TID}/validate", {})
check("TT4: Second validation rejected (400)", sc == 400, f"(got {sc})")

# Transfer Test T5 - Stock unchanged after duplicate validation
print("\n--- Transfer Test T5: Stock unchanged after retry ---")
sc, tprod3 = get(f"/products/{TPID}")
check("TT5: Total stock still 120 after retry", tprod3["current_stock"] == 120,
      f"(got {tprod3.get('current_stock')})")

# Transfer Test T6 - Insufficient source stock
print("\n--- Transfer Test T6: Insufficient source stock ---")
sc, big_trf = post("/transfers", {
    "source_location_id": LID_A,
    "destination_location_id": LID_B,
    "product_id": TPID,
    "quantity": 9999,
})
check("TT6: Oversized transfer created as DRAFT", sc == 201)
sc, res = post(f"/transfers/{big_trf['id']}/validate", {})
check("TT6: Validation fails (400 insufficient stock)", sc == 400, f"(got {sc})")
print(f"{INFO_LBL} Error: {res.get('error')}")

# Transfer Test T7 - Same source and destination
print("\n--- Transfer Test T7: Same source=destination ---")
sc, res = post("/transfers", {
    "source_location_id": LID_A,
    "destination_location_id": LID_A,
    "product_id": TPID,
    "quantity": 10,
})
check("TT7: Same-location transfer rejected (400)", sc == 400, f"(got {sc}, {res})")

# ============================================================
# SUMMARY
# ============================================================
print("\n" + "=" * 60)
print("TEST SUMMARY")
print("=" * 60)
passed = sum(1 for r in results if r[0])
total = len(results)
print(f"Passed: {passed}/{total}")
for ok, label in results:
    mark = "OK" if ok else "XX"
    print(f"  [{mark}] {label}")

if passed == total:
    print("\nAll tests passed!")
    sys.exit(0)
else:
    print(f"\n{total - passed} test(s) failed.")
    sys.exit(1)
