# -*- coding: utf-8 -*-
"""
StockSense Phase 4 - Final Pre-Integration End-to-End Verification
Covers:
- Step 2: Delivery E2E Test
- Step 3: Transfer E2E Test
- Step 4: Transaction & Data Consistency Check
- Step 5: Regression Check
"""

import requests
import sys
import uuid

API_BASE = "http://localhost:8000/api"
UI_BASE = "http://localhost:8000"

results = []


def check(label, condition, detail=""):
    if condition:
        print(f"[PASS] {label}")
        results.append((True, label))
    else:
        print(f"[FAIL] {label} {detail}")
        results.append((False, label))


def get(url):
    r = requests.get(f"{API_BASE}{url}")
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text


def post(url, body):
    r = requests.post(f"{API_BASE}{url}", json=body)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text


def patch(url, body=None):
    r = requests.patch(f"{API_BASE}{url}", json=body)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text


# ============================================================
# STEP 2 — DELIVERY END-TO-END TEST
# ============================================================
print("\n" + "=" * 65)
print("STEP 2 — DELIVERY END-TO-END TEST")
print("=" * 65)

# Setup Product: Initial stock = 100
sku_d = f"E2E-DEL-{uuid.uuid4().hex[:6].upper()}"
sc, prod = post("/products", {
    "name": "E2E Delivery Widget",
    "sku": sku_d,
    "category": "E2E",
    "unit_of_measure": "pcs",
    "initial_stock": 100.0,
    "low_stock_threshold": 10.0,
})
check("Create product with Initial Stock = 100", sc == 201 and prod.get("current_stock") == 100.0)
P_ID = prod["id"]

# 1. Create delivery order for 25 units
sc, deliv = post("/deliveries", {
    "customer_name": "Global Retail Partners",
    "notes": "E2E Phase 4 delivery test",
    "lines": [{"product_id": P_ID, "quantity": 25.0}]
})
check("Create delivery order for qty 25 (status DRAFT)", sc == 201 and deliv.get("status") == "DRAFT")
D_ID = deliv["id"]

# Verify stock BEFORE validation = 100
sc, p_cur = get(f"/products/{P_ID}")
check("Stock before validation = 100", p_cur.get("current_stock") == 100.0)

# Invalid status transition: cannot validate from DRAFT
sc, err_v1 = post(f"/deliveries/{D_ID}/validate", {})
check("Invalid status transition: cannot validate from DRAFT (400)", sc == 400)

# 2. Pick
sc, del_pick = patch(f"/deliveries/{D_ID}/status", {"status": "PICKED"})
check("Advance status: Pick -> PICKED", sc == 200 and del_pick.get("status") == "PICKED")

# Invalid status transition: cannot validate from PICKED
sc, err_v2 = post(f"/deliveries/{D_ID}/validate", {})
check("Invalid status transition: cannot validate from PICKED (400)", sc == 400)

# 3. Pack
sc, del_pack = patch(f"/deliveries/{D_ID}/status", {"status": "PACKED"})
check("Advance status: Pack -> PACKED", sc == 200 and del_pack.get("status") == "PACKED")

# 4. Validate
sc, del_val = post(f"/deliveries/{D_ID}/validate", {})
check("Validate delivery (status VALIDATED)", sc == 200 and del_val.get("status") == "VALIDATED")

# Verify stock AFTER validation = 100 - 25 = 75
sc, p_after = get(f"/products/{P_ID}")
check("Stock after validation = 75 (100 - 25)", p_after.get("current_stock") == 75.0)

# 5. Refresh: stock remains correct at 75
sc, p_ref = get(f"/products/{P_ID}")
sc_d, d_ref = get(f"/deliveries/{D_ID}")
check("Refresh: stock remains correct at 75", p_ref.get("current_stock") == 75.0)
check("Refresh: delivery status VALIDATED persists", d_ref.get("status") == "VALIDATED")

# 6. Second validation: NO additional stock decrease
sc, err_dup = post(f"/deliveries/{D_ID}/validate", {})
check("Second validation rejected with 400", sc == 400)
sc, p_dup = get(f"/products/{P_ID}")
check("Second validation: NO additional stock decrease (still 75)", p_dup.get("current_stock") == 75.0)

# 7. Edge Cases
# Insufficient stock: Requesting 1000 when only 75 available
sc, del_excess = post("/deliveries", {
    "customer_name": "Over-requester",
    "lines": [{"product_id": P_ID, "quantity": 1000.0}]
})
EX_ID = del_excess["id"]
patch(f"/deliveries/{EX_ID}/status")  # -> PICKED
patch(f"/deliveries/{EX_ID}/status")  # -> PACKED
sc, err_excess = post(f"/deliveries/{EX_ID}/validate", {})
check("Test: Insufficient stock rejected on validate (400)", sc == 400)
sc, p_ex = get(f"/products/{P_ID}")
check("Stock remains 75 after failed excess validation", p_ex.get("current_stock") == 75.0)

# Zero quantity
sc, err_zero = post("/deliveries", {"lines": [{"product_id": P_ID, "quantity": 0.0}]})
check("Test: Zero quantity rejected (400/422)", sc in [400, 422])

# Negative quantity
sc, err_neg = post("/deliveries", {"lines": [{"product_id": P_ID, "quantity": -5.0}]})
check("Test: Negative quantity rejected (400/422)", sc in [400, 422])

# Invalid product
sc, err_inv_p = post("/deliveries", {"lines": [{"product_id": 999999, "quantity": 10.0}]})
check("Test: Invalid product ID rejected (404)", sc == 404)

# Invalid status transition (skip from DRAFT directly to PACKED)
sc, d_temp = post("/deliveries", {"lines": [{"product_id": P_ID, "quantity": 1.0}]})
sc, err_skip = patch(f"/deliveries/{d_temp['id']}/status", {"status": "PACKED"})
check("Test: Invalid status transition (DRAFT -> PACKED directly) rejected (400)", sc == 400)


# ============================================================
# STEP 3 — TRANSFER END-TO-END TEST
# ============================================================
print("\n" + "=" * 65)
print("STEP 3 — TRANSFER END-TO-END TEST")
print("=" * 65)

# Setup Warehouses A and B
sc, whs = get("/transfers/warehouses")
WH_A = whs[0]["id"]
WH_B = whs[1]["id"]

# Product with Total Stock = 120
sku_t = f"E2E-TRF-{uuid.uuid4().hex[:6].upper()}"
sc, tprod = post("/products", {
    "name": "E2E Transfer Product",
    "sku": sku_t,
    "category": "E2E",
    "unit_of_measure": "pcs",
    "initial_stock": 120.0,
})
check("Create transfer product (total stock = 120)", sc == 201 and tprod.get("current_stock") == 120.0)
TP_ID = tprod["id"]

# Seed: Location A = 100, Location B = 20
from backend.app.database import SessionLocal
from backend.app.models.transfer import StockLevel
from sqlalchemy import and_

db = SessionLocal()
def set_stock(pid, wid, q):
    rec = db.query(StockLevel).filter(and_(StockLevel.product_id == pid, StockLevel.warehouse_id == wid)).first()
    if rec:
        rec.quantity = q
    else:
        rec = StockLevel(product_id=pid, warehouse_id=wid, quantity=q)
        db.add(rec)
    db.commit()

set_stock(TP_ID, WH_A, 100.0)
set_stock(TP_ID, WH_B, 20.0)

# Check Initial state
s_a0 = db.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_A)).first().quantity
s_b0 = db.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_B)).first().quantity
db.close()
check("Initial Location A = 100", s_a0 == 100.0)
check("Initial Location B = 20", s_b0 == 20.0)
check("Initial Total Stock = 120", (s_a0 + s_b0) == 120.0)

# 1. Create Transfer = 30 from A -> B
sc, trf = post("/transfers", {
    "source_warehouse_id": WH_A,
    "destination_warehouse_id": WH_B,
    "product_id": TP_ID,
    "quantity": 30.0,
    "notes": "E2E 30 units transfer"
})
check("Create transfer: 30 from A -> B (status DRAFT)", sc == 201 and trf.get("status") == "DRAFT")
TRF_ID = trf["id"]

# 2. Validate Transfer
sc, trf_v = post(f"/transfers/{TRF_ID}/validate", {})
check("Validate transfer returns 200 (status VALIDATED)", sc == 200 and trf_v.get("status") == "VALIDATED")

# 3. Check Location stocks: A = 70, B = 50, Total = 120
db2 = SessionLocal()
s_a1 = db2.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_A)).first().quantity
s_b1 = db2.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_B)).first().quantity
db2.close()
check("After validation: Location A = 70", s_a1 == 70.0)
check("After validation: Location B = 50", s_b1 == 50.0)
check("After validation: Location Sum Total = 120", (s_a1 + s_b1) == 120.0)

# Check Product.current_stock (Company total) remains 120
sc, tp_cur = get(f"/products/{TP_ID}")
check("Total company stock (Product.current_stock) remains UNCHANGED at 120", tp_cur.get("current_stock") == 120.0)

# 4. Verify persistence after refresh
sc, trf_ref = get(f"/transfers/{TRF_ID}")
check("Persistence after refresh: transfer status is VALIDATED", trf_ref.get("status") == "VALIDATED")
db3 = SessionLocal()
s_a_ref = db3.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_A)).first().quantity
s_b_ref = db3.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_B)).first().quantity
db3.close()
check("Persistence after refresh: Location A remains 70", s_a_ref == 70.0)
check("Persistence after refresh: Location B remains 50", s_b_ref == 50.0)

# 5. Try second validation
sc, err_tdup = post(f"/transfers/{TRF_ID}/validate", {})
check("Second transfer validation rejected with 400", sc == 400)
db4 = SessionLocal()
s_a_dup = db4.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_A)).first().quantity
s_b_dup = db4.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_B)).first().quantity
db4.close()
check("Total must remain 120 after duplicate validation attempt", (s_a_dup + s_b_dup) == 120.0)
check("Location A remains 70 (no second movement)", s_a_dup == 70.0)
check("Location B remains 50 (no second movement)", s_b_dup == 50.0)

# 6. Edge cases
# Insufficient source stock (A has 70, requesting 50000)
sc, trf_bad = post("/transfers", {
    "source_warehouse_id": WH_A,
    "destination_warehouse_id": WH_B,
    "product_id": TP_ID,
    "quantity": 50000.0
})
sc, err_insuf = post(f"/transfers/{trf_bad['id']}/validate", {})
check("Test: Insufficient source stock fails on validate (400)", sc == 400)

# Same source/destination
sc, err_same = post("/transfers", {
    "source_warehouse_id": WH_A,
    "destination_warehouse_id": WH_A,
    "product_id": TP_ID,
    "quantity": 5.0
})
check("Test: Same source and destination rejected (400/422)", sc in [400, 422])

# Zero quantity
sc, err_tz = post("/transfers", {
    "source_warehouse_id": WH_A,
    "destination_warehouse_id": WH_B,
    "product_id": TP_ID,
    "quantity": 0.0
})
check("Test: Zero transfer quantity rejected (400/422)", sc in [400, 422])

# Negative quantity
sc, err_tn = post("/transfers", {
    "source_warehouse_id": WH_A,
    "destination_warehouse_id": WH_B,
    "product_id": TP_ID,
    "quantity": -20.0
})
check("Test: Negative transfer quantity rejected (400/422)", sc in [400, 422])


# ============================================================
# STEP 4 — TRANSACTION CHECK
# ============================================================
print("\n" + "=" * 65)
print("STEP 4 — TRANSACTION CHECK")
print("=" * 65)

# 1. Multi-line delivery transaction: Line 1 valid, Line 2 fails -> NO partial update
sc, p_t1 = post("/products", {"name": "Tx Product 1", "sku": f"TX1-{uuid.uuid4().hex[:6]}", "category": "Tx", "unit_of_measure": "pcs", "initial_stock": 30.0})
sc, p_t2 = post("/products", {"name": "Tx Product 2", "sku": f"TX2-{uuid.uuid4().hex[:6]}", "category": "Tx", "unit_of_measure": "pcs", "initial_stock": 5.0})
P_T1_ID = p_t1["id"]
P_T2_ID = p_t2["id"]

sc, del_tx = post("/deliveries", {
    "customer_name": "Tx Customer",
    "lines": [
        {"product_id": P_T1_ID, "quantity": 10.0},
        {"product_id": P_T2_ID, "quantity": 50.0},  # Fails!
    ]
})
patch(f"/deliveries/{del_tx['id']}/status")  # PICKED
patch(f"/deliveries/{del_tx['id']}/status")  # PACKED
sc, err_tx_val = post(f"/deliveries/{del_tx['id']}/validate", {})
check("Multi-line delivery validation fails when any line lacks stock (400)", sc == 400)

sc, p_t1_check = get(f"/products/{P_T1_ID}")
sc, p_t2_check = get(f"/products/{P_T2_ID}")
check("Transaction integrity: Product 1 stock was NOT partially decreased (still 30)", p_t1_check.get("current_stock") == 30.0)
check("Transaction integrity: Product 2 stock was NOT modified (still 5)", p_t2_check.get("current_stock") == 5.0)

# 2. Transfer consistency: source decrease + destination increase must be consistent
db_tx = SessionLocal()
s_a_before = db_tx.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_A)).first().quantity
s_b_before = db_tx.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_B)).first().quantity
db_tx.close()

# Execute a valid transfer: 10 units A -> B
sc, trf_tx = post("/transfers", {"source_warehouse_id": WH_A, "destination_warehouse_id": WH_B, "product_id": TP_ID, "quantity": 10.0})
sc, trf_tx_val = post(f"/transfers/{trf_tx['id']}/validate", {})
check("Transfer validation succeeds (200)", sc == 200)

db_tx2 = SessionLocal()
s_a_after = db_tx2.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_A)).first().quantity
s_b_after = db_tx2.query(StockLevel).filter(and_(StockLevel.product_id == TP_ID, StockLevel.warehouse_id == WH_B)).first().quantity
db_tx2.close()

check("Transfer transaction: source decreased by exactly 10", s_a_after == (s_a_before - 10.0))
check("Transfer transaction: destination increased by exactly 10", s_b_after == (s_b_before + 10.0))
check("Transfer transaction: sum of locations is exactly preserved", (s_a_after + s_b_after) == (s_a_before + s_b_before))


# ============================================================
# STEP 5 — REGRESSION CHECK
# ============================================================
print("\n" + "=" * 65)
print("STEP 5 — REGRESSION CHECK")
print("=" * 65)

# Verify Health & System Info
sc, h = get("/health")
check("Health endpoint online (200)", sc == 200 and h.get("status") == "ok")

# Verify Products API & UI
sc, plist = get("/products")
check("Products API is operational (200)", sc == 200 and isinstance(plist, list))
r_pui = requests.get(f"{UI_BASE}/products")
check("Products UI page loads (200)", r_pui.status_code == 200 and "Product Inventory" in r_pui.text)

# Verify Receipts API & UI
sc, rlist = get("/receipts")
check("Receipts API is operational (200)", sc == 200 and isinstance(rlist, list))
r_rui = requests.get(f"{UI_BASE}/receipts")
check("Receipts UI page loads (200)", r_rui.status_code == 200 and "Goods Receipts" in r_rui.text)

# Verify Deliveries UI
r_dui = requests.get(f"{UI_BASE}/deliveries")
check("Deliveries UI page loads (200)", r_dui.status_code == 200 and "Delivery Orders" in r_dui.text)

# Verify Transfers UI
r_tui = requests.get(f"{UI_BASE}/transfers")
check("Transfers UI page loads (200)", r_tui.status_code == 200 and "Internal Transfers" in r_tui.text)

# Verify Home Dashboard UI
r_home = requests.get(f"{UI_BASE}/")
check("Dashboard / Home page loads (200)", r_home.status_code == 200 and "StockSense" in r_home.text)


# ============================================================
# SUMMARY
# ============================================================
print("\n" + "=" * 65)
print("PHASE 4 E2E VERIFICATION SUMMARY")
print("=" * 65)
passed = sum(1 for r in results if r[0])
total = len(results)
print(f"Results: {passed}/{total} Passed")
for ok, label in results:
    print(f"  [{'OK' if ok else 'FAIL'}] {label}")

if passed == total:
    print("\n[SUCCESS] Phase 4 Final Verification Completed with 100% PASS.")
    sys.exit(0)
else:
    print(f"\n[FAILURE] {total - passed} tests failed.")
    sys.exit(1)
