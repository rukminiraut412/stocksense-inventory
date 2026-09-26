/**
 * StockSense - Adjustments Module UI Logic
 */
const AdjustmentsUI = {
  currentRecordedQuantity: 0,

  async init() {
    this.bindEvents();
    await this.populateDropdowns();
    await this.loadAdjustmentList();
  },

  bindEvents() {
    const productSelect = document.getElementById('adj-product-select');
    const warehouseSelect = document.getElementById('adj-warehouse-select');
    const physicalInput = document.getElementById('adj-physical-input');
    const form = document.getElementById('adjustment-form');
    const searchInput = document.getElementById('adj-search-input');

    if (productSelect && warehouseSelect) {
      productSelect.addEventListener('change', () => this.handleSelectionChange());
      warehouseSelect.addEventListener('change', () => this.handleSelectionChange());
    }

    if (physicalInput) {
      physicalInput.addEventListener('input', () => this.updateLiveCalculation());
    }

    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    if (searchInput) {
      let debounceTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          this.loadAdjustmentList(e.target.value);
        }, 300);
      });
    }

    // Modal close
    const modalClose = document.getElementById('adj-modal-close');
    const modalOverlay = document.getElementById('adj-details-modal');
    const closeModal = () => {
      modalOverlay.classList.remove('open');
      if (window.location.pathname.startsWith('/adjustments/')) {
        window.history.pushState(null, '', '/adjustments');
      }
    };

    if (modalClose && modalOverlay) {
      modalClose.addEventListener('click', closeModal);
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    if (physicalInput) {
      physicalInput.addEventListener('focus', () => {
        if (window.location.pathname !== '/adjustments/new' && !window.location.pathname.startsWith('/adjustments/')) {
          window.history.pushState(null, '', '/adjustments/new');
        }
      });
    }
  },

  async populateDropdowns() {
    try {
      const [prodRes, whRes] = await Promise.all([
        API.getProducts(),
        API.getWarehouses()
      ]);

      const productSelect = document.getElementById('adj-product-select');
      const warehouseSelect = document.getElementById('adj-warehouse-select');

      if (productSelect) {
        productSelect.innerHTML = '<option value="">-- Choose Product --</option>' + 
          prodRes.data.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('');
      }

      if (warehouseSelect) {
        warehouseSelect.innerHTML = '<option value="">-- Choose Warehouse --</option>' + 
          whRes.data.map(w => `<option value="${w.id}">${w.name} [${w.code}]</option>`).join('');
      }

      // Default select first items for convenience
      if (prodRes.data.length > 0 && whRes.data.length > 0) {
        productSelect.value = prodRes.data[0].id;
        warehouseSelect.value = whRes.data[0].id;
        await this.handleSelectionChange();
      }
    } catch (err) {
      console.error('Failed to populate dropdowns', err);
      showToast(err.message, 'error');
    }
  },

  async handleSelectionChange() {
    const productId = document.getElementById('adj-product-select').value;
    const warehouseId = document.getElementById('adj-warehouse-select').value;
    const recordedEl = document.getElementById('adj-recorded-display');

    if (!productId || !warehouseId) {
      this.currentRecordedQuantity = 0;
      if (recordedEl) recordedEl.textContent = '-';
      this.updateLiveCalculation();
      return;
    }

    try {
      const res = await API.getRecordedStock(productId, warehouseId);
      this.currentRecordedQuantity = res.data.recordedQuantity;
      if (recordedEl) {
        recordedEl.textContent = `${this.currentRecordedQuantity} units`;
      }
      this.updateLiveCalculation();
    } catch (err) {
      console.error('Failed to fetch recorded stock', err);
      showToast(err.message, 'error');
    }
  },

  updateLiveCalculation() {
    const physicalInput = document.getElementById('adj-physical-input');
    const diffEl = document.getElementById('adj-calc-diff');
    const newStockEl = document.getElementById('adj-calc-new');

    const rawVal = physicalInput.value.trim();
    if (rawVal === '') {
      diffEl.textContent = '0';
      diffEl.className = 'calc-diff neutral';
      newStockEl.textContent = '-';
      return;
    }

    const physicalVal = parseInt(rawVal, 10);
    if (isNaN(physicalVal)) {
      diffEl.textContent = 'Invalid';
      diffEl.className = 'calc-diff neg';
      newStockEl.textContent = '-';
      return;
    }

    if (physicalVal < 0) {
      diffEl.textContent = 'Cannot be negative';
      diffEl.className = 'calc-diff neg';
      newStockEl.textContent = 'Invalid';
      return;
    }

    // Formula: difference = physical_quantity - recorded_quantity
    const diff = physicalVal - this.currentRecordedQuantity;
    newStockEl.textContent = `${physicalVal} units`;

    if (diff > 0) {
      diffEl.textContent = `+${diff}`;
      diffEl.className = 'calc-diff pos';
    } else if (diff < 0) {
      diffEl.textContent = `${diff}`;
      diffEl.className = 'calc-diff neg';
    } else {
      diffEl.textContent = `0 (No Change)`;
      diffEl.className = 'calc-diff neutral';
    }
  },

  async handleSubmit(e) {
    e.preventDefault();
    const productId = document.getElementById('adj-product-select').value;
    const warehouseId = document.getElementById('adj-warehouse-select').value;
    const physicalInput = document.getElementById('adj-physical-input');
    const reasonInput = document.getElementById('adj-reason-input');
    const userInput = document.getElementById('adj-user-input');

    if (!productId || !warehouseId) {
      showToast('Please select both product and warehouse.', 'error');
      return;
    }

    const physicalQty = parseInt(physicalInput.value, 10);
    if (isNaN(physicalQty) || physicalQty < 0) {
      showToast('Physical count must be a non-negative integer (>= 0).', 'error');
      return;
    }

    const payload = {
      productId: Number(productId),
      warehouseId: Number(warehouseId),
      physicalQuantity: physicalQty,
      reason: reasonInput.value.trim() || 'Physical Count Reconciliation',
      user: userInput ? (userInput.value.trim() || 'Inventory Team Member 4') : 'Inventory Team Member 4'
    };

    const submitBtn = document.getElementById('adj-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Applying Adjustment...';

    try {
      const res = await API.createAdjustment(payload);
      showToast(`Adjustment ${res.data.referenceId} applied! New stock: ${res.data.newStock}`, 'success');
      
      // Reset physical count and refresh displays
      physicalInput.value = '';
      reasonInput.value = '';
      await this.handleSelectionChange();
      await this.loadAdjustmentList();

      // Trigger updates across other tabs if active
      if (typeof LedgerUI !== 'undefined') {
        LedgerUI.loadEntries();
      }
      if (typeof LowStockUI !== 'undefined') {
        LowStockUI.loadData();
      }
    } catch (err) {
      console.error('Error applying adjustment:', err);
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Apply Adjustment
      `;
    }
  },

  async loadAdjustmentList(searchQuery = '') {
    const tbody = document.getElementById('adj-table-body');
    const countEl = document.getElementById('adj-total-count');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading adjustments...</td></tr>`;

    try {
      const res = await API.getAdjustments({ search: searchQuery });
      const adjustments = res.data;

      if (countEl) countEl.textContent = res.total;

      if (adjustments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No adjustments found.</td></tr>`;
        return;
      }

      tbody.innerHTML = adjustments.map(adj => {
        const diffClass = adj.difference > 0 ? 'pos' : (adj.difference < 0 ? 'neg' : 'neutral');
        const diffSign = adj.difference > 0 ? '+' : '';
        const dateStr = new Date(adj.createdAt).toLocaleString();

        return `
          <tr>
            <td><strong style="color: #a5b4fc;">${adj.referenceId}</strong></td>
            <td>
              <div style="font-weight: 600;">${adj.productName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${adj.sku}</div>
            </td>
            <td>${adj.warehouseName}</td>
            <td style="color: var(--text-secondary);">${adj.recordedQuantity}</td>
            <td><strong>${adj.physicalQuantity}</strong></td>
            <td>
              <span class="calc-diff ${diffClass}">${diffSign}${adj.difference}</span>
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="AdjustmentsUI.showDetails(${adj.id})">
                Details
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading adjustments', err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to load adjustments: ${err.message}</td></tr>`;
    }
  },

  async showDetails(id, updateUrl = true) {
    const modal = document.getElementById('adj-details-modal');
    if (!modal) return;

    try {
      const res = await API.getAdjustmentById(id);
      const adj = res.data;

      if (updateUrl) {
        window.history.pushState(null, '', `/adjustments/${id}`);
      }

      document.getElementById('modal-ref').textContent = adj.referenceId;
      document.getElementById('modal-product').textContent = `${adj.productName} (${adj.sku})`;
      document.getElementById('modal-warehouse').textContent = `${adj.warehouseName} [${adj.warehouseCode}]`;
      document.getElementById('modal-recorded').textContent = `${adj.recordedQuantity} units`;
      document.getElementById('modal-physical').textContent = `${adj.physicalQuantity} units`;
      
      const diffEl = document.getElementById('modal-diff');
      const diffSign = adj.difference > 0 ? '+' : '';
      diffEl.textContent = `${diffSign}${adj.difference} units`;
      diffEl.className = 'calc-diff ' + (adj.difference > 0 ? 'pos' : (adj.difference < 0 ? 'neg' : 'neutral'));

      document.getElementById('modal-reason').textContent = adj.reason || 'N/A';
      document.getElementById('modal-user').textContent = adj.createdBy;
      document.getElementById('modal-time').textContent = new Date(adj.createdAt).toLocaleString();
      document.getElementById('modal-status').innerHTML = `<span class="badge badge-in-stock">${adj.status}</span>`;

      // Traceable ledger linkage
      const ledgerWrap = document.getElementById('modal-ledger-info');
      if (adj.ledgerEntry) {
        ledgerWrap.innerHTML = `
          <div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: var(--radius-md); padding: 0.85rem; margin-top: 0.5rem;">
            <div style="font-size: 0.8rem; color: #a5b4fc; font-weight: 600; margin-bottom: 0.3rem;">Traceable Ledger Transaction # ${adj.ledgerEntry.id}</div>
            <div style="font-size: 0.82rem; color: var(--text-secondary);">
              Type: <strong style="color: white;">${adj.ledgerEntry.movement_type}</strong> | 
              Stock Delta: <strong style="color: white;">${adj.ledgerEntry.quantity > 0 ? '+' : ''}${adj.ledgerEntry.quantity}</strong> | 
              Previous Stock: <strong style="color: white;">${adj.ledgerEntry.previous_stock}</strong> → 
              New Stock: <strong style="color: white;">${adj.ledgerEntry.new_stock}</strong>
            </div>
          </div>
        `;
      } else {
        ledgerWrap.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">No linked ledger record found.</span>`;
      }

      modal.classList.add('open');
    } catch (err) {
      console.error('Error fetching adjustment details', err);
      showToast(err.message, 'error');
    }
  }
};
