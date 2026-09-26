# -*- coding: utf-8 -*-
# StockSense Phase 2 - Team Member 3 Integration Tests
# Run: python test_phase2.py  (with FastAPI server on localhost:8000)

import requests
import sys
import uuid

BASE = "http://localhost:8000/api"
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
    return r.status_code, r.json()


def post_params(path, params):
    r = requests.post(f"{BASE}{path}", params=params)
    return r.status_code, r.json()


def get(path):
    r = requests.get(f"{BASE}{path}")
    return r.status_code, r.json()


def patch(path, body=None):
    r = requests.patch(f"{BASE}{path}", json=body or {})
    return r.status_code, r.json()


# ============================================================
# REGRESSION CHECK: existing endpoints still work
# ============================================================
print("\n" + "=" * 60)
print("REGRESSION CHECK")
print("=" * 60)

sc, health = get("/health")
check("Health endpoint returns 200", sc == 200 and health.get("status") == "ok",
      f"got {sc} {health}")

sc, products_list = get("/products")
check("GET /api/products still works", sc == 200 and isinstance(products_list, list),
      f"got {sc}")


# ============================================================
# SETUP: Create test product with stock = 100
# ============================================================
print("\n" + "=" * 60)
print("SETUP - Creating test product with stock 100")
print("=" * 60)

sku = f"PH2-DEL-{uuid.uuid4().hex[:6].upper()}"
sc, product = post("/products", {
    "name": "Phase2 Test Widget",
    "sku": sku,
    "category": "Test",
    "unit_of_measure": "pcs",
    "initial_stock": 100.0,
    "low_stock_threshold": 10.0,
})
check("Product created with stock=100", sc == 201 and product.get("current_stock") == 100.0,
      f"got {sc} {product}")
PID = product["id"]
print(f"[INFO] Product ID={PID}, SKU={sku}, stock={product.get('current_stock')}")


# ============================================================
# DELIVERY TESTS
# ============================================================
print("\n" + "=" * 60)
print("DELIVERY TESTS")
print("=" * 60)

# D1: Create delivery for qty 20
print("\n--- D1: Create delivery for qty 20 ---")
sc, delivery = post("/deliveries", {
    "customer_name": "Test Customer",
    "lines": [{"product_id": PID, "quantity": 20}]
})
check("D1: Delivery created (DRAFT)", sc == 201 and delivery.get("status") == "DRAFT",
      f"got {sc} {delivery}")
DEL_ID = delivery["id"]

# D2: Stock still 100 before validation
print("\n--- D2: Stock remains 100 before validation ---")
_, prod = get(f"/products/{PID}")
check("D2: Stock is still 100", prod["current_stock"] == 100.0,
      f"got {prod.get('current_stock')}")

# D3: Pick
print("\n--- D3: Advance to PICKED ---")
sc, d = patch(f"/deliveries/{DEL_ID}/status")
check("D3: Status = PICKED", sc == 200 and d.get("status") == "PICKED", f"got {sc} {d}")

# D4: Pack
print("\n--- D4: Advance to PACKED ---")
sc, d = patch(f"/deliveries/{DEL_ID}/status")
check("D4: Status = PACKED", sc == 200 and d.get("status") == "PACKED", f"got {sc} {d}")

# D5: Validate
print("\n--- D5: Validate delivery ---")
sc, res = post(f"/deliveries/{DEL_ID}/validate", {})
check("D5: Validate returns 200", sc == 200, f"got {sc} {res}")
check("D5: Status = VALIDATED", res.get("status") == "VALIDATED")

# D6: Stock now 80
print("\n--- D6: Verify stock = 80 ---")
_, prod = get(f"/products/{PID}")
check("D6: Stock is now 80", prod["current_stock"] == 80.0, f"got {prod.get('current_stock')}")

# D7: Refresh - stock still 80
print("\n--- D7: Refresh - stock persists at 80 ---")
_, prod = get(f"/products/{PID}")
check("D7: Stock still 80 after refresh", prod["current_stock"] == 80.0,
      f"got {prod.get('current_stock')}")

# D8: Validate same delivery again - must fail
print("\n--- D8: Second validation must fail ---")
sc, res = post(f"/deliveries/{DEL_ID}/validate", {})
check("D8: Second validation rejected (400)", sc == 400, f"got {sc} {res}")
print(f"[INFO] Error: {res.get('detail')}")

# D9: Stock remains 80 after duplicate attempt
print("\n--- D9: Stock unchanged after duplicate validation ---")
_, prod = get(f"/products/{PID}")
check("D9: Stock remains 80", prod["current_stock"] == 80.0, f"got {prod.get('current_stock')}")

# D10: Quantity > available stock
print("\n--- D10: Delivery qty > available stock ---")
sc, big_del = post("/deliveries", {
    "customer_name": "Overflow",
    "lines": [{"product_id": PID, "quantity": 9999}]
})
BIG_DEL_ID = big_del.get("id")
check("D10: Oversized delivery created as DRAFT", sc == 201)
patch(f"/deliveries/{BIG_DEL_ID}/status")
patch(f"/deliveries/{BIG_DEL_ID}/status")
sc, res = post(f"/deliveries/{BIG_DEL_ID}/validate", {})
check("D10: Oversized validation fails (400)", sc == 400, f"got {sc}")
print(f"[INFO] Error: {res.get('detail')}")

_, prod = get(f"/products/{PID}")
check("D11: Stock still 80 after failed big delivery", prod["current_stock"] == 80.0,
      f"got {prod.get('current_stock')}")

# D12: Quantity = 0 or negative
print("\n--- D12: Quantity 0 / negative ---")
sc, res = post("/deliveries", {"lines": [{"product_id": PID, "quantity": 0}]})
check("D12a: qty=0 rejected", sc in [400, 422], f"got {sc} {res}")
sc, res = post("/deliveries", {"lines": [{"product_id": PID, "quantity": -5}]})
check("D12b: qty=-5 rejected", sc in [400, 422], f"got {sc} {res}")


# ============================================================
# TRANSFER TESTS
# ============================================================
print("\n" + "=" * 60)
print("TRANSFER TESTS")
print("=" * 60)

# Get or create warehouses
sc, warehouses = get("/transfers/warehouses")
check("Warehouses endpoint works", sc == 200, f"got {sc}")

if len(warehouses) < 2:
    print("[INFO] Seeding 2 warehouses for transfer tests...")
    sc1, wh_a = post_params("/transfers/warehouses",
                             {"name": "Warehouse A", "code": f"WH-A-{uuid.uuid4().hex[:4]}", "location": "Zone A"})
    sc2, wh_b = post_params("/transfers/warehouses",
                             {"name": "Warehouse B", "code": f"WH-B-{uuid.uuid4().hex[:4]}", "location": "Zone B"})
    check("Warehouse A created", sc1 == 201, f"got {sc1} {wh_a}")
    check("Warehouse B created", sc2 == 201, f"got {sc2} {wh_b}")
    WH_A_ID = wh_a["id"]
    WH_B_ID = wh_b["id"]
    WH_A_NAME = wh_a["name"]
    WH_B_NAME = wh_b["name"]
else:
    WH_A_ID = warehouses[0]["id"]
    WH_A_NAME = warehouses[0]["name"]
    WH_B_ID = warehouses[1]["id"]
    WH_B_NAME = warehouses[1]["name"]
    print(f"[INFO] Using existing: A={WH_A_NAME} (id={WH_A_ID}), B={WH_B_NAME} (id={WH_B_ID})")

# Create transfer product with stock 120 (A=100, B=20 as set by stock_levels)
sku2 = f"PH2-TRF-{uuid.uuid4().hex[:6].upper()}"
sc, tprod = post("/products", {
    "name": "Transfer Test Widget",
    "sku": sku2,
    "category": "Test",
    "unit_of_measure": "pcs",
    "initial_stock": 120.0,
    "low_stock_threshold": 5.0,
})
check("Transfer product created (stock=120)", sc == 201 and tprod.get("current_stock") == 120.0,
      f"got {sc}")
TPID = tprod["id"]
print(f"[INFO] Transfer product ID={TPID}, stock={tprod.get('current_stock')}")

# Seed stock_levels for the transfer product
# Source A = 100, Destination B = 20, Total = 120
import sys, os
sys.path.insert(0, os.getcwd())
from backend.app.database import SessionLocal
from backend.app.models.transfer import StockLevel
from sqlalchemy import and_

db = SessionLocal()
def seed_stock(product_id, warehouse_id, qty):
    entry = db.query(StockLevel).filter(
        and_(StockLevel.product_id == product_id, StockLevel.warehouse_id == warehouse_id)
    ).first()
    if entry:
        entry.quantity = qty
    else:
        entry = StockLevel(product_id=product_id, warehouse_id=warehouse_id, quantity=qty)
        db.add(entry)
    db.commit()

seed_stock(TPID, WH_A_ID, 100.0)
seed_stock(TPID, WH_B_ID, 20.0)
db.close()
# Also seed via API endpoint to ensure sync with server process
post_params("/transfers/stock-levels", {"product_id": TPID, "warehouse_id": WH_A_ID, "quantity": 100.0})
post_params("/transfers/stock-levels", {"product_id": TPID, "warehouse_id": WH_B_ID, "quantity": 20.0})

# Verify seeded stock via API warehouse check
sc, whs = get("/transfers/warehouses")
print(f"[INFO] Stock seeded: A={WH_A_NAME}=100, B={WH_B_NAME}=20, Product total=120")

# T1: Create transfer 30 from A -> B
print("\n--- T1: Create transfer A->B qty=30 ---")
sc, transfer = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID,
    "quantity": 30,
    "notes": "Phase 2 test"
})
check("T1: Transfer created (DRAFT)", sc == 201 and transfer.get("status") == "DRAFT",
      f"got {sc} {transfer}")
TID = transfer["id"]

# T2: Validate transfer
print("\n--- T2: Validate transfer ---")
sc, res = post(f"/transfers/{TID}/validate", {})
check("T2: Validation returns 200", sc == 200, f"got {sc} {res}")
check("T2: Status = VALIDATED", res.get("status") == "VALIDATED")

# T3: Verify stock_levels updated - read directly from DB
_, src_api = get(f"/transfers/stock-levels?product_id={TPID}&warehouse_id={WH_A_ID}")
_, dst_api = get(f"/transfers/stock-levels?product_id={TPID}&warehouse_id={WH_B_ID}")
src_qty = src_api.get("quantity") if isinstance(src_api, dict) else None
dst_qty = dst_api.get("quantity") if isinstance(dst_api, dict) else None
check("T3: Source A = 70 after transfer", src_qty == 70.0, f"got {src_qty}")
check("T3: Destination B = 50 after transfer", dst_qty == 50.0, f"got {dst_qty}")

# T4: Total product stock unchanged
print("\n--- T4: Total product stock still 120 ---")
_, tprod2 = get(f"/products/{TPID}")
check("T4: Product.current_stock still 120", tprod2["current_stock"] == 120.0,
      f"got {tprod2.get('current_stock')}")

# T5: Refresh - transfer status persists
print("\n--- T5: Refresh - values persist ---")
_, tcheck = get(f"/transfers/{TID}")
check("T5: Transfer VALIDATED on refresh", tcheck.get("status") == "VALIDATED")

# T6: Second validation must fail
print("\n--- T6: Double-validation guard ---")
sc, res = post(f"/transfers/{TID}/validate", {})
check("T6: Second validation rejected (400)", sc == 400, f"got {sc}")
print(f"[INFO] Error: {res.get('detail')}")

# T7: Stock unchanged after retry
_, src_after_api = get(f"/transfers/stock-levels?product_id={TPID}&warehouse_id={WH_A_ID}")
_, dst_after_api = get(f"/transfers/stock-levels?product_id={TPID}&warehouse_id={WH_B_ID}")
src_a_qty = src_after_api.get("quantity") if isinstance(src_after_api, dict) else None
dst_a_qty = dst_after_api.get("quantity") if isinstance(dst_after_api, dict) else None
check("T7: A still 70 after rejected retry", src_a_qty == 70.0, f"got {src_a_qty}")
check("T7: B still 50 after rejected retry", dst_a_qty == 50.0, f"got {dst_a_qty}")

# T8: Insufficient source stock
print("\n--- T8: Insufficient source stock ---")
sc, big_trf = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID,
    "quantity": 99999,
})
check("T8: Oversized transfer created as DRAFT", sc == 201)
sc, res = post(f"/transfers/{big_trf['id']}/validate", {})
check("T8: Insufficient stock validation fails (400)", sc == 400, f"got {sc}")
print(f"[INFO] Error: {res.get('detail')}")

# T9: Same source = destination
print("\n--- T9: Same source=destination ---")
sc, res = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_A_ID,
    "product_id": TPID,
    "quantity": 10,
})
check("T9: Same-location transfer rejected (400)", sc == 400, f"got {sc} {res}")

# T10: Quantity <= 0
print("\n--- T10: Quantity 0 or negative ---")
sc, res = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID,
    "quantity": 0,
})
check("T10a: qty=0 rejected", sc in [400, 422], f"got {sc}")
sc, res = post("/transfers", {
    "source_warehouse_id": WH_A_ID,
    "destination_warehouse_id": WH_B_ID,
    "product_id": TPID,
    "quantity": -10,
})
check("T10b: qty=-10 rejected", sc in [400, 422], f"got {sc}")


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
    print(f"  [{'OK' if ok else 'XX'}] {label}")

if passed == total:
    print("\nAll tests passed!")
    sys.exit(0)
else:
    print(f"\n{total - passed} test(s) failed.")
    sys.exit(1)
