/**
 * StockSense Core App Script with SPA Routing
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

function switchTab(tabId, pushHistory = true) {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(b => b.classList.remove('active'));
  tabPanes.forEach(p => p.classList.remove('active'));

  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');

  const targetPane = document.getElementById(`tab-${tabId}`);
  if (targetPane) targetPane.classList.add('active');

  if (pushHistory) {
    let url = '/';
    if (tabId === 'adjustments') url = '/adjustments';
    else if (tabId === 'ledger') url = '/move-history';
    else if (tabId === 'lowstock') url = '/low-stock';
    window.history.pushState(null, '', url);
  }

  // Refresh tab data
  if (tabId === 'adjustments' && typeof AdjustmentsUI !== 'undefined') {
    AdjustmentsUI.loadAdjustmentList();
  } else if (tabId === 'ledger' && typeof LedgerUI !== 'undefined') {
    LedgerUI.loadEntries();
  } else if (tabId === 'lowstock' && typeof LowStockUI !== 'undefined') {
    LowStockUI.loadData();
  }
}

function handleRoute(path = window.location.pathname) {
  if (path === '/adjustments/new') {
    switchTab('adjustments', false);
    setTimeout(() => {
      const physicalInput = document.getElementById('adj-physical-input');
      if (physicalInput) {
        physicalInput.focus();
        physicalInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  } else if (path.startsWith('/adjustments/')) {
    const parts = path.split('/');
    const id = parts[2];
    switchTab('adjustments', false);
    if (id && !isNaN(id)) {
      setTimeout(() => {
        if (typeof AdjustmentsUI !== 'undefined') AdjustmentsUI.showDetails(id, false);
      }, 250);
    }
  } else if (path === '/move-history') {
    switchTab('ledger', false);
  } else if (path === '/adjustments') {
    switchTab('adjustments', false);
  } else if (path === '/low-stock') {
    switchTab('lowstock', false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Tab click listeners
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab, true);
    });
  });

  // Browser back/forward navigation
  window.addEventListener('popstate', () => {
    handleRoute(window.location.pathname);
  });

  // Initialize UI modules
  try {
    if (typeof AdjustmentsUI !== 'undefined') await AdjustmentsUI.init();
    if (typeof LedgerUI !== 'undefined') await LedgerUI.init();
    if (typeof LowStockUI !== 'undefined') await LowStockUI.init();

    // Handle initial URL route
    handleRoute(window.location.pathname);
  } catch (err) {
    console.error('Initialization error:', err);
  }
});
