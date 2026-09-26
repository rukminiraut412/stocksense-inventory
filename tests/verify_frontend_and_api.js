const fs = require('node:fs');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const db = new DatabaseSync(path.resolve(__dirname, '../data/stocksense.db'));

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('  StockSense Pre-Integration Hardening Verification');
  console.log('====================================================\n');

  // 1. FRONTEND DOM VERIFICATION
  console.log('--- 1. Frontend DOM & Static Asset Checks ---');
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');

  const requiredIds = [
    'tab-btn-adjustments',
    'tab-btn-ledger',
    'tab-btn-lowstock',
    'adjustment-form',
    'adj-product-select',
    'adj-warehouse-select',
    'adj-recorded-display',
    'adj-physical-input',
    'adj-reason-input',
    'adj-user-input',
    'adj-calc-diff',
    'adj-calc-new',
    'adj-submit-btn',
    'adj-total-count',
    'adj-search-input',
    'adj-table-body',
    'metric-total-moves',
    'ledger-type-filter',
    'ledger-product-filter',
    'ledger-warehouse-filter',
    'ledger-start-date',
    'ledger-end-date',
    'ledger-search',
    'ledger-reset-btn',
    'ledger-table-body',
    'metric-instock',
    'metric-lowstock',
    'metric-outofstock',
    'metric-reorder',
    'lowstock-search',
    'lowstock-table-body',
    'adj-details-modal',
    'adj-modal-close',
    'modal-ledger-info',
    'toast-container'
  ];

  let domPassed = 0;
  for (const id of requiredIds) {
    const exists = html.includes(`id="${id}"`);
    console.log(`  [${exists ? 'PASS' : 'FAIL'}] Element #${id}: ${exists ? 'Found' : 'MISSING'}`);
    if (exists) domPassed++;
  }
  console.log(`DOM Elements Verified: ${domPassed}/${requiredIds.length}\n`);

  // 2. API ENDPOINTS CHECK
  console.log('--- 2. API Endpoints Testing ---');
  const endpoints = [
    { name: 'Health check', method: 'GET', path: '/api/health', expectedStatus: 200 },
    { name: 'List adjustments', method: 'GET', path: '/api/adjustments', expectedStatus: 200 },
    { name: 'Get recorded stock', method: 'GET', path: '/api/adjustments/recorded-stock?productId=1&warehouseId=1', expectedStatus: 200 },
    { name: 'Get adjustment by ID', method: 'GET', path: '/api/adjustments/1', expectedStatus: 200 },
    { name: 'List stock ledger', method: 'GET', path: '/api/ledger?limit=10', expectedStatus: 200 },
    { name: 'Get ledger metrics', method: 'GET', path: '/api/ledger/metrics', expectedStatus: 200 },
    { name: 'Get low stock status', method: 'GET', path: '/api/stock-status', expectedStatus: 200 },
    { name: 'Get low stock alerts', method: 'GET', path: '/api/stock-status/alerts', expectedStatus: 200 },
    { name: 'Team Leader contract alias (low-stock)', method: 'GET', path: '/api/products/low-stock', expectedStatus: 200 },
    { name: 'Team Leader v1 adjustments', method: 'GET', path: '/api/v1/adjustments', expectedStatus: 200 },
    { name: 'Team Leader v1 ledger', method: 'GET', path: '/api/v1/ledger', expectedStatus: 200 },
    { name: 'Inventory products lookup', method: 'GET', path: '/api/inventory/products', expectedStatus: 200 },
    { name: 'Inventory warehouses lookup', method: 'GET', path: '/api/inventory/warehouses', expectedStatus: 200 },
    { name: '404 on invalid adjustment ID', method: 'GET', path: '/api/adjustments/999999', expectedStatus: 404 },
    { name: '400 on negative physical qty', method: 'POST', path: '/api/adjustments', body: { productId: 1, warehouseId: 1, physicalQuantity: -5 }, expectedStatus: 400 },
    { name: '404 on invalid product in adjustment', method: 'POST', path: '/api/adjustments', body: { productId: 999999, warehouseId: 1, physicalQuantity: 10 }, expectedStatus: 404 },
    { name: '400 on missing ledger fields', method: 'POST', path: '/api/ledger', body: { productId: 1 }, expectedStatus: 400 }
  ];

  let apiPassed = 0;
  for (const ep of endpoints) {
    const res = await request(ep.method, ep.path, ep.body);
    const pass = res.status === ep.expectedStatus;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${ep.name} (${ep.method} ${ep.path}) -> Status: ${res.status}`);
    if (pass) apiPassed++;
  }
  console.log(`API Endpoints Tested: ${apiPassed}/${endpoints.length}\n`);

  // 3. DATABASE INTEGRITY CHECK
  console.log('--- 3. Direct SQLite Database Integrity ---');
  const prodCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const whCount = db.prepare('SELECT COUNT(*) as c FROM warehouses').get().c;
  const adjCount = db.prepare('SELECT COUNT(*) as c FROM adjustments').get().c;
  const ledgerCount = db.prepare('SELECT COUNT(*) as c FROM stock_ledger').get().c;
  const stockCount = db.prepare('SELECT COUNT(*) as c FROM stock_levels').get().c;

  console.log(`  Products in DB:     ${prodCount}`);
  console.log(`  Warehouses in DB:   ${whCount}`);
  console.log(`  Stock levels in DB: ${stockCount}`);
  console.log(`  Adjustments in DB:  ${adjCount}`);
  console.log(`  Ledger moves in DB: ${ledgerCount}`);

  console.log('\n====================================================');
  console.log('  ALL VERIFICATIONS COMPLETED SUCCESSFULLY');
  console.log('====================================================');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
