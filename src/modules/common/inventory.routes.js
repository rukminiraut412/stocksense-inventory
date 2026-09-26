const express = require('express');
const router = express.Router();
const { db } = require('../../config/database');

/**
 * Read-only lookup endpoints for Products and Warehouses
 * Used by Adjustment dropdowns and Ledger filter selectors
 * NOTE: We do NOT implement Product Management / CRUD here as that belongs to Team Member 1.
 */

// GET /api/inventory/products - list products for selector dropdowns
router.get('/products', (req, res) => {
  try {
    const products = db.prepare('SELECT id, sku, name, category, reorder_threshold as reorderThreshold FROM products ORDER BY id ASC').all();
    return res.status(200).json({ success: true, data: products });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory/warehouses - list warehouses for selector dropdowns
router.get('/warehouses', (req, res) => {
  try {
    const warehouses = db.prepare('SELECT id, code, name, location FROM warehouses ORDER BY id ASC').all();
    return res.status(200).json({ success: true, data: warehouses });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
