const { db } = require('../../config/database');
const LedgerService = require('../ledger/ledger.service');

/**
 * Service handling Inventory Adjustments
 */
class AdjustmentService {
  /**
   * Get current recorded stock for a given product and warehouse
   */
  static getRecordedStock(productId, warehouseId) {
    const product = db.prepare('SELECT id, name, sku FROM products WHERE id = ?').get(Number(productId));
    if (!product) {
      throw new Error(`Product with ID ${productId} does not exist`);
    }

    const warehouse = db.prepare('SELECT id, name, code FROM warehouses WHERE id = ?').get(Number(warehouseId));
    if (!warehouse) {
      throw new Error(`Warehouse with ID ${warehouseId} does not exist`);
    }

    const stock = db.prepare(`
      SELECT quantity FROM stock_levels 
      WHERE product_id = ? AND warehouse_id = ?
    `).get(Number(productId), Number(warehouseId));

    const recordedQuantity = stock ? stock.quantity : 0;

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      recordedQuantity
    };
  }

  /**
   * Create and immediately apply an inventory adjustment in an atomic transaction
   * @param {Object} params
   * @param {number} params.productId
   * @param {number} params.warehouseId
   * @param {number} params.physicalQuantity
   * @param {string} [params.reason]
   * @param {string} [params.user]
   */
  static applyAdjustment({
    productId,
    warehouseId,
    physicalQuantity,
    reason = '',
    user = 'Inventory Specialist'
  }) {
    const pId = Number(productId);
    const wId = Number(warehouseId);
    const physicalQty = Number(physicalQuantity);

    // Rule 1: Validate physical quantity cannot be negative
    if (isNaN(physicalQty) || !Number.isInteger(physicalQty) || physicalQty < 0) {
      const err = new Error('Physical counted quantity must be a non-negative integer (>= 0)');
      err.statusCode = 400;
      throw err;
    }

    if (!pId || !wId) {
      const err = new Error('Product ID and Warehouse ID are required');
      err.statusCode = 400;
      throw err;
    }

    // Begin atomic transaction
    db.exec('BEGIN TRANSACTION');

    try {
      // Verify product
      const product = db.prepare('SELECT id, name, sku FROM products WHERE id = ?').get(pId);
      if (!product) {
        const err = new Error(`Product with ID ${pId} not found`);
        err.statusCode = 404;
        throw err;
      }

      // Verify warehouse
      const warehouse = db.prepare('SELECT id, name, code FROM warehouses WHERE id = ?').get(wId);
      if (!warehouse) {
        const err = new Error(`Warehouse with ID ${wId} not found`);
        err.statusCode = 404;
        throw err;
      }

      // Current recorded stock
      const stockRow = db.prepare(`
        SELECT quantity FROM stock_levels 
        WHERE product_id = ? AND warehouse_id = ?
      `).get(pId, wId);

      const recordedQuantity = stockRow ? stockRow.quantity : 0;

      // Formula: difference = physical_quantity - recorded_quantity
      const difference = physicalQty - recordedQuantity;
      // After adjustment: new_stock = physical_quantity
      const newStock = physicalQty;

      // Rule 2 & 3: Store adjustment record persistently with status APPLIED
      const insertAdjStmt = db.prepare(`
        INSERT INTO adjustments (
          product_id,
          warehouse_id,
          recorded_quantity,
          physical_quantity,
          difference,
          reason,
          status,
          created_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'APPLIED', ?, datetime('now'))
      `);

      const adjResult = insertAdjStmt.run(
        pId,
        wId,
        recordedQuantity,
        physicalQty,
        difference,
        reason || 'Physical Count Reconciliation',
        user
      );

      const adjustmentId = Number(adjResult.lastInsertRowid);
      const referenceId = `ADJ-${adjustmentId.toString().padStart(4, '0')}`;

      // Update or insert stock level
      if (stockRow) {
        db.prepare(`
          UPDATE stock_levels 
          SET quantity = ?, updated_at = datetime('now') 
          WHERE product_id = ? AND warehouse_id = ?
        `).run(newStock, pId, wId);
      } else {
        db.prepare(`
          INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_at)
          VALUES (?, ?, ?, datetime('now'))
        `).run(pId, wId, newStock);
      }

      // Rule 4: Traceable movement recorded directly into the stock ledger
      const ledgerEntry = LedgerService.recordMovement({
        productId: pId,
        warehouseId: wId,
        movementType: 'ADJUSTMENT',
        quantity: difference,
        previousStock: recordedQuantity,
        newStock: newStock,
        referenceId: referenceId,
        user: user
      });

      db.exec('COMMIT');

      return {
        id: adjustmentId,
        referenceId,
        productId: pId,
        productName: product.name,
        sku: product.sku,
        warehouseId: wId,
        warehouseName: warehouse.name,
        recordedQuantity,
        physicalQuantity: physicalQty,
        difference,
        newStock,
        reason: reason || 'Physical Count Reconciliation',
        status: 'APPLIED',
        createdBy: user,
        ledgerEntryId: ledgerEntry.id,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * List adjustments with optional filters
   */
  static getAdjustments({
    productId,
    warehouseId,
    search,
    limit = 50,
    offset = 0
  } = {}) {
    let query = `
      SELECT 
        a.id,
        ('ADJ-' || printf('%04d', a.id)) as referenceId,
        a.product_id as productId,
        p.name as productName,
        p.sku as sku,
        a.warehouse_id as warehouseId,
        w.name as warehouseName,
        a.recorded_quantity as recordedQuantity,
        a.physical_quantity as physicalQuantity,
        a.difference as difference,
        a.reason,
        a.status,
        a.created_by as createdBy,
        a.created_at as createdAt
      FROM adjustments a
      JOIN products p ON a.product_id = p.id
      JOIN warehouses w ON a.warehouse_id = w.id
      WHERE 1=1
    `;
    const params = [];

    if (productId) {
      query += ` AND a.product_id = ?`;
      params.push(Number(productId));
    }

    if (warehouseId) {
      query += ` AND a.warehouse_id = ?`;
      params.push(Number(warehouseId));
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR a.reason LIKE ? OR a.created_by LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const total = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`;
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
   * Retrieve a single adjustment by ID with details
   */
  static getAdjustmentById(id) {
    const query = `
      SELECT 
        a.id,
        ('ADJ-' || printf('%04d', a.id)) as referenceId,
        a.product_id as productId,
        p.name as productName,
        p.sku as sku,
        p.category as productCategory,
        a.warehouse_id as warehouseId,
        w.name as warehouseName,
        w.code as warehouseCode,
        a.recorded_quantity as recordedQuantity,
        a.physical_quantity as physicalQuantity,
        a.difference as difference,
        a.reason,
        a.status,
        a.created_by as createdBy,
        a.created_at as createdAt
      FROM adjustments a
      JOIN products p ON a.product_id = p.id
      JOIN warehouses w ON a.warehouse_id = w.id
      WHERE a.id = ?
    `;

    const adjustment = db.prepare(query).get(Number(id));
    if (!adjustment) {
      const err = new Error(`Adjustment with ID ${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    // Retrieve associated ledger movement
    const ledgerEntry = db.prepare(`
      SELECT * FROM stock_ledger 
      WHERE reference_id = ? AND movement_type = 'ADJUSTMENT'
    `).get(adjustment.referenceId);

    return {
      ...adjustment,
      ledgerEntry: ledgerEntry || null
    };
  }
}

module.exports = AdjustmentService;
