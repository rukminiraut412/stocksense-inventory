/**
 * Comprehensive Automated Test Suite for StockSense Team Member 4 Modules
 * - Inventory Adjustments
 * - Stock Ledger / Move History
 * - Deterministic Low-Stock Logic
 * - End-to-End API Integration
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
  console.log('  StockSense - Team Member 4 Automated Verification');
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
    console.log('--- SUITE 1: Deterministic Low Stock Logic ---');

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
    // SUITE 2: INVENTORY ADJUSTMENT TESTS
    // ----------------------------------------------------
    console.log('\n--- SUITE 2: Inventory Adjustment Requirements ---');

    // Setup: Ensure Product 1 in Warehouse 1 has stock exactly 100 for test
    db.prepare(`
      INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_at)
      VALUES (1, 1, 100, datetime('now'))
      ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = 100
    `).run();

    let adjRecord;

    test('Test 2.1: Initial stock is 100', () => {
      const stock = AdjustmentService.getRecordedStock(1, 1);
      assert.strictEqual(stock.recordedQuantity, 100, 'Recorded quantity must initially be 100');
    });

    test('Test 2.2: Apply adjustment with physical count = 94 (diff = -6, new_stock = 94)', () => {
      adjRecord = AdjustmentService.applyAdjustment({
        productId: 1,
        warehouseId: 1,
        physicalQuantity: 94,
        reason: 'Physical Audit Test',
        user: 'QA Auditor'
      });

      assert.strictEqual(adjRecord.recordedQuantity, 100);
      assert.strictEqual(adjRecord.physicalQuantity, 94);
      assert.strictEqual(adjRecord.difference, -6, 'Difference formula: 94 - 100 = -6');
      assert.strictEqual(adjRecord.newStock, 94, 'New stock must equal physical quantity 94');
      assert.strictEqual(adjRecord.status, 'APPLIED');
    });

    test('Test 2.3: Verify database stock_levels updated to 94 persistently', () => {
      const row = db.prepare('SELECT quantity FROM stock_levels WHERE product_id = 1 AND warehouse_id = 1').get();
      assert.strictEqual(row.quantity, 94, 'Database stock_levels quantity must be 94');
    });

    test('Test 2.4: Verify persistent adjustment record exists', () => {
      const adj = AdjustmentService.getAdjustmentById(adjRecord.id);
      assert.strictEqual(adj.id, adjRecord.id);
      assert.strictEqual(adj.physicalQuantity, 94);
      assert.strictEqual(adj.recordedQuantity, 100);
      assert.strictEqual(adj.difference, -6);
      assert.strictEqual(adj.status, 'APPLIED');
    });

    test('Test 2.5: Verify corresponding stock ledger entry exists and matches', () => {
      const ledger = db.prepare('SELECT * FROM stock_ledger WHERE reference_id = ?').get(adjRecord.referenceId);
      assert.ok(ledger, 'Stock ledger entry must exist for adjustment reference');
      assert.strictEqual(ledger.movement_type, 'ADJUSTMENT');
      assert.strictEqual(ledger.product_id, 1);
      assert.strictEqual(ledger.warehouse_id, 1);
      assert.strictEqual(ledger.quantity, -6);
      assert.strictEqual(ledger.previous_stock, 100);
      assert.strictEqual(ledger.new_stock, 94);
      assert.ok(ledger.timestamp, 'Ledger entry must have timestamp');
    });

    test('Test 2.6: Reject invalid negative physical quantity (-5)', () => {
      assert.throws(() => {
        AdjustmentService.applyAdjustment({
          productId: 1,
          warehouseId: 1,
          physicalQuantity: -5,
          reason: 'Negative test'
        });
      }, /non-negative integer/i);
    });

    test('Test 2.7: Reject non-integer physical quantity (94.5)', () => {
      assert.throws(() => {
        AdjustmentService.applyAdjustment({
          productId: 1,
          warehouseId: 1,
          physicalQuantity: 94.5,
          reason: 'Float test'
        });
      }, /non-negative integer/i);
    });

    // ----------------------------------------------------
    // SUITE 3: STOCK LEDGER FILTERING & MULTI-TYPE MOVEMENTS
    // ----------------------------------------------------
    console.log('\n--- SUITE 3: Stock Ledger Multi-type & Filter Support ---');

    const uniqueReceiptRef = `REC-TEST-${Date.now()}`;

    test('Test 3.1: Record mock movements of all 4 types (RECEIPT, DELIVERY, TRANSFER, ADJUSTMENT)', () => {
      // RECEIPT: +20
      LedgerService.recordMovement({
        productId: 2,
        warehouseId: 1,
        movementType: 'RECEIPT',
        quantity: 20,
        previousStock: 8,
        newStock: 28,
        referenceId: uniqueReceiptRef,
        user: 'Receiving Team'
      });

      // DELIVERY: -5
      LedgerService.recordMovement({
        productId: 2,
        warehouseId: 1,
        movementType: 'DELIVERY',
        quantity: -5,
        previousStock: 28,
        newStock: 23,
        referenceId: 'DEL-001',
        user: 'Shipping Team'
      });

      // TRANSFER: -10
      LedgerService.recordMovement({
        productId: 2,
        warehouseId: 1,
        movementType: 'TRANSFER',
        quantity: -10,
        previousStock: 23,
        newStock: 13,
        referenceId: 'TRA-001',
        user: 'Logistics'
      });

      const metrics = LedgerService.getSummaryMetrics();
      assert.ok(metrics.RECEIPT >= 1);
      assert.ok(metrics.DELIVERY >= 1);
      assert.ok(metrics.TRANSFER >= 1);
      assert.ok(metrics.ADJUSTMENT >= 1);
    });

    test('Test 3.2: Filter ledger entries by movement_type = ADJUSTMENT', () => {
      const res = LedgerService.getLedgerEntries({ movementType: 'ADJUSTMENT' });
      assert.ok(res.data.length > 0);
      res.data.forEach(item => {
        assert.strictEqual(item.movementType, 'ADJUSTMENT');
      });
    });

    test('Test 3.3: Filter ledger entries by movement_type = RECEIPT', () => {
      const res = LedgerService.getLedgerEntries({ movementType: 'RECEIPT' });
      assert.ok(res.data.length > 0);
      res.data.forEach(item => {
        assert.strictEqual(item.movementType, 'RECEIPT');
      });
    });

    test('Test 3.4: Filter ledger entries by productId', () => {
      const res = LedgerService.getLedgerEntries({ productId: 1 });
      assert.ok(res.data.length > 0);
      res.data.forEach(item => {
        assert.strictEqual(item.productId, 1);
      });
    });

    test('Test 3.5: Filter ledger entries by warehouseId', () => {
      const res = LedgerService.getLedgerEntries({ warehouseId: 1 });
      assert.ok(res.data.length > 0);
      res.data.forEach(item => {
        assert.strictEqual(item.warehouseId, 1);
      });
    });

    test('Test 3.6: Filter ledger entries by search keyword', () => {
      const res = LedgerService.getLedgerEntries({ search: uniqueReceiptRef });
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].referenceId, uniqueReceiptRef);
    });

    // ----------------------------------------------------
    // SUITE 4: REAL HTTP ENDPOINT INTEGRATION TESTS
    // ----------------------------------------------------
    console.log('\n--- SUITE 4: Real HTTP REST API Integration ---');

    await asyncTest('Test 4.1: GET /api/health', async () => {
      const res = await makeRequest('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'online');
    });

    await asyncTest('Test 4.2: GET /api/adjustments/recorded-stock?productId=1&warehouseId=1', async () => {
      const res = await makeRequest('/api/adjustments/recorded-stock?productId=1&warehouseId=1');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.recordedQuantity, 94);
    });

    await asyncTest('Test 4.3: POST /api/adjustments (Apply new adjustment 94 -> 90)', async () => {
      const res = await makeRequest('/api/adjustments', {
        method: 'POST',
        body: {
          productId: 1,
          warehouseId: 1,
          physicalQuantity: 90,
          reason: 'Second cycle verification',
          user: 'HTTP Client'
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.difference, -4);
      assert.strictEqual(res.body.data.newStock, 90);
    });

    await asyncTest('Test 4.4: POST /api/adjustments (Reject invalid negative physical quantity)', async () => {
      const res = await makeRequest('/api/adjustments', {
        method: 'POST',
        body: {
          productId: 1,
          warehouseId: 1,
          physicalQuantity: -10
        }
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /non-negative/i);
    });

    await asyncTest('Test 4.5: GET /api/ledger?movementType=ADJUSTMENT', async () => {
      const res = await makeRequest('/api/ledger?movementType=ADJUSTMENT');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.length >= 2);
    });

    await asyncTest('Test 4.6: GET /api/stock-status', async () => {
      const res = await makeRequest('/api/stock-status');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.summary);
      assert.ok(res.body.summary.totalMonitored > 0);
      assert.ok(res.body.data.length > 0);
    });

    await asyncTest('Test 4.7: GET /api/stock-status/alerts', async () => {
      const res = await makeRequest('/api/stock-status/alerts');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.alerts));
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
