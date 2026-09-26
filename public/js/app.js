/**
 * StockSense Core App Script
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' 
        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' 
        : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
      }
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Tab Switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${tabId}`);
      if (targetPane) targetPane.classList.add('active');

      // Refresh data on tab switch
      if (tabId === 'adjustments' && typeof AdjustmentsUI !== 'undefined') {
        AdjustmentsUI.loadAdjustmentList();
      } else if (tabId === 'ledger' && typeof LedgerUI !== 'undefined') {
        LedgerUI.loadEntries();
      } else if (tabId === 'lowstock' && typeof LowStockUI !== 'undefined') {
        LowStockUI.loadData();
      }
    });
  });

  // Initialize UI modules
  try {
    if (typeof AdjustmentsUI !== 'undefined') await AdjustmentsUI.init();
    if (typeof LedgerUI !== 'undefined') await LedgerUI.init();
    if (typeof LowStockUI !== 'undefined') await LowStockUI.init();
  } catch (err) {
    console.error('Initialization error:', err);
  }
});
