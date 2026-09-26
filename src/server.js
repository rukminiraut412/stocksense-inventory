const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  StockSense Inventory Management System running!`);
  console.log(`  Port: http://localhost:${PORT}`);
  console.log(`  Modules: Adjustments | Ledger | Low-Stock Alerts`);
  console.log(`====================================================`);
});
