# -*- coding: utf-8 -*-
"""
StockSense Phase 3 - Team Member 3 Hardening & Verification Suite
Tests:
- Delivery Orders Full Workflow & Transitions (DRAFT -> PICKED -> PACKED -> VALIDATED)
- Delivery Stock Decrement Exactly Once & Idempotency
- Delivery Edge Cases (zero, negative, excess stock, missing product, invalid transitions)
- Internal Transfers Stock Movement (A=100, B=20 -> A=70, B=50, Total=120)
- Transfer Idempotency & Persistence
- Transfer Edge Cases (insufficient, zero, negative, same location, missing)
- Transactional Data Consistency (Atomic multi-line failure, no partial updates)
- Regression Checks (Health, Products, Receipts, Frontend routes)
"""

import requests
import sys
import uuid
import os

BASE = "http://localhost:8000/api"
FRONTEND_BASE = "http://localhost:8000"

results = []


def check(label, condition, detail=""):
    if condition:
        print(f"[PASS] {label}")
        results.append((True, label))
    else:
        print(f"[FAIL] {label} {detail}")
        results.append((False, label))


def post(path, body):
    r = requests.post(f"{BASE}{path}", json=body)
    try:
        data = r.json()
    except Exception:
        data = r.text
    return r.status_code, data


def post_params(path, params):
    r = requests.post(f"{BASE}{path}", params=params)
    try:
        data = r.json()
    except Exception:
        data = r.text
    return r.status_code, data


def get(path):
    r = requests.get(f"{BASE}{path}")
    try:
        data = r.json()
    except Exception:
        data = r.text
    return r.status_code, data


def patch(path, body=None):
    r = requests.patch(f"{BASE}{path}", json=body)
    try:
        data = r.json()
    except Exception:
        data = r.text
    return r.status_code, data


# ============================================================
# 1. REGRESSION CHECKS
# ============================================================
print("\n" + "=" * 60)
print("1. REGRESSION & INTEGRATION CHECKS")
print("=" * 60)

sc, health = get("/health")
check("Health endpoint returns 200", sc == 200 and health.get("status") == "ok", f"got {sc} {health}")

sc, products_list = get("/products")
check("Products list returns 200", sc == 200 and isinstance(products_list, list), f"got {sc}")

sc, receipts_list = get("/receipts")
check("Receipts list returns 200", sc == 200 and isinstance(receipts_list, list), f"got {sc}")

for route in ["/", "/products", "/receipts", "/deliveries", "/deliveries/new", "/transfers", "/transfers/new"]:
    r = requests.get(f"{FRONTEND_BASE}{route}")
    check(f"Frontend route '{route}' serves 200", r.status_code == 200 and "StockSense" in r.text, f"got {r.status_code}")


# ============================================================
# 2. TASK 1: DELIVERY ORDERS FULL VERIFICATION
# ============================================================
print("\n" + "=" * 60)
print("2. TASK 1: DELIVERY ORDERS FULL VERIFICATION")
print("=" * 60)

# 1. Product stock = 100
sku_del = f"DEL-PROD-{uuid.uuid4().hex[:6].upper()}"
sc, prod1 = post("/products", {
    "name": "Delivery Test Product",
    "sku": sku_del,
    "category": "Testing",
    "unit_of_measure": "pcs",
    "initial_stock": 100.0,
    "low_stock_threshold": 10.0,
})
check("1. Product created with stock = 100", sc == 201 and prod1.get("current_stock") == 100.0, f"got {sc}")
PID1 = prod1["id"]

# 2. Create delivery = 20
sc, del1 = post("/deliveries", {
    "customer_name": "Acme Test Corp",
    "notes": "Verification shipment",
    "lines": [{"product_id": PID1, "quantity": 20.0}]
})
check("2. Create delivery with qty = 20 (status DRAFT)", sc == 201 and del1.get("status") == "DRAFT", f"got {sc}")
DEL_ID1 = del1["id"]

# 3. Verify stock = 100 before validation
sc, p_check = get(f"/products/{PID1}")
check("3. Product stock remains 100 before validation", p_check["current_stock"] == 100.0, f"got {p_check['current_stock']}")

# TEST: Invalid status transition - cannot validate from DRAFT
sc, err_draft_val = post(f"/deliveries/{DEL_ID1}/validate", {})
check("Test: Cannot validate from DRAFT status (400)", sc == 400, f"got {sc} {err_draft_val}")

# TEST: Invalid status transition - cannot skip directly to PACKED
sc, err_skip = patch(f"/deliveries/{DEL_ID1}/status", {"status": "PACKED"})
check("Test: Cannot skip from DRAFT to PACKED directly (400)", sc == 400, f"got {sc} {err_skip}")

# 4. Pick
sc, del_picked = patch(f"/deliveries/{DEL_ID1}/status", {"status": "PICKED"})
check("4. Pick delivery -> status PICKED", sc == 200 and del_picked.get("status") == "PICKED", f"got {sc}")

# TEST: Invalid status transition - cannot validate from PICKED
sc, err_pick_val = post(f"/deliveries/{DEL_ID1}/validate", {})
check("Test: Cannot validate from PICKED status (400)", sc == 400, f"got {sc} {err_pick_val}")

# 5. Pack
sc, del_packed = patch(f"/deliveries/{DEL_ID1}/status", {"status": "PACKED"})
check("5. Pack delivery -> status PACKED", sc == 200 and del_packed.get("status") == "PACKED", f"got {sc}")

# TEST: Cannot advance via status PATCH once PACKED (must use POST /validate)
sc, err_pack_patch = patch(f"/deliveries/{DEL_ID1}/status")
check("Test: Cannot advance from PACKED via PATCH status (400)", sc == 400, f"got {sc} {err_pack_patch}")

# 6. Validate
sc, del_validated = post(f"/deliveries/{DEL_ID1}/validate", {})
check("6. Validate delivery returns 200 and status VALIDATED", sc == 200 and del_validated.get("status") == "VALIDATED", f"got {sc}")

# 7. Verify stock = 80
sc, p_check2 = get(f"/products/{PID1}")
check("7. Stock decreased to 80 after validation", p_check2["current_stock"] == 80.0, f"got {p_check2['current_stock']}")

# 8. Refresh
sc, del_refreshed = get(f"/deliveries/{DEL_ID1}")
check("8. Refresh delivery details (status VALIDATED persists)", del_refreshed["status"] == "VALIDATED")

# 9. Verify stock persists at 80
sc, p_check3 = get(f"/products/{PID1}")
check("9. Stock remains 80 after refresh", p_check3["current_stock"] == 80.0, f"got {p_check3['current_stock']}")

# 10. Validate same delivery again
sc, err_dup_val = post(f"/deliveries/{DEL_ID1}/validate", {})
check("10. Duplicate validation rejected (400)", sc == 400, f"got {sc} {err_dup_val}")

# 11. Verify stock remains 80 after duplicate validation attempt
sc, p_check4 = get(f"/products/{PID1}")
check("11. Stock remains 80 (not decremented again)", p_check4["current_stock"] == 80.0, f"got {p_check4['current_stock']}")

# 12. Test quantity > available stock (available = 80, requesting 999)
sc, del_oversized = post("/deliveries", {
    "customer_name": "Over-order Corp",
    "lines": [{"product_id": PID1, "quantity": 999.0}]
})
OVER_ID = del_oversized["id"]
patch(f"/deliveries/{OVER_ID}/status")  # -> PICKED
patch(f"/deliveries/{OVER_ID}/status")  # -> PACKED
sc, err_over_val = post(f"/deliveries/{OVER_ID}/validate", {})
check("12. Validation fails safely when quantity > available stock (400)", sc == 400, f"got {sc} {err_over_val}")
sc, p_check5 = get(f"/products/{PID1}")
check("Stock remains 80 after failed oversized validation", p_check5["current_stock"] == 80.0, f"got {p_check5['current_stock']}")

# 13. Test zero quantity
sc, err_zero = post("/deliveries", {
    "lines": [{"product_id": PID1, "quantity": 0.0}]
})
check("13a. Zero quantity rejected on creation (400/422)", sc in [400, 422], f"got {sc}")

# 14. Test negative quantity
sc, err_neg = post("/deliveries", {
    "lines": [{"product_id": PID1, "quantity": -10.0}]
})
check("14. Negative quantity rejected on creation (400/422)", sc in [400, 422], f"got {sc}")

# 15. Test missing product
sc, err_missing_prod = post("/deliveries", {
    "lines": [{"product_id": 999999, "quantity": 5.0}]
})
check("15. Missing product ID rejected on creation (404)", sc == 404, f"got {sc}")


# ============================================================
# 3. TASK 2: INTERNAL TRANSFERS FULL VERIFICATION
# ============================================================
print("\n" + "=" * 60)
print("3. TASK 2: INTERNAL TRANSFERS FULL VERIFICATION")
print("=" * 60)

# Setup Warehouses A and B
sc, whs = get("/transfers/warehouses")
if len(whs) < 2:
    sc1, wh_a = post_params("/transfers/warehouses", {"name": "Central Hub A", "code": f"WH-CH-A-{uuid.uuid4().hex[:4]}", "location": "Building A"})
    sc2, wh_b = post_params("/transfers/warehouses", {"name": "Branch Depot B", "code": f"WH-BD-B-{uuid.uuid4().hex[:4]}", "location": "Building B"})
    WH_A_ID = wh_a["id"]
    WH_B_ID = wh_b["id"]
    WH_A_NAME = wh_a["name"]
    WH_B_NAME = wh_b["name"]
else:
    WH_A_ID = whs[0]["id"]
    WH_B_ID = whs[1]["id"]
    WH_A_NAME = whs[0]["name"]
    WH_B_NAME = whs[1]["name"]

# 1. Product with Total Stock = 120
sku_trf = f"TRF-PROD-{uuid.uuid4().hex[:6].upper()}"
sc, tprod1 = post("/products", {
    "name": "Transfer Verification Widget",
    "sku": sku_trf,
    "category": "Testing",
    "unit_of_measure": "pcs",
    "initial_stock": 120.0,
    "low_stock_threshold": 5.0,
})
check("1. Transfer product created (total stock = 120)", sc == 201 and tprod1.get("current_stock") == 120.0, f"got {sc}")
TPID1 = tprod1["id"]

# Seed per-warehouse stock: Location A = 100, Location B = 20
from backend.app.database import SessionLocal
from backend.app.models.transfer import StockLevel
from sqlalchemy import and_

def set_warehouse_stock(p_id, w_id, qty):
    db_s = SessionLocal()
    stk = db_s.query(StockLevel).filter(and_(StockLevel.product_id == p_id, StockLevel.warehouse_id == w_id)).first()
    if stk:
        stk.quantity = qty
    else:
        stk = StockLevel(product_id=p_id, warehouse_id=w_id, quantity=qty)
        db_s.add(stk)
    db_s.commit()
    db_s.close()

set_warehouse_stock(TPID1, WH_A_ID, 100.0)
set_warehouse_stock(TPID1, WH_B_ID, 20.0)

# Verify initial warehouse stock
db_v = SessionLocal()
s_a0 = db_v.query(StockLevel).filter(and_(StockLevel.product_id == TPID1, StockLevel.warehouse_id == WH_A_ID)).first().quantity
s_b0 = db_v.query(StockLevel).filter(and_(StockLevel.product_id == TPID1, StockLevel.warehouse_id == WH_B_ID)).first().quantity
db_v.close()
check("Initial Location A stock = 100", s_a0 == 100.0, f"got {s_a0}")
check("Initial Location B stock = 20", s_b0 == 20.0, f"got {s_b0}")
check("Initial Total stock = 120", (s_a0 + s_b0) == 120.0)

# 2. Transfer 30 from A -> B
sc, trf1 = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID1,
    "quantity": 30.0,
    "notes": "Stock rebalancing"
})
check("2. Create transfer for qty = 30 (status DRAFT)", sc == 201 and trf1.get("status") == "DRAFT", f"got {sc}")
TRF_ID1 = trf1["id"]

# 3. Validate transfer
sc, trf_val = post(f"/transfers/{TRF_ID1}/validate", {})
check("3. Validate transfer returns 200 (status VALIDATED)", sc == 200 and trf_val.get("status") == "VALIDATED", f"got {sc}")

# 4. Verify A = 70, B = 50, Total = 120
db_v2 = SessionLocal()
s_a1 = db_v2.query(StockLevel).filter(and_(StockLevel.product_id == TPID1, StockLevel.warehouse_id == WH_A_ID)).first().quantity
s_b1 = db_v2.query(StockLevel).filter(and_(StockLevel.product_id == TPID1, StockLevel.warehouse_id == WH_B_ID)).first().quantity
db_v2.close()
check("4a. Location A stock becomes 70", s_a1 == 70.0, f"got {s_a1}")
check("4b. Location B stock becomes 50", s_b1 == 50.0, f"got {s_b1}")
check("4c. Sum of locations remains 120", (s_a1 + s_b1) == 120.0)

# 5. Product total company stock remains 120
sc, p_trf_check = get(f"/products/{TPID1}")
check("5. Total company stock (Product.current_stock) remains UNCHANGED at 120", p_trf_check["current_stock"] == 120.0, f"got {p_trf_check['current_stock']}")

# 6. Refresh
sc, trf_refreshed = get(f"/transfers/{TRF_ID1}")
check("6. Refresh transfer detail (status VALIDATED persists)", trf_refreshed["status"] == "VALIDATED")

# 7. Attempt second validation
sc, err_trf_dup = post(f"/transfers/{TRF_ID1}/validate", {})
check("7. Duplicate transfer validation rejected (400)", sc == 400, f"got {sc} {err_trf_dup}")

# 8. Verify no additional movement after duplicate attempt
db_v3 = SessionLocal()
s_a2 = db_v3.query(StockLevel).filter(and_(StockLevel.product_id == TPID1, StockLevel.warehouse_id == WH_A_ID)).first().quantity
s_b2 = db_v3.query(StockLevel).filter(and_(StockLevel.product_id == TPID1, StockLevel.warehouse_id == WH_B_ID)).first().quantity
db_v3.close()
check("8a. Location A remains 70 after retry", s_a2 == 70.0, f"got {s_a2}")
check("8b. Location B remains 50 after retry", s_b2 == 50.0, f"got {s_b2}")

# 9. Test insufficient source stock (A has 70, requesting 99999)
sc, trf_over = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID1,
    "quantity": 99999.0
})
check("9a. Oversized transfer created as DRAFT", sc == 201)
sc, err_over_trf = post(f"/transfers/{trf_over['id']}/validate", {})
check("9b. Validation fails safely for insufficient source stock (400)", sc == 400, f"got {sc} {err_over_trf}")

# 10. Test same source and destination
sc, err_same_loc = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_A_ID,
    "product_id": TPID1,
    "quantity": 10.0
})
check("10. Same source and destination rejected (400/422)", sc in [400, 422], f"got {sc}")

# 11. Test zero quantity
sc, err_trf_zero = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID1,
    "quantity": 0.0
})
check("11. Zero transfer quantity rejected (400/422)", sc in [400, 422], f"got {sc}")

# 12. Test negative quantity
sc, err_trf_neg = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID1,
    "quantity": -15.0
})
check("12. Negative transfer quantity rejected (400/422)", sc in [400, 422], f"got {sc}")

# 13. Test missing warehouse
sc, err_trf_miss_wh = post("/transfers", {
    "source_warehouse_id": 999999,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID1,
    "quantity": 5.0
})
check("13. Missing warehouse ID rejected on transfer creation (404)", sc == 404, f"got {sc}")

# 14. Test missing product
sc, err_trf_miss_prod = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": 999999,
    "quantity": 5.0
})
check("14. Missing product ID rejected on transfer creation (404)", sc == 404, f"got {sc}")


# ============================================================
# 4. TASK 3: TRANSACTIONAL DATA CONSISTENCY
# ============================================================
print("\n" + "=" * 60)
print("4. TASK 3: TRANSACTIONAL DATA CONSISTENCY")
print("=" * 60)

# Create two products for multi-line atomic test
sc, p_multi1 = post("/products", {
    "name": "Atomic Multi 1",
    "sku": f"ATOM-1-{uuid.uuid4().hex[:6].upper()}",
    "category": "Test",
    "unit_of_measure": "pcs",
    "initial_stock": 50.0,
})
PID_M1 = p_multi1["id"]

sc, p_multi2 = post("/products", {
    "name": "Atomic Multi 2",
    "sku": f"ATOM-2-{uuid.uuid4().hex[:6].upper()}",
    "category": "Test",
    "unit_of_measure": "pcs",
    "initial_stock": 5.0,  # insufficient for requested 25
})
PID_M2 = p_multi2["id"]

# Create delivery: Line 1 has stock (50 >= 10), Line 2 has INSUFFICIENT stock (5 < 25)
sc, del_atomic = post("/deliveries", {
    "customer_name": "Atomic Test Customer",
    "lines": [
        {"product_id": PID_M1, "quantity": 10.0},
        {"product_id": PID_M2, "quantity": 25.0},
    ]
})
DEL_ATOMIC_ID = del_atomic["id"]
patch(f"/deliveries/{DEL_ATOMIC_ID}/status")  # -> PICKED
patch(f"/deliveries/{DEL_ATOMIC_ID}/status")  # -> PACKED

# Attempt validation - must fail because Line 2 lacks stock
sc, err_atomic_val = post(f"/deliveries/{DEL_ATOMIC_ID}/validate", {})
check("Multi-line validation fails when one line lacks stock (400)", sc == 400, f"got {sc}")

# VERIFY: Line 1 product stock was NOT decremented (must still be 50.0)
sc, p_m1_after = get(f"/products/{PID_M1}")
check("Transaction safety: Product 1 stock was NOT partially decremented (still 50)", p_m1_after["current_stock"] == 50.0, f"got {p_m1_after['current_stock']}")

sc, p_m2_after = get(f"/products/{PID_M2}")
check("Product 2 stock remains 5.0", p_m2_after["current_stock"] == 5.0, f"got {p_m2_after['current_stock']}")


# ============================================================
# SUMMARY
# ============================================================
print("\n" + "=" * 60)
print("PHASE 3 VERIFICATION SUMMARY")
print("=" * 60)
passed = sum(1 for r in results if r[0])
total = len(results)
print(f"Passed: {passed}/{total}")
for ok, label in results:
    print(f"  [{'OK' if ok else 'XX'}] {label}")

if passed == total:
    print("\n[SUCCESS] All Phase 3 verification tests passed successfully!")
    sys.exit(0)
else:
    print(f"\n[FAILURE] {total - passed} test(s) failed.")
    sys.exit(1)
