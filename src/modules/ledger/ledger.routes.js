const express = require('express');
const router = express.Router();
const LedgerController = require('./ledger.controller');

// GET /api/ledger - Get ledger entries with filters
router.get('/', LedgerController.getEntries);

// GET /api/ledger/metrics - Get movement type breakdown metrics
router.get('/metrics', LedgerController.getMetrics);

module.exports = router;
