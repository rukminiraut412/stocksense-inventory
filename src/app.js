const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { initializeDatabase } = require('./config/database');

const adjustmentRoutes = require('./modules/adjustments/adjustment.routes');
const ledgerRoutes = require('./modules/ledger/ledger.routes');
const lowStockRoutes = require('./modules/lowstock/lowstock.routes');
const inventoryRoutes = require('./modules/common/inventory.routes');

// Initialize database schema and baseline data
initializeDatabase();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/stock-status', lowStockRoutes);
app.use('/api/inventory', inventoryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'StockSense Inventory Management',
    modules: ['Inventory Adjustments', 'Stock Ledger', 'Low Stock Logic'],
    timestamp: new Date().toISOString()
  });
});

// Fallback 404 handler for API
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[App Error]', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
