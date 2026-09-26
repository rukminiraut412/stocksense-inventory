/**
 * Comprehensive Automated Test Suite for StockSense Team Member 4 Modules
 * Phase 2 Requirements:
 * - Inventory Adjustments (with duplicate application & refresh persistence)
 * - Stock Ledger / Move History (multi-type, all 8 fields, and filters)
 * - Deterministic Low-Stock Logic (with re-verification)
 * - SPA Route Verification (/adjustments, /adjustments/new, /adjustments/[id], /move-history)
 * - Regression & Health Verification
 */

const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { db } = require('../src/config/database');
const AdjustmentService = require('../src/modules/adjustments/adjustment.service');
const LedgerService = require('../src/modules/ledger/ledger.service');
const LowStockService = require('../src/modules/lowstock/lowstock.service');

let server;
const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  StockSense - Team Member 4 Phase 2 Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      failed++;
    }
  }

  // Start temporary test server
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });

  try {
    // ----------------------------------------------------
    // SUITE 1: LOW STOCK LOGIC TESTS
    // ----------------------------------------------------
    console.log('--- SUITE 1: Deterministic Low Stock Logic (Run 1) ---');

    test('Test 1.1: Threshold = 10, Stock = 15 -> IN STOCK', () => {
      const result = LowStockService.evaluateStockStatus(15, 10);
      assert.strictEqual(result.status, 'IN_STOCK');
      assert.strictEqual(result.label, 'IN STOCK');
    });

    test('Test 1.2: Threshold = 10, Stock = 8 -> LOW STOCK', () => {
      const result = LowStockService.evaluateStockStatus(8, 10);
      assert.strictEqual(result.status, 'LOW_STOCK');
      assert.strictEqual(result.label, 'LOW STOCK');
    });

    test('Test 1.3: Threshold = 10, Stock = 0 -> OUT OF STOCK', () => {
      const result = LowStockService.evaluateStockStatus(0, 10);
      assert.strictEqual(result.status, 'OUT_OF_STOCK');
      assert.strictEqual(result.label, 'OUT OF STOCK');
    });

    test('Test 1.4: Threshold = 10, Stock = 10 (exact boundary) -> LOW STOCK', () => {
      const result = LowStockService.evaluateStockStatus(10, 10);
      assert.strictEqual(result.status, 'LOW_STOCK');
      assert.strictEqual(result.label, 'LOW STOCK');
    });

    // ----------------------------------------------------
    // SUITE 2: INVENTORY ADJUSTMENT 12-STEP MANDATORY CYCLE
    // ----------------------------------------------------
    console.log('\n--- SUITE 2: Mandatory 12-Step Adjustment Workflow ---');

    // 1. Product stock = 100
    db.prepare(`
      INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_at)
      VALUES (1, 1, 100, datetime('now'))
      ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = 100
    `).run();
    db.prepare(`UPDATE products SET current_stock = 100 WHERE id = 1`).run();

    let adjRecord;

    test('Step 1: Verify product stock is 100', () => {
      const stock = AdjustmentService.getRecordedStock(1, 1);
      assert.strictEqual(stock.recordedQuantity, 100, 'Recorded quantity must initially be 100');
    });

    test('Step 2 & 3: Physical count = 94. Apply adjustment.', () => {
      adjRecord = AdjustmentService.applyAdjustment({
        productId: 1,
        warehouseId: 1,
        physicalQuantity: 94,
        reason: 'Phase 2 Audit Verification',
        user: 'QA Lead'
      });

      assert.strictEqual(adjRecord.recordedQuantity, 100);
      assert.strictEqual(adjRecord.physicalQuantity, 94);
      assert.strictEqual(adjRecord.difference, -6, 'Formula difference = 94 - 100 = -6');
      assert.strictEqual(adjRecord.newStock, 94, 'Formula new_stock = 94');
      assert.strictEqual(adjRecord.status, 'APPLIED');
    });

    test('Step 4: Verify stock becomes 94 in database', () => {
      const row = db.prepare('SELECT quantity FROM stock_levels WHERE product_id = 1 AND warehouse_id = 1').get();
      assert.strictEqual(row.quantity, 94, 'Database stock_levels must equal 94');
    });

    test('Step 5 & 6: Refresh database read. Verify stock remains 94.', () => {
      const refreshedStock = AdjustmentService.getRecordedStock(1, 1);
      assert.strictEqual(refreshedStock.recordedQuantity, 94, 'Refreshed stock must remain 94');
    });

    test('Step 7: Verify adjustment record exists and is traceable', () => {
      const adj = AdjustmentService.getAdjustmentById(adjRecord.id);
      assert.strictEqual(adj.id, adjRecord.id);
      assert.strictEqual(adj.physicalQuantity, 94);
      assert.strictEqual(adj.recordedQuantity, 100);
      assert.strictEqual(adj.difference, -6);
      assert.strictEqual(adj.status, 'APPLIED');
      assert.strictEqual(adj.referenceId, `ADJ-${adjRecord.id.toString().padStart(4, '0')}`);
    });

    test('Step 8: Verify corresponding ledger entry exists with all fields', () => {
      const ledger = db.prepare('SELECT * FROM stock_ledger WHERE reference_id = ?').get(adjRecord.referenceId);
      assert.ok(ledger, 'Stock ledger entry must exist for reference');
      assert.strictEqual(ledger.movement_type, 'ADJUSTMENT');
      assert.strictEqual(ledger.product_id, 1);
      assert.ok(ledger.product_name);
      assert.ok(ledger.sku);
      assert.strictEqual(ledger.warehouse_id, 1);
      assert.ok(ledger.warehouse_name);
      assert.strictEqual(ledger.quantity, -6);
      assert.strictEqual(ledger.previous_stock, 100);
      assert.strictEqual(ledger.new_stock, 94);
      assert.ok(ledger.timestamp);
      assert.ok(ledger.user);
    });

    test('Step 9: Test negative physical quantity rejection (-5)', () => {
      assert.throws(() => {
        AdjustmentService.applyAdjustment({
          productId: 1,
          warehouseId: 1,
          physicalQuantity: -5,
          reason: 'Negative test'
        });
      }, /non-negative integer/i);
    });

    test('Step 10: Test duplicate application rejection', () => {
      // Direct call on existing applied adjustment
      assert.throws(() => {
        AdjustmentService.applyAdjustmentById(adjRecord.id);
      }, /already been applied/i);

      // Duplicate with same client reference / idempotency key
      const idempotencyKey = `ADJ-DUP-KEY-${Date.now()}`;
      AdjustmentService.applyAdjustment({
        productId: 1,
        warehouseId: 1,
        physicalQuantity: 94,
        clientReference: idempotencyKey
      });

      assert.throws(() => {
        AdjustmentService.applyAdjustment({
          productId: 1,
          warehouseId: 1,
          physicalQuantity: 94,
          clientReference: idempotencyKey
        });
      }, /already been applied/i);
    });

    test('Step 11 & 12: Re-run adjustment cycle to confirm zero errors', () => {
      const secondRun = AdjustmentService.applyAdjustment({
        productId: 1,
        warehouseId: 1,
        physicalQuantity: 92,
        reason: 'Recount cycle 2'
      });
      assert.strictEqual(secondRun.difference, -2);
      assert.strictEqual(secondRun.newStock, 92);
      const verifyRow = db.prepare('SELECT quantity FROM stock_levels WHERE product_id = 1 AND warehouse_id = 1').get();
      assert.strictEqual(verifyRow.quantity, 92);
    });

    // ----------------------------------------------------
    // SUITE 3: STOCK LEDGER VERIFICATION & RE-RUN
    // ----------------------------------------------------
    console.log('\n--- SUITE 3: Stock Ledger Multi-Type Support & Re-run ---');

    const testRef = `TRA-TEST-${Date.now()}`;

    test('Test 3.1: Verify stock movement contains all required fields', () => {
      const move = LedgerService.recordMovement({
        productId: 2,
        warehouseId: 1,
        movementType: 'TRANSFER',
        quantity: -4,
        previousStock: 12,
        newStock: 8,
        referenceId: testRef,
        user: 'Logistics Lead'
      });

      assert.strictEqual(move.movementType, 'TRANSFER');
      assert.strictEqual(move.productId, 2);
      assert.ok(move.productName);
      assert.ok(move.sku);
      assert.strictEqual(move.warehouseId, 1);
      assert.ok(move.warehouseName);
      assert.strictEqual(move.quantity, -4);
      assert.strictEqual(move.previousStock, 12);
      assert.strictEqual(move.newStock, 8);
      assert.strictEqual(move.referenceId, testRef);
      assert.strictEqual(move.user, 'Logistics Lead');
    });

    test('Test 3.2: Test filtering by movement type (TRANSFER)', () => {
      const res = LedgerService.getLedgerEntries({ movementType: 'TRANSFER' });
      assert.ok(res.data.length > 0);
      res.data.forEach(item => assert.strictEqual(item.movementType, 'TRANSFER'));
    });

    test('Test 3.3: Test filtering by product (productId = 2)', () => {
      const res = LedgerService.getLedgerEntries({ productId: 2 });
      assert.ok(res.data.length > 0);
      res.data.forEach(item => assert.strictEqual(item.productId, 2));
    });

    test('Test 3.4: Test filtering by warehouse (warehouseId = 1)', () => {
      const res = LedgerService.getLedgerEntries({ warehouseId: 1 });
      assert.ok(res.data.length > 0);
      res.data.forEach(item => assert.strictEqual(item.warehouseId, 1));
    });

    test('Test 3.5: Test filtering by search reference', () => {
      const res = LedgerService.getLedgerEntries({ search: testRef });
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].referenceId, testRef);
    });

    // Re-run ledger test as explicitly specified in prompt
    test('Test 3.6: Re-run Ledger Filter test (Idempotent verification)', () => {
      const res = LedgerService.getLedgerEntries({ movementType: 'ADJUSTMENT' });
      assert.ok(res.data.length > 0);
      res.data.forEach(item => assert.strictEqual(item.movementType, 'ADJUSTMENT'));
    });

    // ----------------------------------------------------
    // SUITE 4: LOW STOCK RE-RUN (EXPLICIT PROMPT REQUIREMENT)
    // ----------------------------------------------------
    console.log('\n--- SUITE 4: Low Stock Logic (Run 2 - Mandatory Re-test) ---');

    test('Test 4.1: (Re-run) Threshold = 10, Stock = 15 -> IN STOCK', () => {
      const r = LowStockService.evaluateStockStatus(15, 10);
      assert.strictEqual(r.status, 'IN_STOCK');
    });

    test('Test 4.2: (Re-run) Threshold = 10, Stock = 8 -> LOW STOCK', () => {
      const r = LowStockService.evaluateStockStatus(8, 10);
      assert.strictEqual(r.status, 'LOW_STOCK');
    });

    test('Test 4.3: (Re-run) Threshold = 10, Stock = 0 -> OUT OF STOCK', () => {
      const r = LowStockService.evaluateStockStatus(0, 10);
      assert.strictEqual(r.status, 'OUT_OF_STOCK');
    });

    // ----------------------------------------------------
    // SUITE 5: FRONTEND SPA ROUTES & API INTEGRATION
    // ----------------------------------------------------
    console.log('\n--- SUITE 5: Frontend SPA Route Serving & Duplicate Prevention ---');

    await asyncTest('Test 5.1: GET /adjustments returns 200 and serves HTML', async () => {
      const res = await makeRequest('/adjustments');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /StockSense/i);
    });

    await asyncTest('Test 5.2: GET /adjustments/new returns 200 and serves HTML', async () => {
      const res = await makeRequest('/adjustments/new');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /Physical Stock Reconciliation/i);
    });

    await asyncTest('Test 5.3: GET /adjustments/1 returns 200 and serves HTML', async () => {
      const res = await makeRequest('/adjustments/1');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /Adjustment Details/i);
    });

    await asyncTest('Test 5.4: GET /move-history returns 200 and serves HTML', async () => {
      const res = await makeRequest('/move-history');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /Stock Ledger/i);
    });

    await asyncTest('Test 5.5: POST /api/adjustments/:id/apply rejects duplicate with HTTP 400', async () => {
      const res = await makeRequest(`/api/adjustments/${adjRecord.id}/apply`, { method: 'POST' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /already been applied/i);
    });

    await asyncTest('Test 5.6: GET /api/stock-status returns dashboard summary counters', async () => {
      const res = await makeRequest('/api/stock-status');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.summary);
      assert.strictEqual(typeof res.body.summary.inStockCount, 'number');
      assert.strictEqual(typeof res.body.summary.lowStockCount, 'number');
      assert.strictEqual(typeof res.body.summary.outOfStockCount, 'number');
    });

    // ----------------------------------------------------
    // SUITE 6: REGRESSION CHECK
    // ----------------------------------------------------
    console.log('\n--- SUITE 6: Regression Verification ---');

    test('Test 6.1: Products table schema integrity & current_stock sync', () => {
      const product = db.prepare('SELECT id, sku, name, current_stock, reorder_threshold FROM products WHERE id = 1').get();
      assert.ok(product);
      assert.strictEqual(typeof product.current_stock, 'number');
    });

    test('Test 6.2: Warehouses table schema integrity', () => {
      const wh = db.prepare('SELECT id, code, name FROM warehouses WHERE id = 1').get();
      assert.ok(wh);
      assert.strictEqual(wh.code, 'WH-MAIN');
    });

    await asyncTest('Test 6.3: Health check endpoint remains 200 OK', async () => {
      const res = await makeRequest('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'online');
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
