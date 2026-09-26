/**
 * StockSense - Stock Ledger / Move History UI Logic
 */
const LedgerUI = {
  async init() {
    this.bindEvents();
    await this.populateFilters();
    await this.loadMetrics();
    await this.loadEntries();
  },

  bindEvents() {
    const typeFilter = document.getElementById('ledger-type-filter');
    const prodFilter = document.getElementById('ledger-product-filter');
    const whFilter = document.getElementById('ledger-warehouse-filter');
    const startFilter = document.getElementById('ledger-start-date');
    const endFilter = document.getElementById('ledger-end-date');
    const searchInput = document.getElementById('ledger-search');
    const resetBtn = document.getElementById('ledger-reset-btn');

    const triggerRefresh = () => this.loadEntries();

    if (typeFilter) typeFilter.addEventListener('change', triggerRefresh);
    if (prodFilter) prodFilter.addEventListener('change', triggerRefresh);
    if (whFilter) whFilter.addEventListener('change', triggerRefresh);
    if (startFilter) startFilter.addEventListener('change', triggerRefresh);
    if (endFilter) endFilter.addEventListener('change', triggerRefresh);

    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(triggerRefresh, 300);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (typeFilter) typeFilter.value = '';
        if (prodFilter) prodFilter.value = '';
        if (whFilter) whFilter.value = '';
        if (startFilter) startFilter.value = '';
        if (endFilter) endFilter.value = '';
        if (searchInput) searchInput.value = '';
        this.loadEntries();
      });
    }
  },

  async populateFilters() {
    try {
      const [prodRes, whRes] = await Promise.all([
        API.getProducts(),
        API.getWarehouses()
      ]);

      const prodSelect = document.getElementById('ledger-product-filter');
      const whSelect = document.getElementById('ledger-warehouse-filter');

      if (prodSelect) {
        prodSelect.innerHTML = '<option value="">All Products</option>' +
          prodRes.data.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('');
      }

      if (whSelect) {
        whSelect.innerHTML = '<option value="">All Warehouses</option>' +
          whRes.data.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
      }
    } catch (err) {
      console.error('Failed to load ledger filter dropdowns', err);
    }
  },

  async loadMetrics() {
    try {
      const res = await API.getLedgerMetrics();
      const m = res.metrics;

      const totalEl = document.getElementById('metric-total-moves');
      const adjEl = document.getElementById('metric-adj-moves');
      const recEl = document.getElementById('metric-rec-moves');
      const delEl = document.getElementById('metric-del-moves');
      const traEl = document.getElementById('metric-tra-moves');

      if (totalEl) totalEl.textContent = m.totalMoves;
      if (adjEl) adjEl.textContent = m.ADJUSTMENT;
      if (recEl) recEl.textContent = m.RECEIPT;
      if (delEl) delEl.textContent = m.DELIVERY;
      if (traEl) traEl.textContent = m.TRANSFER;
    } catch (err) {
      console.error('Failed to load ledger metrics', err);
    }
  },

  async loadEntries() {
    const tbody = document.getElementById('ledger-table-body');
    const totalCountEl = document.getElementById('ledger-total-count');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading movements...</td></tr>`;

    const typeFilter = document.getElementById('ledger-type-filter')?.value;
    const prodFilter = document.getElementById('ledger-product-filter')?.value;
    const whFilter = document.getElementById('ledger-warehouse-filter')?.value;
    const startDate = document.getElementById('ledger-start-date')?.value;
    const endDate = document.getElementById('ledger-end-date')?.value;
    const search = document.getElementById('ledger-search')?.value;

    try {
      const params = {};
      if (typeFilter) params.movementType = typeFilter;
      if (prodFilter) params.productId = prodFilter;
      if (whFilter) params.warehouseId = whFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search) params.search = search;

      const res = await API.getLedgerEntries(params);
      const entries = res.data;

      if (totalCountEl) totalCountEl.textContent = res.total;

      if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No stock movements match the specified criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = entries.map(item => {
        const sign = item.quantity > 0 ? '+' : '';
        const diffClass = item.quantity > 0 ? 'pos' : (item.quantity < 0 ? 'neg' : 'neutral');
        const timeFormatted = new Date(item.timestamp).toLocaleString();

        return `
          <tr>
            <td>
              <strong style="color: #cbd5e1; font-family: monospace;">#${item.id}</strong>
              <div style="font-size: 0.75rem; color: #a5b4fc;">${item.referenceId || 'N/A'}</div>
            </td>
            <td>
              <span class="badge badge-movement ${item.movementType}">
                ${item.movementType}
              </span>
            </td>
            <td>
              <div style="font-weight: 600;">${item.productName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${item.sku}</div>
            </td>
            <td>${item.warehouseName}</td>
            <td>
              <span class="calc-diff ${diffClass}">
                ${sign}${item.quantity}
              </span>
            </td>
            <td>
              <span style="color: var(--text-muted);">${item.previousStock}</span>
              <span style="color: var(--text-secondary); margin: 0 0.3rem;">➔</span>
              <strong style="color: #f9fafb;">${item.newStock}</strong>
            </td>
            <td style="color: var(--text-secondary); font-size: 0.82rem;">${item.user || 'System'}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;">${timeFormatted}</td>
          </tr>
        `;
      }).join('');

      await this.loadMetrics();
    } catch (err) {
      console.error('Error loading ledger entries', err);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to load ledger: ${err.message}</td></tr>`;
    }
  }
};
