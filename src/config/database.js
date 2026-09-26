const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'stocksense.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for reliable concurrency & data integrity
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      unit_of_measure TEXT DEFAULT 'pcs',
      reorder_threshold INTEGER NOT NULL DEFAULT 10,
      current_stock REAL DEFAULT 0.0,
      initial_stock REAL DEFAULT 0.0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, warehouse_id)
    );

    CREATE TABLE IF NOT EXISTS adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      recorded_quantity INTEGER NOT NULL,
      physical_quantity INTEGER NOT NULL,
      difference INTEGER NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'APPLIED',
      created_by TEXT DEFAULT 'Inventory Admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      warehouse_name TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reference_id TEXT,
      user TEXT DEFAULT 'System',
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_product ON stock_ledger(product_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_warehouse ON stock_ledger(warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_movement ON stock_ledger(movement_type);
    CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON stock_ledger(timestamp);
    CREATE INDEX IF NOT EXISTS idx_adjustments_product ON adjustments(product_id);
  `);

  // Ensure backward/forward compatibility migrations if table already exists
  try { db.exec(`ALTER TABLE products ADD COLUMN unit_of_measure TEXT DEFAULT 'pcs'`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN current_stock REAL DEFAULT 0.0`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN initial_stock REAL DEFAULT 0.0`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN updated_at TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE adjustments ADD COLUMN client_reference TEXT`); } catch (e) {}

  // Seed baseline data if tables are brand new, ensuring test cases can run immediately
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    seedBaselineData();
  }
}

function seedBaselineData() {
  console.log('[Database] Seeding baseline inventory data...');
  
  const insertWarehouse = db.prepare(`
    INSERT INTO warehouses (code, name, location) VALUES (?, ?, ?)
  `);
  insertWarehouse.run('WH-MAIN', 'Central Main Warehouse', 'Building A, Zone 1');
  insertWarehouse.run('WH-EAST', 'East Hub Logistics', 'Building B, Bay 4');
  insertWarehouse.run('WH-WEST', 'West Distribution Center', 'Building C, Bay 2');

  const insertProduct = db.prepare(`
    INSERT INTO products (sku, name, category, reorder_threshold) VALUES (?, ?, ?, ?)
  `);
  // Product 1: Primary test product with threshold 10
  insertProduct.run('SKU-1001', 'High-Precision Microcontroller MCU-32', 'Electronics', 10);
  insertProduct.run('SKU-1002', 'Wireless IoT Sensor Transceiver 2.4GHz', 'Electronics', 15);
  insertProduct.run('SKU-1003', 'Industrial Power Adapter 12V 5A', 'Power Supplies', 8);
  insertProduct.run('SKU-1004', 'Thermal Heat Sink Aluminum 40mm', 'Hardware', 20);
  insertProduct.run('SKU-1005', 'Fiber Optic Patch Cable SC-LC 5m', 'Cables', 12);

  const insertStock = db.prepare(`
    INSERT INTO stock_levels (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
  `);
  
  // Product 1 (SKU-1001): 100 units in WH-MAIN (exactly for requirement test case 1: 100 -> 94)
  insertStock.run(1, 1, 100);
  insertStock.run(1, 2, 25);
  
  // Product 2 (SKU-1002): 8 units in WH-MAIN (for testing LOW STOCK: 8 <= 15)
  insertStock.run(2, 1, 8);

  // Product 3 (SKU-1003): 0 units in WH-MAIN (for testing OUT OF STOCK: 0)
  insertStock.run(3, 1, 0);

  // Product 4 (SKU-1004): 50 units in WH-MAIN (for testing IN STOCK: 50 > 20)
  insertStock.run(4, 1, 50);

  // Product 5 (SKU-1005): 12 units in WH-MAIN (for testing LOW STOCK boundary: 12 <= 12)
  insertStock.run(5, 1, 12);

  console.log('[Database] Baseline inventory data seeded successfully.');
}

module.exports = {
  db,
  initializeDatabase,
};
