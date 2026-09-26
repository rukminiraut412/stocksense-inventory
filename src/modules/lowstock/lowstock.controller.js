const LowStockService = require('./lowstock.service');

class LowStockController {
  static getStockStatus(req, res) {
    try {
      const { warehouseId, status, search, limit, offset } = req.query;

      const result = LowStockService.getStockStatus({
        warehouseId,
        statusFilter: status,
        search,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[LowStockController.getStockStatus] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static getAlerts(req, res) {
    try {
      const alerts = LowStockService.getLowStockAlerts();
      return res.status(200).json({
        success: true,
        data: alerts
      });
    } catch (error) {
      console.error('[LowStockController.getAlerts] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = LowStockController;
