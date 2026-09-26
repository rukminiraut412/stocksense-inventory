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
}

module.exports = LedgerController;
