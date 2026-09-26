const express = require('express');
const router = express.Router();
const LowStockController = require('./lowstock.controller');

// GET /api/stock-status - list stock status and metrics
router.get('/', LowStockController.getStockStatus);

// GET /api/stock-status/alerts - dashboard low-stock alert summary
router.get('/alerts', LowStockController.getAlerts);

module.exports = router;
