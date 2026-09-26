const { db } = require('../../config/database');

/**
 * Service to manage Stock Ledger / Movement History
 */
class LedgerService {
  /**
   * Record a stock movement in the ledger
   * @param {Object} movement
   * @param {number} movement.productId
   * @param {number} movement.warehouseId
   * @param {string} movement.movementType - 'ADJUSTMENT' | 'RECEIPT' | 'DELIVERY' | 'TRANSFER'
   * @param {number} movement.quantity - change in stock (+ or -)
   * @param {number} movement.previousStock - stock before movement
   * @param {number} movement.newStock - stock after movement
   * @param {string} [movement.referenceId] - e.g. 'ADJ-101'
   * @param {string} [movement.user] - user or role performing the movement
   */
  static recordMovement({
    productId,
    warehouseId,
    movementType,
    quantity,
    previousStock,
    newStock,
    referenceId = null,
    user = 'System'
  }) {
    // Validate movement type
    const validTypes = ['ADJUSTMENT', 'RECEIPT', 'DELIVERY', 'TRANSFER'];
    if (!validTypes.includes(movementType)) {
      throw new Error(`Invalid movement type: ${movementType}. Must be one of ${validTypes.join(', ')}`);
    }

    // Retrieve product metadata
    const product = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(productId);
    if (!product) {
      throw new Error(`Product not found with id ${productId}`);
    }

    // Retrieve warehouse metadata
    const warehouse = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouseId);
    if (!warehouse) {
      throw new Error(`Warehouse not found with id ${warehouseId}`);
    }

    const stmt = db.prepare(`
      INSERT INTO stock_ledger (
        product_id,
        product_name,
        sku,
        warehouse_id,
        warehouse_name,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        reference_id,
        user,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      productId,
      product.name,
      product.sku,
      warehouseId,
      warehouse.name,
      movementType,
      quantity,
      previousStock,
      newStock,
      referenceId,
      user
    );

    return {
      id: Number(result.lastInsertRowid),
      productId,
      productName: product.name,
      sku: product.sku,
      warehouseId,
      warehouseName: warehouse.name,
      movementType,
      quantity,
      previousStock,
      newStock,
      referenceId,
      user
    };
  }

  /**
   * Retrieve ledger entries with filtering and search
   */
  static getLedgerEntries({
    productId,
    warehouseId,
    movementType,
    startDate,
    endDate,
    search,
    limit = 50,
    offset = 0
  } = {}) {
    let query = `
      SELECT 
        id,
        product_id as productId,
        product_name as productName,
        sku,
        warehouse_id as warehouseId,
        warehouse_name as warehouseName,
        movement_type as movementType,
        quantity,
        previous_stock as previousStock,
        new_stock as newStock,
        reference_id as referenceId,
        user,
        timestamp
      FROM stock_ledger
      WHERE 1=1
    `;
    const params = [];

    if (productId) {
      query += ` AND product_id = ?`;
      params.push(Number(productId));
    }

    if (warehouseId) {
      query += ` AND warehouse_id = ?`;
      params.push(Number(warehouseId));
    }

    if (movementType) {
      query += ` AND movement_type = ?`;
      params.push(movementType);
    }

    if (startDate) {
      query += ` AND timestamp >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      // Append end of day if only date is passed
      const formattedEndDate = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      query += ` AND timestamp <= ?`;
      params.push(formattedEndDate);
    }

    if (search) {
      query += ` AND (product_name LIKE ? OR sku LIKE ? OR reference_id LIKE ? OR user LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const total = db.prepare(countQuery).get(...params).total;

    // Order & pagination
    query += ` ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = db.prepare(query).all(...params);

    return {
      total,
      limit: Number(limit),
      offset: Number(offset),
      data: rows
    };
  }

  /**
   * Get ledger summary metrics
   */
  static getSummaryMetrics() {
    const totalMoves = db.prepare('SELECT COUNT(*) as total FROM stock_ledger').get().total;
    const byType = db.prepare(`
      SELECT movement_type as type, COUNT(*) as count 
      FROM stock_ledger 
      GROUP BY movement_type
    `).all();

    const stats = {
      totalMoves,
      ADJUSTMENT: 0,
      RECEIPT: 0,
      DELIVERY: 0,
      TRANSFER: 0
    };

    byType.forEach(row => {
      stats[row.type] = row.count;
    });

    return stats;
  }
}

module.exports = LedgerService;
