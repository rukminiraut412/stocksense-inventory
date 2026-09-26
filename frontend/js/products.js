// Products UI Logic (Phase 2)

let productsState = [];
let currentProductDetailId = null;

async function loadProducts(searchQuery = '') {
  try {
    const url = searchQuery 
      ? `/api/products?search=${encodeURIComponent(searchQuery)}`
      : '/api/products';
    const products = await api.get(url);
    productsState = products;
    renderProducts(products);
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function renderProducts(products) {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No products found. Click "+ Add Product" to create one.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = products.map(product => {
    let stockBadgeClass = 'badge-green';
    let alertText = '';
    
    if (product.current_stock <= 0) {
      stockBadgeClass = 'badge-red';
      alertText = ' (Out)';
    } else if (product.current_stock <= (product.low_stock_threshold ?? 10)) {
      stockBadgeClass = 'badge-amber';
      alertText = ' (Low)';
    }

    return `
      <tr>
        <td><strong>#${product.id}</strong></td>
        <td><code>${escapeHtml(product.sku)}</code></td>
        <td><strong>${escapeHtml(product.name)}</strong></td>
        <td><span class="badge badge-blue">${escapeHtml(product.category)}</span></td>
        <td>${escapeHtml(product.unit_of_measure)}</td>
        <td>
          <span class="badge ${stockBadgeClass}">
            ${product.current_stock} ${escapeHtml(product.unit_of_measure)}${alertText}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" onclick="navigate('/products/${product.id}')">
              View
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openEditProductModal(${product.id})">
              Edit
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleNewProductSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const initialStockVal = form.initial_stock.value.trim();
  const thresholdVal = form.low_stock_threshold.value.trim();

  const payload = {
    name: form.name.value.trim(),
    sku: form.sku.value.trim(),
    category: form.category.value.trim(),
    unit_of_measure: form.unit_of_measure.value.trim(),
    initial_stock: initialStockVal === '' ? 0 : parseFloat(initialStockVal),
    low_stock_threshold: thresholdVal === '' ? 10 : parseFloat(thresholdVal)
  };

  if (isNaN(payload.initial_stock) || payload.initial_stock < 0) {
    showToast('Initial stock cannot be negative.', 'error');
    return;
  }
  if (isNaN(payload.low_stock_threshold) || payload.low_stock_threshold < 0) {
    showToast('Low stock threshold cannot be negative.', 'error');
    return;
  }

  try {
    const created = await api.post('/api/products', payload);
    showToast(`Product "${created.name}" created successfully!`, 'success');
    navigate('/products');
  } catch (err) {
    // Error is shown by api.js
  }
}

async function loadProductDetail(productId) {
  currentProductDetailId = productId;
  try {
    const product = await api.get(`/api/products/${productId}`);
    
    document.getElementById('product-detail-name').innerText = product.name;
    document.getElementById('product-detail-sku').innerText = `SKU: ${product.sku}`;
    document.getElementById('product-detail-stock').innerText = `${product.current_stock} ${product.unit_of_measure}`;
    document.getElementById('product-detail-category').innerText = product.category;
    document.getElementById('product-detail-uom').innerText = product.unit_of_measure;
    document.getElementById('product-detail-threshold').innerText = `${product.low_stock_threshold} ${product.unit_of_measure}`;
    document.getElementById('product-detail-initial').innerText = `${product.initial_stock} ${product.unit_of_measure}`;

    // Stock Status Badge
    let statusBadge = '<span class="badge badge-green">In Stock</span>';
    if (product.current_stock <= 0) {
      statusBadge = '<span class="badge badge-red">Out of Stock</span>';
    } else if (product.current_stock <= product.low_stock_threshold) {
      statusBadge = '<span class="badge badge-amber">Low Stock Warning</span>';
    }
    document.getElementById('product-detail-status').innerHTML = statusBadge;

    document.getElementById('product-detail-edit-btn').onclick = () => openEditProductModal(product.id);

    // Load Receipts History for this product
    loadProductReceiptsHistory(productId);
  } catch (err) {
    console.error('Failed to load product detail:', err);
  }
}

async function loadProductReceiptsHistory(productId) {
  const tbody = document.getElementById('product-detail-receipts-body');
  try {
    const receipts = await api.get(`/api/receipts?product_id=${productId}`);
    if (!receipts || receipts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No goods receipts recorded for this product yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = receipts.map(r => {
      const item = r.items.find(i => i.product_id === parseInt(productId));
      const qty = item ? item.quantity : '--';
      const statusBadge = r.status === 'VALIDATED' 
        ? '<span class="badge badge-green">VALIDATED</span>' 
        : '<span class="badge badge-amber">DRAFT</span>';

      return `
        <tr>
          <td><code>${escapeHtml(r.receipt_number)}</code></td>
          <td><strong>${escapeHtml(r.supplier)}</strong></td>
          <td>${statusBadge}</td>
          <td><span class="badge badge-blue">+${qty}</span></td>
          <td><small>${new Date(r.created_at).toLocaleDateString()}</small></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="navigate('/receipts/${r.id}')">
              View Receipt
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--badge-red-text); padding: 1.5rem;">
          Failed to load receipts history.
        </td>
      </tr>
    `;
  }
}

async function openEditProductModal(productId) {
  try {
    const product = productsState.find(p => p.id === productId) || await api.get(`/api/products/${productId}`);
    if (!product) return;

    const form = document.getElementById('edit-product-form');
    form.product_id.value = product.id;
    form.sku.value = product.sku;
    form.name.value = product.name;
    form.category.value = product.category;
    form.unit_of_measure.value = product.unit_of_measure;
    form.low_stock_threshold.value = product.low_stock_threshold ?? 10;

    document.getElementById('edit-product-modal').classList.add('open');
  } catch (err) {
    console.error('Failed to open edit modal:', err);
  }
}

function closeEditProductModal() {
  document.getElementById('edit-product-modal').classList.remove('open');
}

async function handleEditProductSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const productId = parseInt(form.product_id.value);

  const payload = {
    name: form.name.value.trim(),
    category: form.category.value.trim(),
    unit_of_measure: form.unit_of_measure.value.trim(),
    sku: form.sku.value.trim(),
    low_stock_threshold: parseFloat(form.low_stock_threshold.value.trim() || '10')
  };

  try {
    const updated = await api.put(`/api/products/${productId}`, payload);
    showToast(`Product "${updated.name}" updated successfully!`, 'success');
    closeEditProductModal();
    
    // Refresh current active view
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/products/')) {
      loadProductDetail(productId);
    } else {
      loadProducts();
    }
  } catch (err) {
    // Handled in api.js
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
}
