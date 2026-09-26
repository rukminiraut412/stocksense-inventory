const { db } = require('../../config/database');

/**
 * Service for deterministic low-stock calculations and stock status queries
 */
class LowStockService {
  /**
   * Deterministic status evaluation helper
   * @param {number} currentStock
   * @param {number} threshold
   * @returns {{ status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK', label: string, color: string }}
   */
  static evaluateStockStatus(currentStock, threshold) {
    const stock = Number(currentStock) || 0;
    const thresh = Number(threshold) >= 0 ? Number(threshold) : 10;

    if (stock <= 0) {
      return {
        status: 'OUT_OF_STOCK',
        label: 'OUT OF STOCK',
        color: '#ef4444' // red
      };
    } else if (stock <= thresh) {
      return {
        status: 'LOW_STOCK',
        label: 'LOW STOCK',
        color: '#f59e0b' // amber
      };
    } else {
      return {
        status: 'IN_STOCK',
        label: 'IN STOCK',
        color: '#10b981' // emerald green
      };
    }
  }

  /**
   * Get stock status across warehouses or aggregated per product
   */
  static getStockStatus({
    warehouseId,
    statusFilter,
    search,
    limit = 100,
    offset = 0
  } = {}) {
    let query = `
      SELECT 
        p.id as productId,
        p.sku,
        p.name as productName,
        p.category,
        p.reorder_threshold as threshold,
        COALESCE(w.id, 0) as warehouseId,
        COALESCE(w.name, 'All Warehouses') as warehouseName,
        COALESCE(s.quantity, 0) as currentStock
      FROM products p
      LEFT JOIN stock_levels s ON p.id = s.product_id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      WHERE 1=1
    `;
    const params = [];

    if (warehouseId && warehouseId !== 'all') {
      query += ` AND s.warehouse_id = ?`;
      params.push(Number(warehouseId));
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    query += ` ORDER BY p.id ASC, w.id ASC`;

    const rawRows = db.prepare(query).all(...params);

    // Map each item through deterministic low stock evaluation
    const mapped = rawRows.map(row => {
      const evaluation = this.evaluateStockStatus(row.currentStock, row.threshold);
      const differenceToThreshold = row.currentStock - row.threshold;

      return {
        ...row,
        status: evaluation.status,
        statusLabel: evaluation.label,
        statusColor: evaluation.color,
        differenceToThreshold,
        needsReorder: evaluation.status === 'LOW_STOCK' || evaluation.status === 'OUT_OF_STOCK'
      };
    });

    // Apply status filter if provided
    let filtered = mapped;
    if (statusFilter && statusFilter !== 'ALL') {
      filtered = mapped.filter(item => item.status === statusFilter || item.statusLabel === statusFilter);
    }

    // Calculate comprehensive summary metrics for Dashboard consumption
    const summary = {
      totalMonitored: mapped.length,
      inStockCount: mapped.filter(i => i.status === 'IN_STOCK').length,
      lowStockCount: mapped.filter(i => i.status === 'LOW_STOCK').length,
      outOfStockCount: mapped.filter(i => i.status === 'OUT_OF_STOCK').length,
      criticalReorderCount: mapped.filter(i => i.needsReorder).length
    };

    // Paginate in memory after status filter
    const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit));

    return {
      summary,
      total: filtered.length,
      limit: Number(limit),
      offset: Number(offset),
      data: paginated
    };
  }

  /**
   * Quick dashboard endpoint exposing low-stock alerts
   */
  static getLowStockAlerts() {
    const result = this.getStockStatus({ limit: 1000 });
    const alerts = result.data.filter(i => i.needsReorder);

    return {
      alertCount: alerts.length,
      summary: result.summary,
      alerts
    };
  }
}

module.exports = LowStockService;
