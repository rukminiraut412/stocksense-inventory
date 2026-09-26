const express = require('express');
const router = express.Router();
const AdjustmentController = require('./adjustment.controller');

// GET current recorded stock before making adjustment
router.get('/recorded-stock', AdjustmentController.getRecordedStock);

// POST create and apply adjustment
router.post('/', AdjustmentController.createAdjustment);

// GET list of adjustments
router.get('/', AdjustmentController.getAdjustments);

// GET adjustment details by ID
router.get('/:id', AdjustmentController.getAdjustmentById);

module.exports = router;
