/**
 * Comprehensive Automated Test Suite for StockSense Team Member 4 Modules
 * Phase 3 Integration Hardening:
 * - TASK 1: Complete Adjustment Workflow (100 -> 94, diff = -6), zero, negative, invalid product, invalid location, duplicate application
 * - TASK 2: Stock Ledger Representation (RECEIPT, DELIVERY, TRANSFER, ADJUSTMENT) with all 8 fields
 * - TASK 3: Low-Stock Deterministic Evaluation (15 -> IN STOCK, 10 -> LOW STOCK, 8 -> LOW STOCK, 0 -> OUT OF STOCK)
 * - TASK 4: Search/Filter Verification with combined filters & non-mutation verification
 * - TASK 5: Ledger Consistency & External Module Emission Interface
 * - REGRESSION: Schema integrity, route verification, SPA routes, error handling
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
  console.log('  StockSense - Phase 3 Integration Hardening Tests');
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

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });

  try {
    // ----------------------------------------------------
    // TASK 1: ADJUSTMENT VERIFICATION (COMPLETE WORKFLOW & EDGE CASES)
    // ----------------------------------------------------
    console.log('--- TASK 1: Complete Adjustment Workflow & Edge Cases ---');

    // Reset baseline: Product 1 at Warehouse 1 stock = 100
    db.prepare(`
      INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_at)
      VALUES (1, 1, 100, datetime('now'))
      ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = 100
    `).run();
    db.prepare(`UPDATE products SET current_stock = 100 WHERE id = 1`).run();

    let adjRecord;

    test('1.1: Verify recorded quantity starts at 100', () => {
      const stock = AdjustmentService.getRecordedStock(1, 1);
      assert.strictEqual(stock.recordedQuantity, 100);
      assert.strictEqual(stock.productName, 'High-Precision Microcontroller MCU-32');
      assert.strictEqual(stock.sku, 'SKU-1001');
    });

    test('1.2: Enter physical count = 94 -> difference = -6, new stock = 94', () => {
      adjRecord = AdjustmentService.applyAdjustment({
        productId: 1,
        warehouseId: 1,
        physicalQuantity: 94,
        reason: 'Phase 3 Stock Reconciliation',
        user: 'Lead Auditor'
      });

      assert.strictEqual(adjRecord.recordedQuantity, 100);
      assert.strictEqual(adjRecord.physicalQuantity, 94);
      assert.strictEqual(adjRecord.difference, -6, 'Formula: 94 - 100 = -6');
      assert.strictEqual(adjRecord.newStock, 94, 'New stock equals physical quantity: 94');
      assert.strictEqual(adjRecord.status, 'APPLIED');
      assert.ok(adjRecord.referenceId.startsWith('ADJ-'));
    });

    test('1.3: Verify stock becomes 94 in database', () => {
      const row = db.prepare('SELECT quantity FROM stock_levels WHERE product_id = 1 AND warehouse_id = 1').get();
      assert.strictEqual(row.quantity, 94);
    });

    test('1.4: Refresh database read -> verify persistent stock remains 94', () => {
      const refreshed = AdjustmentService.getRecordedStock(1, 1);
      assert.strictEqual(refreshed.recordedQuantity, 94);
    });

    test('1.5: Verify adjustment record exists in database', () => {
      const adj = AdjustmentService.getAdjustmentById(adjRecord.id);
      assert.strictEqual(adj.id, adjRecord.id);
      assert.strictEqual(adj.physicalQuantity, 94);
      assert.strictEqual(adj.recordedQuantity, 100);
      assert.strictEqual(adj.difference, -6);
      assert.strictEqual(adj.status, 'APPLIED');
    });

    test('1.6: Test zero physical quantity (stock 94 -> 0, diff = -94)', () => {
      const zeroAdj = AdjustmentService.applyAdjustment({
        productId: 1,
        warehouseId: 1,
        physicalQuantity: 0,
        reason: 'Zero Stock Outage Test',
        user: 'Audit QA'
      });
      assert.strictEqual(zeroAdj.recordedQuantity, 94);
      assert.strictEqual(zeroAdj.physicalQuantity, 0);
      assert.strictEqual(zeroAdj.difference, -94);
      assert.strictEqual(zeroAdj.newStock, 0);

      // Verify stock in DB is 0
      const stockZero = db.prepare('SELECT quantity FROM stock_levels WHERE product_id = 1 AND warehouse_id = 1').get();
      assert.strictEqual(stockZero.quantity, 0);

      // Restore stock back to 94 for subsequent tests
      db.prepare('UPDATE stock_levels SET quantity = 94 WHERE product_id = 1 AND warehouse_id = 1').run();
      db.prepare('UPDATE products SET current_stock = 94 WHERE id = 1').run();
    });

    test('1.7: Test negative physical quantity rejection (-5 -> throws 400)', () => {
      assert.throws(() => {
        AdjustmentService.applyAdjustment({
          productId: 1,
          warehouseId: 1,
          physicalQuantity: -5
        });
      }, (err) => {
        return err.statusCode === 400 && /non-negative/i.test(err.message);
      });
    });

    test('1.8: Test invalid product rejection (productId = 99999 -> throws 404)', () => {
      assert.throws(() => {
        AdjustmentService.applyAdjustment({
          productId: 99999,
          warehouseId: 1,
          physicalQuantity: 50
        });
      }, (err) => {
        return err.statusCode === 404 && /Product with ID 99999 not found/i.test(err.message);
      });
    });

    test('1.9: Test invalid location rejection (warehouseId = 99999 -> throws 404)', () => {
      assert.throws(() => {
        AdjustmentService.applyAdjustment({
          productId: 1,
          warehouseId: 99999,
          physicalQuantity: 50
        });
      }, (err) => {
        return err.statusCode === 404 && /Warehouse with ID 99999 not found/i.test(err.message);
      });
    });

    test('1.10: Test duplicate application rejection on already applied adjustment', () => {
      assert.throws(() => {
        AdjustmentService.applyAdjustmentById(adjRecord.id);
      }, (err) => {
        return err.statusCode === 400 && /already been applied/i.test(err.message);
      });

      const uniqueRef = `DUP-KEY-${Date.now()}`;
      AdjustmentService.applyAdjustment({
        productId: 1,
        warehouseId: 1,
        physicalQuantity: 94,
        clientReference: uniqueRef
      });

      assert.throws(() => {
        AdjustmentService.applyAdjustment({
          productId: 1,
          warehouseId: 1,
          physicalQuantity: 94,
          clientReference: uniqueRef
        });
      }, (err) => {
        return err.statusCode === 400 && /already been applied/i.test(err.message);
      });
    });

    // ----------------------------------------------------
    // TASK 2: STOCK LEDGER VERIFICATION (ALL 4 MOVEMENT TYPES & 8 FIELDS)
    // ----------------------------------------------------
    console.log('\n--- TASK 2: Stock Ledger Representation & All Movement Types ---');

    const testReference = `MOVE-P3-${Date.now()}`;

    test('2.1: Ledger entry contains all 8 required fields', () => {
      const entry = LedgerService.recordMovement({
        productId: 1,
        warehouseId: 1,
        movementType: 'RECEIPT',
        quantity: 25,
        previousStock: 94,
        newStock: 119,
        referenceId: testReference,
        user: 'Receiving Team'
      });

      // Verify all 8 fields: product, SKU, location, movement type, quantity, previous stock, new stock, reference, timestamp
      assert.ok(entry.productName, 'Field 1: product name present');
      assert.ok(entry.sku, 'Field 2: SKU present');
      assert.ok(entry.warehouseName, 'Field 3: location/warehouse present');
      assert.strictEqual(entry.movementType, 'RECEIPT', 'Field 4: movement type present');
      assert.strictEqual(entry.quantity, 25, 'Field 5: quantity present');
      assert.strictEqual(entry.previousStock, 94, 'Field 6: previous stock present');
      assert.strictEqual(entry.newStock, 119, 'Field 7: new stock present');
      assert.strictEqual(entry.referenceId, testReference, 'Field 8: reference present');

      // Check DB row for timestamp
      const row = db.prepare('SELECT * FROM stock_ledger WHERE id = ?').get(entry.id);
      assert.ok(row.timestamp, 'Field: timestamp present in DB record');
    });

    test('2.2: Supported movement types: RECEIPT, DELIVERY, TRANSFER, ADJUSTMENT', () => {
      // DELIVERY
      const del = LedgerService.recordMovement({
        productId: 1,
        warehouseId: 1,
        movementType: 'DELIVERY',
        quantity: -10,
        previousStock: 119,
        newStock: 109,
        referenceId: `DEL-${Date.now()}`,
        user: 'Shipping Team'
      });
      assert.strictEqual(del.movementType, 'DELIVERY');

      // TRANSFER
      const tra = LedgerService.recordMovement({
        productId: 1,
        warehouseId: 1,
        movementType: 'TRANSFER',
        quantity: -9,
        previousStock: 109,
        newStock: 100,
        referenceId: `TRA-${Date.now()}`,
        user: 'Transfer Team'
      });
      assert.strictEqual(tra.movementType, 'TRANSFER');

      // ADJUSTMENT
      const adjMove = LedgerService.recordMovement({
        productId: 1,
        warehouseId: 1,
        movementType: 'ADJUSTMENT',
        quantity: -6,
        previousStock: 100,
        newStock: 94,
        referenceId: `ADJ-${Date.now()}`,
        user: 'Auditor'
      });
      assert.strictEqual(adjMove.movementType, 'ADJUSTMENT');

      const metrics = LedgerService.getSummaryMetrics();
      assert.ok(metrics.RECEIPT >= 1);
      assert.ok(metrics.DELIVERY >= 1);
      assert.ok(metrics.TRANSFER >= 1);
      assert.ok(metrics.ADJUSTMENT >= 1);
    });

    // ----------------------------------------------------
    // TASK 3: LOW-STOCK DETERMINISTIC VERIFICATION & BOUNDARIES
    // ----------------------------------------------------
    console.log('\n--- TASK 3: Low-Stock Deterministic Evaluation & Boundary Conditions ---');

    test('3.1: Stock = 15, Threshold = 10 -> IN STOCK', () => {
      const res = LowStockService.evaluateStockStatus(15, 10);
      assert.strictEqual(res.status, 'IN_STOCK');
      assert.strictEqual(res.label, 'IN STOCK');
    });

    test('3.2: Stock = 10, Threshold = 10 -> LOW STOCK (exact boundary condition)', () => {
      const res = LowStockService.evaluateStockStatus(10, 10);
      assert.strictEqual(res.status, 'LOW_STOCK');
      assert.strictEqual(res.label, 'LOW STOCK');
    });

    test('3.3: Stock = 8, Threshold = 10 -> LOW STOCK', () => {
      const res = LowStockService.evaluateStockStatus(8, 10);
      assert.strictEqual(res.status, 'LOW_STOCK');
      assert.strictEqual(res.label, 'LOW STOCK');
    });

    test('3.4: Stock = 0, Threshold = 10 -> OUT OF STOCK', () => {
      const res = LowStockService.evaluateStockStatus(0, 10);
      assert.strictEqual(res.status, 'OUT_OF_STOCK');
      assert.strictEqual(res.label, 'OUT OF STOCK');
    });

    test('3.5: Negative stock boundary (stock = -1) -> OUT OF STOCK', () => {
      const res = LowStockService.evaluateStockStatus(-1, 10);
      assert.strictEqual(res.status, 'OUT_OF_STOCK');
    });

    // ----------------------------------------------------
    // TASK 4: SEARCH / FILTER COMBINATIONS & NON-MUTATION
    // ----------------------------------------------------
    console.log('\n--- TASK 4: Search & Filter Verification with Combined Criteria ---');

    test('4.1: Filter by product (productId = 1)', () => {
      const res = LedgerService.getLedgerEntries({ productId: 1 });
      assert.ok(res.data.length > 0);
      res.data.forEach(e => assert.strictEqual(e.productId, 1));
    });

    test('4.2: Filter by movement type (RECEIPT)', () => {
      const res = LedgerService.getLedgerEntries({ movementType: 'RECEIPT' });
      assert.ok(res.data.length > 0);
      res.data.forEach(e => assert.strictEqual(e.movementType, 'RECEIPT'));
    });

    test('4.3: Filter by location (warehouseId = 1)', () => {
      const res = LedgerService.getLedgerEntries({ warehouseId: 1 });
      assert.ok(res.data.length > 0);
      res.data.forEach(e => assert.strictEqual(e.warehouseId, 1));
    });

    test('4.4: Filter by date range (today)', () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = LedgerService.getLedgerEntries({ startDate: today, endDate: today });
      assert.ok(res.data.length > 0);
    });

    test('4.5: Combination filter (productId = 1 AND warehouseId = 1 AND movementType = ADJUSTMENT)', () => {
      const res = LedgerService.getLedgerEntries({
        productId: 1,
        warehouseId: 1,
        movementType: 'ADJUSTMENT'
      });
      assert.ok(res.data.length > 0);
      res.data.forEach(e => {
        assert.strictEqual(e.productId, 1);
        assert.strictEqual(e.warehouseId, 1);
        assert.strictEqual(e.movementType, 'ADJUSTMENT');
      });
    });

    test('4.6: Verify filters do not change underlying stock data', () => {
      // Snapshot stock levels before filter executions
      const beforeLevels = db.prepare('SELECT product_id, warehouse_id, quantity FROM stock_levels ORDER BY product_id, warehouse_id').all();
      const beforeProducts = db.prepare('SELECT id, current_stock FROM products ORDER BY id').all();

      // Run multiple filter queries
      LedgerService.getLedgerEntries({ movementType: 'ADJUSTMENT' });
      LedgerService.getLedgerEntries({ movementType: 'RECEIPT' });
      LedgerService.getLedgerEntries({ productId: 1, warehouseId: 1 });
      LedgerService.getLedgerEntries({ search: 'SKU' });
      LowStockService.getStockStatus({ statusFilter: 'LOW_STOCK' });
      LowStockService.getStockStatus({ statusFilter: 'OUT_OF_STOCK' });

      // Snapshot after
      const afterLevels = db.prepare('SELECT product_id, warehouse_id, quantity FROM stock_levels ORDER BY product_id, warehouse_id').all();
      const afterProducts = db.prepare('SELECT id, current_stock FROM products ORDER BY id').all();

      assert.deepStrictEqual(beforeLevels, afterLevels, 'Filters must NEVER alter stock_levels data');
      assert.deepStrictEqual(beforeProducts, afterProducts, 'Filters must NEVER alter products data');
    });

    // ----------------------------------------------------
    // TASK 5: LEDGER CONSISTENCY & EXTERNAL MODULE INTEGRATION INTERFACE
    // ----------------------------------------------------
    console.log('\n--- TASK 5: Ledger Consistency & External Module Emission ---');

    test('5.1: Adjustment atomically changes stock AND writes ledger entry with same reference', () => {
      const beforeStock = db.prepare('SELECT quantity FROM stock_levels WHERE product_id = 1 AND warehouse_id = 1').get().quantity;
      const targetPhysical = 96;

      const adj = AdjustmentService.applyAdjustment({
        productId: 1,
        warehouseId: 1,
        physicalQuantity: targetPhysical,
        reason: 'Consistency Verification'
      });

      // Verify stock was changed
      const afterStock = db.prepare('SELECT quantity FROM stock_levels WHERE product_id = 1 AND warehouse_id = 1').get().quantity;
      assert.strictEqual(afterStock, targetPhysical);

      // Verify ledger has matching entry
      const ledger = db.prepare('SELECT * FROM stock_ledger WHERE reference_id = ?').get(adj.referenceId);
      assert.ok(ledger);
      assert.strictEqual(ledger.previous_stock, beforeStock);
      assert.strictEqual(ledger.new_stock, targetPhysical);
      assert.strictEqual(ledger.quantity, targetPhysical - beforeStock);
    });

    await asyncTest('5.2: External module REST emission interface (POST /api/ledger)', async () => {
      const payload = {
        productId: 1,
        warehouseId: 1,
        movementType: 'RECEIPT',
        quantity: 30,
        previousStock: 96,
        newStock: 126,
        referenceId: `EXT-REC-${Date.now()}`,
        user: 'External Receipt Service'
      };

      const res = await makeRequest('/api/ledger', {
        method: 'POST',
        body: payload
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.movementType, 'RECEIPT');
      assert.strictEqual(res.body.data.quantity, 30);
      assert.strictEqual(res.body.data.referenceId, payload.referenceId);
    });

    // ----------------------------------------------------
    // REGRESSION & SPA ROUTE VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- REGRESSION CHECK: SPA Routes, Schemas & API Health ---');

    await asyncTest('Reg 1: GET /api/health -> 200 OK', async () => {
      const res = await makeRequest('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'online');
    });

    await asyncTest('Reg 2: SPA Route GET /adjustments -> 200 OK', async () => {
      const res = await makeRequest('/adjustments');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /StockSense/i);
    });

    await asyncTest('Reg 3: SPA Route GET /adjustments/new -> 200 OK', async () => {
      const res = await makeRequest('/adjustments/new');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /StockSense/i);
    });

    await asyncTest('Reg 4: SPA Route GET /adjustments/1 -> 200 OK', async () => {
      const res = await makeRequest('/adjustments/1');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /StockSense/i);
    });

    await asyncTest('Reg 5: SPA Route GET /move-history -> 200 OK', async () => {
      const res = await makeRequest('/move-history');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /StockSense/i);
    });

    await asyncTest('Reg 6: GET /api/stock-status/alerts -> 200 OK', async () => {
      const res = await makeRequest('/api/stock-status/alerts');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.alerts));
    });

    await asyncTest('Reg 7: Contract Alias GET /api/products/low-stock -> 200 OK', async () => {
      const res = await makeRequest('/api/products/low-stock');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    await asyncTest('Reg 8: Team Leader Convention GET /api/v1/adjustments -> 200 OK', async () => {
      const res = await makeRequest('/api/v1/adjustments');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    await asyncTest('Reg 9: Team Leader Convention GET /api/v1/ledger -> 200 OK', async () => {
      const res = await makeRequest('/api/v1/ledger');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    await asyncTest('Reg 10: SPA Route GET /low-stock -> 200 OK', async () => {
      const res = await makeRequest('/low-stock');
      assert.strictEqual(res.status, 200);
      assert.match(res.body, /StockSense/i);
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n====================================================');
  console.log(`  PHASE 3 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
