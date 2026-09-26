// ============================================================
// transfers.js — Internal Transfers Module (Team Member 3)
// ============================================================

let transferWarehouseCache = [];
let transferProductCache2 = [];

// ---- Transfer List ----

async function loadTransfers() {
  const tbody = document.getElementById('transfers-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Loading...</td></tr>';
  try {
    const transfers = await api.get('/api/transfers');
    if (!transfers.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No transfers yet.</td></tr>';
      return;
    }
    tbody.innerHTML = transfers.map(t => `
      <tr style="cursor:pointer;" onclick="navigate('/transfers/${t.id}')">
        <td style="font-family:monospace;font-weight:600;">${t.reference}</td>
        <td>${t.product_name || t.product_id}</td>
        <td style="color:var(--text-muted)">${t.source_warehouse_name || t.source_warehouse_id}</td>
        <td style="color:var(--text-muted)">${t.destination_warehouse_name || t.destination_warehouse_id}</td>
        <td style="text-align:right;font-weight:600;">${t.quantity}</td>
        <td>${transferStatusBadge(t.status)}</td>
        <td><a style="color:var(--primary);" onclick="event.stopPropagation();navigate('/transfers/${t.id}')">View</a></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Failed to load transfers.</td></tr>';
  }
}

function transferStatusBadge(status) {
  const map = { DRAFT: 'badge-gray', VALIDATED: 'badge-green' };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

// ---- Create Transfer ----

async function initCreateTransferPage() {
  const form = document.getElementById('create-transfer-form');
  if (form) form.reset();
  try {
    [transferWarehouseCache, transferProductCache2] = await Promise.all([
      api.get('/api/transfers/warehouses'),
      api.get('/api/products'),
    ]);

    const whOpts = transferWarehouseCache.map(w =>
      `<option value="${w.id}">${w.name}</option>`
    ).join('');
    const pOpts = transferProductCache2.map(p =>
      `<option value="${p.id}">${p.name} (${p.sku}) — Total Stock: ${p.current_stock}</option>`
    ).join('');

    ['transfer-src-warehouse', 'transfer-dst-warehouse'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.innerHTML = `<option value="">Select warehouse…</option>${whOpts}`;
    });
    const pSel = document.getElementById('transfer-product');
    if (pSel) pSel.innerHTML = `<option value="">Select product…</option>${pOpts}`;
  } catch (e) { }
}

async function handleCreateTransferSubmit(e) {
  e.preventDefault();
  const src = parseInt(document.getElementById('transfer-src-warehouse')?.value);
  const dst = parseInt(document.getElementById('transfer-dst-warehouse')?.value);
  const productId = parseInt(document.getElementById('transfer-product')?.value);
  const quantity = parseFloat(document.getElementById('transfer-qty')?.value);
  const notes = document.getElementById('transfer-notes')?.value || '';

  if (!src || !dst || !productId || !quantity) {
    showToast('All fields are required.', 'error');
    return;
  }
  if (src === dst) {
    showToast('Source and destination warehouses must differ.', 'error');
    return;
  }
  if (quantity <= 0) {
    showToast('Quantity must be greater than 0.', 'error');
    return;
  }

  try {
    const transfer = await api.post('/api/transfers', {
      source_warehouse_id: src,
      destination_warehouse_id: dst,
      product_id: productId,
      quantity,
      notes,
    });
    showToast('Transfer created!', 'success');
    navigate(`/transfers/${transfer.id}`);
  } catch (e) { }
}

// ---- Transfer Detail ----

async function loadTransferDetail(id) {
  const container = document.getElementById('transfer-detail-container');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text-muted)">Loading…</p>';
  try {
    const t = await api.get(`/api/transfers/${id}`);
    renderTransferDetail(t);
  } catch (e) {
    container.innerHTML = '<p style="color:red">Transfer not found.</p>';
  }
}

function renderTransferDetail(t) {
  const container = document.getElementById('transfer-detail-container');
  const isValidated = t.status === 'VALIDATED';

  container.innerHTML = `
    <div class="card">
      <a class="back-link" onclick="navigate('/transfers')">&larr; Back to Transfers</a>
      <div class="view-header">
        <div>
          <h2 class="view-title" style="font-family:monospace">${t.reference}</h2>
          <div style="color:var(--text-muted);font-size:0.85rem;">
            Created: ${new Date(t.created_at).toLocaleString()}
            ${t.validated_at ? ' &bull; Validated: ' + new Date(t.validated_at).toLocaleString() : ''}
          </div>
          ${t.notes ? `<div style="color:var(--text-muted);font-size:0.85rem;">${t.notes}</div>` : ''}
        </div>
        <div class="view-actions">
          ${transferStatusBadge(t.status)}
          ${!isValidated ? `
            <button class="btn btn-primary" onclick="validateTransfer(${t.id})"
              style="background:#0d9488;">
              ✓ Validate Transfer
            </button>` : `<span style="color:#0d9488;font-weight:600;">✓ Stock moved atomically</span>`}
        </div>
      </div>

      <!-- Transfer visual -->
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;align-items:center;
                  background:#f8fafc;border:1px solid var(--border-color);border-radius:8px;
                  padding:1.5rem;margin-bottom:1.5rem;">
        <div style="text-align:center;">
          <div style="font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.25rem;">Source</div>
          <div style="font-weight:600;font-size:1.1rem;">${t.source_warehouse_name || 'ID: ' + t.source_warehouse_id}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.75rem;font-weight:700;color:var(--primary);">${t.quantity}</div>
          <div style="color:var(--text-muted);font-size:0.85rem;">${t.product_name || 'units'}</div>
          <div style="font-size:1.5rem;">&#8594;</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.25rem;">Destination</div>
          <div style="font-weight:600;font-size:1.1rem;">${t.destination_warehouse_name || 'ID: ' + t.destination_warehouse_id}</div>
        </div>
      </div>

      ${isValidated ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:0.75rem 1rem;
                  color:#166534;font-size:0.9rem;">
        &#10003; Transfer validated. Source decreased by ${t.quantity} units, destination increased by ${t.quantity} units.
        Total company stock is unchanged.
      </div>` : ''}
    </div>
  `;
}

async function validateTransfer(id) {
  if (!confirm('Validate transfer? Stock will be moved atomically. This cannot be undone.')) return;
  try {
    const t = await api.post(`/api/transfers/${id}/validate`, {});
    renderTransferDetail(t);
    showToast('Transfer validated. Stock moved.', 'success');
  } catch (e) { }
}
