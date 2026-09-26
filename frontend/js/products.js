// Products UI Logic

let productsState = [];

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
    const stockBadgeClass = product.current_stock > 0 ? 'badge-green' : 'badge-amber';
    return `
      <tr>
        <td><strong>#${product.id}</strong></td>
        <td><code>${escapeHtml(product.sku)}</code></td>
        <td><strong>${escapeHtml(product.name)}</strong></td>
        <td><span class="badge badge-blue">${escapeHtml(product.category)}</span></td>
        <td>${escapeHtml(product.unit_of_measure)}</td>
        <td>
          <span class="badge ${stockBadgeClass}">
            ${product.current_stock} ${escapeHtml(product.unit_of_measure)}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openEditProductModal(${product.id})">
            Edit
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddProductModal() {
  document.getElementById('add-product-form').reset();
  document.getElementById('add-product-modal').classList.add('open');
}

function closeAddProductModal() {
  document.getElementById('add-product-modal').classList.remove('open');
}

async function handleAddProductSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const initialStockVal = form.initial_stock.value.trim();

  const payload = {
    name: form.name.value.trim(),
    sku: form.sku.value.trim(),
    category: form.category.value.trim(),
    unit_of_measure: form.unit_of_measure.value.trim(),
    initial_stock: initialStockVal === '' ? 0 : parseFloat(initialStockVal)
  };

  if (isNaN(payload.initial_stock) || payload.initial_stock < 0) {
    showToast('Initial stock cannot be negative.', 'error');
    return;
  }

  try {
    const created = await api.post('/api/products', payload);
    showToast(`Product "${created.name}" created successfully!`, 'success');
    closeAddProductModal();
    loadProducts();
    if (typeof refreshReceiptProductOptions === 'function') {
      refreshReceiptProductOptions();
    }
  } catch (err) {
    // Error is shown by api.js
  }
}

function openEditProductModal(productId) {
  const product = productsState.find(p => p.id === productId);
  if (!product) return;

  const form = document.getElementById('edit-product-form');
  form.product_id.value = product.id;
  form.sku.value = product.sku;
  form.name.value = product.name;
  form.category.value = product.category;
  form.unit_of_measure.value = product.unit_of_measure;

  document.getElementById('edit-product-modal').classList.add('open');
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
    sku: form.sku.value.trim()
  };

  try {
    const updated = await api.put(`/api/products/${productId}`, payload);
    showToast(`Product "${updated.name}" updated successfully!`, 'success');
    closeEditProductModal();
    loadProducts();
  } catch (err) {
    // Handled in api.js
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}
