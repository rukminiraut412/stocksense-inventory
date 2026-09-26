const LedgerService = require('./ledger.service');

class LedgerController {
  static getEntries(req, res) {
    try {
      const {
        productId,
        warehouseId,
        movementType,
        startDate,
        endDate,
        search,
        limit,
        offset
      } = req.query;

      const result = LedgerService.getLedgerEntries({
        productId,
        warehouseId,
        movementType,
        startDate,
        endDate,
        search,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[LedgerController.getEntries] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error while fetching ledger entries'
      });
    }
  }

  static getMetrics(req, res) {
    try {
      const metrics = LedgerService.getSummaryMetrics();
      return res.status(200).json({
        success: true,
        metrics
      });
    } catch (error) {
      console.error('[LedgerController.getMetrics] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error while fetching ledger metrics'
      });
    }
  }

  static createEntry(req, res) {
    try {
      const {
        productId,
        warehouseId,
        movementType,
        quantity,
        previousStock,
        newStock,
        referenceId,
        user
      } = req.body;

      if (!productId || !warehouseId || !movementType || quantity === undefined || previousStock === undefined || newStock === undefined) {
        return res.status(400).json({
          success: false,
          error: 'productId, warehouseId, movementType, quantity, previousStock, and newStock are required'
        });
      }

      const entry = LedgerService.recordMovement({
        productId: Number(productId),
        warehouseId: Number(warehouseId),
        movementType,
        quantity: Number(quantity),
        previousStock: Number(previousStock),
        newStock: Number(newStock),
        referenceId,
        user
      });

      return res.status(201).json({
        success: true,
        data: entry
      });
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) {
        console.error('[LedgerController.createEntry] Error:', error);
      }
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = LedgerController;
