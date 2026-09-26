// ============================================================
// deliveries.js — Delivery Orders Module (Team Member 3)
// Follows the same api.js helper pattern as products.js / receipts.js
// ============================================================

// ---- Delivery List ----

async function loadDeliveries() {
  const tbody = document.getElementById('deliveries-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">Loading...</td></tr>';
  try {
    const deliveries = await api.get('/api/deliveries');
    if (!deliveries.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">No delivery orders yet.</td></tr>';
      return;
    }
    tbody.innerHTML = deliveries.map(d => `
      <tr style="cursor:pointer;" onclick="navigate('/deliveries/${d.id}')">
        <td style="font-family:monospace;font-weight:600;">${d.reference}</td>
        <td>${d.customer_name || '—'}</td>
        <td>${deliveryStatusBadge(d.status)}</td>
        <td>${d.lines ? d.lines.length : '—'}</td>
        <td style="font-size:0.85rem;color:var(--text-muted);">${new Date(d.created_at).toLocaleString()}</td>
        <td><a style="color:var(--primary);" onclick="event.stopPropagation();navigate('/deliveries/${d.id}')">View</a></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:red;">Failed to load deliveries.</td></tr>';
  }
}

function deliveryStatusBadge(status) {
  const map = {
    DRAFT:     'badge-gray',
    PICKED:    'badge-amber',
    PACKED:    'badge-blue',
    VALIDATED: 'badge-green',
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

// ---- Create Delivery ----

let deliveryLineCount = 0;
let deliveryProductCache = [];

async function initCreateDeliveryPage() {
  const form = document.getElementById('create-delivery-form');
  if (form) form.reset();
  deliveryLineCount = 0;
  const container = document.getElementById('delivery-lines-container');
  if (container) container.innerHTML = '';
  try {
    deliveryProductCache = await api.get('/api/products');
    addDeliveryLine(); // start with one line
  } catch (e) { }
}

function productOptions(selectedId) {
  return deliveryProductCache.map(p =>
    `<option value="${p.id}" ${p.id == selectedId ? 'selected' : ''}>
      ${p.name} (${p.sku}) — Stock: ${p.current_stock}
    </option>`
  ).join('');
}

function addDeliveryLine() {
  const idx = deliveryLineCount++;
  const container = document.getElementById('delivery-lines-container');
  const div = document.createElement('div');
  div.id = `delivery-line-${idx}`;
  div.style.cssText = 'display:grid;grid-template-columns:1fr 120px 40px;gap:0.5rem;margin-bottom:0.5rem;';
  div.innerHTML = `
    <select class="form-control" data-line-product="${idx}" required>
      <option value="">Select product…</option>
      ${productOptions(null)}
    </select>
    <input type="number" class="form-control" data-line-qty="${idx}"
           min="0.01" step="any" placeholder="Qty" required />
    <button type="button" class="btn btn-secondary" onclick="removeDeliveryLine(${idx})">✕</button>
  `;
  container.appendChild(div);
}

function removeDeliveryLine(idx) {
  document.getElementById(`delivery-line-${idx}`)?.remove();
}

async function handleCreateDeliverySubmit(e) {
  e.preventDefault();
  const lines = [];
  document.querySelectorAll('#delivery-lines-container > div').forEach(div => {
    const productSel = div.querySelector('[data-line-product]');
    const qtyInput   = div.querySelector('[data-line-qty]');
    if (productSel && qtyInput) {
      lines.push({
        product_id: parseInt(productSel.value),
        quantity:   parseFloat(qtyInput.value),
      });
    }
  });

  const customer_name = document.getElementById('delivery-customer-name')?.value || '';
  const notes         = document.getElementById('delivery-notes')?.value || '';

  if (!lines.length) { showToast('Add at least one product line.', 'error'); return; }

  try {
    const delivery = await api.post('/api/deliveries', { customer_name, notes, lines });
    showToast('Delivery created!', 'success');
    navigate(`/deliveries/${delivery.id}`);
  } catch (e) { /* error shown by api.js */ }
}

// ---- Delivery Detail ----

const DELIVERY_STATUS_FLOW = ['DRAFT', 'PICKED', 'PACKED', 'VALIDATED'];

async function loadDeliveryDetail(id) {
  const container = document.getElementById('delivery-detail-container');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text-muted)">Loading…</p>';
  try {
    const d = await api.get(`/api/deliveries/${id}`);
    renderDeliveryDetail(d);
  } catch (e) {
    container.innerHTML = '<p style="color:red">Delivery not found.</p>';
  }
}

function renderDeliveryDetail(d) {
  const container = document.getElementById('delivery-detail-container');
  const idx = DELIVERY_STATUS_FLOW.indexOf(d.status);
  const canPick   = d.status === 'DRAFT';
  const canPack   = d.status === 'PICKED';
  const canValidate = d.status === 'PACKED';
  const isValidated = d.status === 'VALIDATED';

  container.innerHTML = `
    <div class="card">
      <a class="back-link" onclick="navigate('/deliveries')">&larr; Back to Deliveries</a>
      <div class="view-header">
        <div>
          <h2 class="view-title" style="font-family:monospace">${d.reference}</h2>
          <div style="color:var(--text-muted);font-size:0.9rem;">Customer: ${d.customer_name || '—'}</div>
          ${d.notes ? `<div style="color:var(--text-muted);font-size:0.85rem;margin-top:0.25rem;">${d.notes}</div>` : ''}
        </div>
        <div class="view-actions">
          ${deliveryStatusBadge(d.status)}
          ${canPick || canPack ? `
            <button class="btn btn-secondary"
              onclick="advanceDeliveryStatus(${d.id})">
              &rarr; Mark as ${DELIVERY_STATUS_FLOW[idx + 1]}
            </button>` : ''}
          ${canValidate ? `
            <button class="btn btn-primary"
              onclick="validateDelivery(${d.id})"
              style="background:#16a34a;">
              ✓ Validate &amp; Ship
            </button>` : ''}
          ${isValidated ? `<span style="color:#16a34a;font-weight:600;">✓ Validated — Stock decremented</span>` : ''}
        </div>
      </div>

      <!-- Status timeline -->
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1.5rem;">
        ${DELIVERY_STATUS_FLOW.map((s, i) => `
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span class="badge ${i <= idx ? 'badge-green' : 'badge-gray'}">${s}</span>
            ${i < DELIVERY_STATUS_FLOW.length - 1 ? '<span style="color:#94a3b8;">→</span>' : ''}
          </div>`
        ).join('')}
      </div>

      <!-- Meta -->
      <div class="meta-grid" style="margin-bottom:1.5rem;">
        <div class="meta-card">
          <div class="meta-label">Created</div>
          <div class="meta-value" style="font-size:0.9rem;">${new Date(d.created_at).toLocaleString()}</div>
        </div>
        ${d.validated_at ? `
        <div class="meta-card">
          <div class="meta-label">Validated</div>
          <div class="meta-value" style="font-size:0.9rem;">${new Date(d.validated_at).toLocaleString()}</div>
        </div>` : ''}
      </div>

      <!-- Lines -->
      <h3 class="section-subtitle">Product Lines</h3>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th style="width:140px;">SKU</th>
              <th>Product</th>
              <th style="width:140px;text-align:right;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${(d.lines || []).map(l => `
              <tr>
                <td style="font-family:monospace;">${l.product_sku || '—'}</td>
                <td>${l.product_name || l.product_id}</td>
                <td style="text-align:right;font-weight:600;">${l.quantity}</td>
              </tr>
            `).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">No lines.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function advanceDeliveryStatus(id) {
  try {
    const d = await api.patch(`/api/deliveries/${id}/status`);
    renderDeliveryDetail(d);
    showToast(`Status updated to ${d.status}`, 'success');
  } catch (e) { }
}

async function validateDelivery(id) {
  if (!confirm('Validate this delivery? Stock will be permanently decremented.')) return;
  try {
    const d = await api.post(`/api/deliveries/${id}/validate`, {});
    renderDeliveryDetail(d);
    showToast('Delivery validated. Stock decremented.', 'success');
  } catch (e) { }
}
