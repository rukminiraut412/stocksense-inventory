/**
 * StockSense - Low Stock & Dashboard Stock Status UI
 */
const LowStockUI = {
  currentFilter: 'ALL',

  async init() {
    this.bindEvents();
    await this.loadData();
  },

  bindEvents() {
    const filterButtons = document.querySelectorAll('.status-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.status;
        this.loadData();
      });
    });

    const searchInput = document.getElementById('lowstock-search');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this.loadData(), 300);
      });
    }
  },

  async loadData() {
    const tbody = document.getElementById('lowstock-table-body');
    const search = document.getElementById('lowstock-search')?.value;

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Evaluating stock levels...</td></tr>`;
    }

    try {
      const params = {};
      if (this.currentFilter && this.currentFilter !== 'ALL') {
        params.status = this.currentFilter;
      }
      if (search) {
        params.search = search;
      }

      const res = await API.getStockStatus(params);
      const { summary, data } = res;

      // Update metric cards
      const inStockEl = document.getElementById('metric-instock');
      const lowStockEl = document.getElementById('metric-lowstock');
      const outOfStockEl = document.getElementById('metric-outofstock');
      const reorderEl = document.getElementById('metric-reorder');

      if (inStockEl) inStockEl.textContent = summary.inStockCount;
      if (lowStockEl) lowStockEl.textContent = summary.lowStockCount;
      if (outOfStockEl) outOfStockEl.textContent = summary.outOfStockCount;
      if (reorderEl) reorderEl.textContent = summary.criticalReorderCount;

      if (!tbody) return;

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No stock records found for filter: ${this.currentFilter}</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(item => {
        let badgeClass = 'badge-in-stock';
        let barColor = 'var(--success)';
        let pct = Math.min(100, Math.round((item.currentStock / (item.threshold * 2 || 20)) * 100));

        if (item.status === 'OUT_OF_STOCK') {
          badgeClass = 'badge-out-of-stock';
          barColor = 'var(--danger)';
          pct = 0;
        } else if (item.status === 'LOW_STOCK') {
          badgeClass = 'badge-low-stock';
          barColor = 'var(--warning)';
          pct = Math.min(100, Math.round((item.currentStock / item.threshold) * 50));
        }

        return `
          <tr>
            <td>
              <div style="font-weight: 600;">${item.productName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${item.sku}</div>
            </td>
            <td>
              <span style="font-size: 0.8rem; background: rgba(255, 255, 255, 0.05); padding: 0.2rem 0.5rem; border-radius: 4px;">
                ${item.category || 'General'}
              </span>
            </td>
            <td>${item.warehouseName}</td>
            <td>
              <strong style="font-size: 1rem; color: ${item.currentStock === 0 ? 'var(--danger)' : '#f9fafb'};">
                ${item.currentStock}
              </strong>
              <div class="stock-bar-wrap">
                <div class="stock-bar-fill" style="width: ${pct}%; background: ${barColor};"></div>
              </div>
            </td>
            <td>
              <span style="color: var(--text-secondary); font-weight: 500;">
                ${item.threshold} units
              </span>
            </td>
            <td>
              <span class="badge ${badgeClass}">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
                ${item.statusLabel}
              </span>
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="LowStockUI.quickAdjust(${item.productId}, ${item.warehouseId})">
                Adjust
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading stock status', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to load stock status: ${err.message}</td></tr>`;
      }
    }
  },

  quickAdjust(productId, warehouseId) {
    // Switch to Adjustments Tab
    const tabBtn = document.querySelector('.tab-btn[data-tab="adjustments"]');
    if (tabBtn) tabBtn.click();

    // Select Product & Warehouse
    setTimeout(() => {
      const prodSelect = document.getElementById('adj-product-select');
      const whSelect = document.getElementById('adj-warehouse-select');
      if (prodSelect) prodSelect.value = productId;
      if (whSelect) whSelect.value = warehouseId;
      if (typeof AdjustmentsUI !== 'undefined') {
        AdjustmentsUI.handleSelectionChange();
      }
      const physicalInput = document.getElementById('adj-physical-input');
      if (physicalInput) physicalInput.focus();
    }, 100);
  }
};
