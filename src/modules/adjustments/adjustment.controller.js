const AdjustmentService = require('./adjustment.service');

class AdjustmentController {
  /**
   * GET /api/adjustments/recorded-stock
   * Query params: productId, warehouseId
   */
  static getRecordedStock(req, res) {
    try {
      const { productId, warehouseId } = req.query;
      if (!productId || !warehouseId) {
        return res.status(400).json({
          success: false,
          error: 'Both productId and warehouseId are required in query params'
        });
      }

      const result = AdjustmentService.getRecordedStock(productId, warehouseId);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[AdjustmentController.getRecordedStock] Error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/adjustments
   * Body: { productId, warehouseId, physicalQuantity, reason, user }
   */
  static createAdjustment(req, res) {
    try {
      const { productId, warehouseId, physicalQuantity, reason, user } = req.body;

      if (productId === undefined || warehouseId === undefined || physicalQuantity === undefined) {
        return res.status(400).json({
          success: false,
          error: 'productId, warehouseId, and physicalQuantity are required'
        });
      }

      const adjustment = AdjustmentService.applyAdjustment({
        productId,
        warehouseId,
        physicalQuantity,
        reason,
        user
      });

      return res.status(201).json({
        success: true,
        message: 'Adjustment applied and recorded in stock ledger successfully',
        data: adjustment
      });
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) {
        console.error('[AdjustmentController.createAdjustment] Error:', error);
      }
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/adjustments
   */
  static getAdjustments(req, res) {
    try {
      const { productId, warehouseId, search, limit, offset } = req.query;

      const result = AdjustmentService.getAdjustments({
        productId,
        warehouseId,
        search,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[AdjustmentController.getAdjustments] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/adjustments/:id
   */
  static getAdjustmentById(req, res) {
    try {
      const { id } = req.params;
      const adjustment = AdjustmentService.getAdjustmentById(id);

      return res.status(200).json({
        success: true,
        data: adjustment
      });
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) {
        console.error('[AdjustmentController.getAdjustmentById] Error:', error);
      }
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/adjustments/:id/apply
   * Rejects duplicate application if already APPLIED
   */
  static applyAdjustmentById(req, res) {
    try {
      const { id } = req.params;
      const result = AdjustmentService.applyAdjustmentById(id);
      return res.status(200).json({
        success: true,
        message: 'Adjustment applied successfully',
        data: result
      });
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) {
        console.error('[AdjustmentController.applyAdjustmentById] Error:', error);
      }
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = AdjustmentController;
