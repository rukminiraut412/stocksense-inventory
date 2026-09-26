/**
 * StockSense API Client
 */
const API = {
  baseUrl: '',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.error || `HTTP ${response.status}: Request failed`);
    }

    return data;
  },

  // Inventory Lookups
  async getProducts() {
    return this.request('/api/inventory/products');
  },

  async getWarehouses() {
    return this.request('/api/inventory/warehouses');
  },

  // Adjustments API
  async getRecordedStock(productId, warehouseId) {
    return this.request(`/api/adjustments/recorded-stock?productId=${productId}&warehouseId=${warehouseId}`);
  },

  async createAdjustment(payload) {
    return this.request('/api/adjustments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getAdjustments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/adjustments${qs ? '?' + qs : ''}`);
  },

  async getAdjustmentById(id) {
    return this.request(`/api/adjustments/${id}`);
  },

  // Stock Ledger API
  async getLedgerEntries(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/ledger${qs ? '?' + qs : ''}`);
  },

  async getLedgerMetrics() {
    return this.request('/api/ledger/metrics');
  },

  // Low Stock & Status API
  async getStockStatus(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/stock-status${qs ? '?' + qs : ''}`);
  },

  async getLowStockAlerts() {
    return this.request('/api/stock-status/alerts');
  }
};
