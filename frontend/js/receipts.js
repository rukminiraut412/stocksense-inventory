// Receipts UI Logic (Phase 2)

let receiptsState = [];
let availableProducts = [];

async function loadReceipts() {
  try {
    const receipts = await api.get('/api/receipts');
    receiptsState = receipts;
    renderReceipts(receipts);
  } catch (err) {
    console.error('Failed to load receipts:', err);
  }
}

function renderReceipts(receipts) {
  const tbody = document.getElementById('receipts-table-body');
  if (!tbody) return;

  if (receipts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No receipts recorded yet. Click "+ Create Receipt" to receive inventory from a supplier.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = receipts.map(r => {
    const isDraft = r.status === 'DRAFT';
    const statusBadge = isDraft 
      ? `<span class="badge badge-amber">DRAFT</span>` 
      : `<span class="badge badge-green">VALIDATED</span>`;

    const dateFormatted = new Date(r.created_at).toLocaleString();

    const validateBtn = isDraft
      ? `<button class="btn btn-success btn-sm" onclick="handleValidateReceipt(${r.id})">✓ Validate</button>`
      : `<button class="btn btn-secondary btn-sm" disabled title="Already validated">Validated</button>`;

    return `
      <tr>
        <td><strong>#${r.id}</strong></td>
        <td><code>${escapeHtml(r.receipt_number)}</code></td>
        <td><strong>${escapeHtml(r.supplier)}</strong></td>
        <td><span class="badge badge-blue">${r.items_count || (r.items ? r.items.length : 0)} items</span></td>
        <td>${statusBadge}</td>
        <td><small>${dateFormatted}</small></td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" onclick="navigate('/receipts/${r.id}')">
              View
            </button>
            ${validateBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function refreshReceiptProducts() {
  try {
    availableProducts = await api.get('/api/products');
  } catch (err) {
    console.error('Failed to load products for receipt line items:', err);
  }
}

async function initCreateReceiptPage() {
  await refreshReceiptProducts();
  const form = document.getElementById('create-receipt-page-form');
  if (form) form.reset();

  const container = document.getElementById('receipt-page-items-container');
  if (container) {
    container.innerHTML = '';
    if (availableProducts.length === 0) {
      showToast('Please create at least one product before creating a receipt.', 'error');
      container.innerHTML = '<div style="color: var(--text-muted); padding: 1rem;">No products available. Please add products first.</div>';
    } else {
      addReceiptRowInPage();
    }
  }
}

function addReceiptRowInPage() {
  const container = document.getElementById('receipt-page-items-container');
  if (!container) return;

  const rowId = `item-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const optionsHtml = availableProducts.map(p => 
    `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.sku)}) - Stock: ${p.current_stock} ${escapeHtml(p.unit_of_measure)}</option>`
  ).join('');

  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display: grid; grid-template-columns: 1fr 140px 40px; gap: 0.5rem; align-items: center;';
  row.innerHTML = `
    <select class="form-control receipt-product-select" required>
      <option value="" disabled selected>Select product to receive...</option>
      ${optionsHtml}
    </select>
    <input type="number" class="form-control receipt-product-qty" placeholder="Quantity" min="0.01" step="any" required>
    <button type="button" class="btn btn-secondary btn-sm" style="color: #dc2626; padding: 0.5rem;" onclick="removeReceiptRowInPage('${rowId}')" title="Remove line">&times;</button>
  `;

  container.appendChild(row);
}

function removeReceiptRowInPage(rowId) {
  const container = document.getElementById('receipt-page-items-container');
  if (container.children.length <= 1) {
    showToast('A receipt must contain at least one line item.', 'error');
    return;
  }
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

async function handleNewReceiptSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const supplier = form.supplier.value.trim();

  if (!supplier) {
    showToast('Supplier name is required.', 'error');
    return;
  }

  const rows = document.querySelectorAll('#receipt-page-items-container > div');
  const items = [];

  for (const row of rows) {
    const select = row.querySelector('.receipt-product-select');
    const qtyInput = row.querySelector('.receipt-product-qty');
    if (!select || !qtyInput) continue;

    const productId = parseInt(select.value);
    const quantity = parseFloat(qtyInput.value);

    if (!productId || isNaN(productId)) {
      showToast('Please select a product for all lines.', 'error');
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      showToast('Quantity must be strictly greater than 0.', 'error');
      return;
    }

    items.push({ product_id: productId, quantity });
  }

  if (items.length === 0) {
    showToast('Please add at least one line item.', 'error');
    return;
  }

  try {
    const created = await api.post('/api/receipts', {
      supplier,
      items
    });
    showToast(`Receipt ${created.receipt_number} created in DRAFT status!`, 'success');
    navigate(`/receipts/${created.id}`);
  } catch (err) {
    // Error shown by api.js
  }
}

async function loadReceiptDetail(receiptId) {
  try {
    const receipt = await api.get(`/api/receipts/${receiptId}`);
    
    document.getElementById('receipt-view-number').innerText = `Receipt: ${receipt.receipt_number}`;
    document.getElementById('receipt-view-supplier').innerText = `Supplier: ${receipt.supplier}`;
    
    const isDraft = receipt.status === 'DRAFT';
    const statusBadge = isDraft 
      ? `<span class="badge badge-amber">DRAFT</span>` 
      : `<span class="badge badge-green">VALIDATED</span>`;

    document.getElementById('receipt-view-status').innerHTML = statusBadge;
    document.getElementById('receipt-view-items-count').innerText = `${receipt.items.length} line items`;
    document.getElementById('receipt-view-created').innerText = new Date(receipt.created_at).toLocaleString();
    document.getElementById('receipt-view-validated').innerText = receipt.validated_at 
      ? new Date(receipt.validated_at).toLocaleString() 
      : 'Pending validation';

    // Action button
    const actionsContainer = document.getElementById('receipt-view-actions');
    if (isDraft) {
      actionsContainer.innerHTML = `
        <button class="btn btn-success" onclick="handleValidateReceipt(${receipt.id})">
          ✓ Validate Receipt & Increase Stock
        </button>
      `;
    } else {
      actionsContainer.innerHTML = `
        <span class="badge badge-green" style="padding: 0.5rem 0.85rem; font-size: 0.85rem;">
          ✓ Fully Validated & Stock Increased
        </span>
      `;
    }

    // Line items table
    const itemsBody = document.getElementById('receipt-view-items-body');
    itemsBody.innerHTML = receipt.items.map(item => `
      <tr>
        <td><code>${escapeHtml(item.product_sku)}</code></td>
        <td>
          <a style="cursor: pointer; color: var(--primary); text-decoration: underline;" onclick="navigate('/products/${item.product_id}')">
            ${escapeHtml(item.product_name)}
          </a>
        </td>
        <td><span class="badge badge-blue">+${item.quantity}</span></td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed to load receipt details:', err);
  }
}

async function handleValidateReceipt(receiptId) {
  const confirmed = confirm(
    "Are you sure you want to validate this receipt?\n\nThis will permanently update and increase product stock levels in the warehouse."
  );
  if (!confirmed) return;

  try {
    const validated = await api.post(`/api/receipts/${receiptId}/validate`);
    showToast(`Receipt ${validated.receipt_number} validated successfully! Stock levels updated.`, 'success');
    
    // If currently on receipt detail page, reload details
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/receipts/')) {
      loadReceiptDetail(receiptId);
    } else {
      loadReceipts();
    }
  } catch (err) {
    // Error shown by api.js
  }
}
