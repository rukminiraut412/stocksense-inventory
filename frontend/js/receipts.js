// Receipts UI Logic

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
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="openReceiptDetailsModal(${r.id})">
              Details
            </button>
            ${validateBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function refreshReceiptProductOptions() {
  try {
    availableProducts = await api.get('/api/products');
  } catch (err) {
    console.error('Failed to refresh products for receipts:', err);
  }
}

async function openCreateReceiptModal() {
  await refreshReceiptProductOptions();
  if (availableProducts.length === 0) {
    showToast('Please create at least one product before creating a receipt.', 'error');
    return;
  }

  const form = document.getElementById('create-receipt-form');
  form.reset();

  const container = document.getElementById('receipt-items-container');
  container.innerHTML = '';
  addReceiptItemRow(); // Add first line item

  document.getElementById('create-receipt-modal').classList.add('open');
}

function closeCreateReceiptModal() {
  document.getElementById('create-receipt-modal').classList.remove('open');
}

function addReceiptItemRow() {
  const container = document.getElementById('receipt-items-container');
  const rowId = `item-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const optionsHtml = availableProducts.map(p => 
    `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.sku)}) - Current: ${p.current_stock} ${escapeHtml(p.unit_of_measure)}</option>`
  ).join('');

  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display: grid; grid-template-columns: 1fr 120px 40px; gap: 0.5rem; align-items: center;';
  row.innerHTML = `
    <select class="form-control receipt-product-select" required>
      <option value="" disabled selected>Select product...</option>
      ${optionsHtml}
    </select>
    <input type="number" class="form-control receipt-product-qty" placeholder="Qty" min="0.01" step="any" required>
    <button type="button" class="btn btn-secondary btn-sm" style="color: #dc2626; padding: 0.5rem;" onclick="removeReceiptItemRow('${rowId}')" title="Remove row">&times;</button>
  `;

  container.appendChild(row);
}

function removeReceiptItemRow(rowId) {
  const container = document.getElementById('receipt-items-container');
  if (container.children.length <= 1) {
    showToast('A receipt must have at least one product line item.', 'error');
    return;
  }
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

async function handleCreateReceiptSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const supplier = form.supplier.value.trim();

  if (!supplier) {
    showToast('Supplier name is required.', 'error');
    return;
  }

  const rows = document.querySelectorAll('#receipt-items-container > div');
  const items = [];

  for (const row of rows) {
    const select = row.querySelector('.receipt-product-select');
    const qtyInput = row.querySelector('.receipt-product-qty');

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
    showToast(`Receipt ${created.receipt_number} created in DRAFT status.`, 'success');
    closeCreateReceiptModal();
    loadReceipts();
  } catch (err) {
    // Error shown by api.js
  }
}

async function openReceiptDetailsModal(receiptId) {
  try {
    const receipt = await api.get(`/api/receipts/${receiptId}`);
    
    document.getElementById('receipt-details-title').innerText = `Receipt Details: ${receipt.receipt_number}`;
    
    const isDraft = receipt.status === 'DRAFT';
    const statusBadge = isDraft 
      ? `<span class="badge badge-amber">DRAFT</span>` 
      : `<span class="badge badge-green">VALIDATED</span>`;

    const validatedText = receipt.validated_at 
      ? `<br><strong>Validated At:</strong> ${new Date(receipt.validated_at).toLocaleString()}` 
      : '';

    document.getElementById('receipt-details-meta').innerHTML = `
      <div><strong>Receipt Number:</strong> <code>${escapeHtml(receipt.receipt_number)}</code></div>
      <div><strong>Supplier:</strong> ${escapeHtml(receipt.supplier)}</div>
      <div><strong>Status:</strong> ${statusBadge}</div>
      <div><strong>Created At:</strong> ${new Date(receipt.created_at).toLocaleString()}${validatedText}</div>
    `;

    const itemsBody = document.getElementById('receipt-details-items-body');
    itemsBody.innerHTML = receipt.items.map(item => `
      <tr>
        <td><code>${escapeHtml(item.product_sku)}</code></td>
        <td><strong>${escapeHtml(item.product_name)}</strong></td>
        <td><span class="badge badge-blue">+${item.quantity}</span></td>
      </tr>
    `).join('');

    const footer = document.getElementById('receipt-details-footer');
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" onclick="closeReceiptDetailsModal()">Close</button>
      ${isDraft ? `<button type="button" class="btn btn-success" onclick="handleValidateReceipt(${receipt.id}, true)">✓ Validate Receipt</button>` : ''}
    `;

    document.getElementById('receipt-details-modal').classList.add('open');
  } catch (err) {
    console.error('Failed to load receipt details:', err);
  }
}

function closeReceiptDetailsModal() {
  document.getElementById('receipt-details-modal').classList.remove('open');
}

async function handleValidateReceipt(receiptId, fromModal = false) {
  const confirmed = confirm(
    "Are you sure you want to validate this receipt?\n\nThis will permanently update and increase product stock levels in the warehouse."
  );
  if (!confirmed) return;

  try {
    const validated = await api.post(`/api/receipts/${receiptId}/validate`);
    showToast(`Receipt ${validated.receipt_number} validated successfully! Stock levels updated.`, 'success');
    if (fromModal) {
      closeReceiptDetailsModal();
    }
    loadReceipts();
    // Also refresh products so user sees immediate updated stock
    loadProducts();
  } catch (err) {
    // Error shown by api.js
  }
}
