const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "inventory_manager" | "warehouse_staff";
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface KPICardData {
  key: string;
  title: string;
  value: number;
  unit: string;
  status: string;
  module_owner: string;
  module_name: string;
  description: string;
  is_connected: boolean;
}

export interface DashboardKPIResponse {
  total_products_in_stock: KPICardData;
  low_stock_out_of_stock: KPICardData;
  pending_receipts: KPICardData;
  pending_deliveries: KPICardData;
  internal_transfers_scheduled: KPICardData;
  system_status: string;
  timestamp: string;
  summary_counts: Record<string, number>;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || data.message || "An unexpected error occurred.";
    throw new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
  }

  return data as T;
}

export const authAPI = {
  signup: (payload: { name: string; email: string; password: string; role: string }) =>
    apiRequest<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMe: (token: string) =>
    apiRequest<User>("/auth/me", { method: "GET" }, token),

  logout: (token: string) =>
    apiRequest<{ status: string; message: string }>("/auth/logout", { method: "POST" }, token),

  forgotPassword: (email: string) =>
    apiRequest<{ message: string; dev_otp?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { email: string; otp: string; new_password: string }) =>
    apiRequest<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const dashboardAPI = {
  getKPIs: (token: string) =>
    apiRequest<DashboardKPIResponse>("/dashboard/kpis", { method: "GET" }, token),
};

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit_of_measure: string;
  current_stock: number;
  initial_stock: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  sku: string;
  category: string;
  unit_of_measure: string;
  initial_stock?: number;
  low_stock_threshold?: number;
}

export interface ProductUpdate {
  name?: string;
  category?: string;
  unit_of_measure?: string;
  sku?: string;
  low_stock_threshold?: number;
}

export interface ReceiptItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
}

export interface Receipt {
  id: number;
  receipt_number: string;
  supplier: string;
  status: string;
  created_at: string;
  validated_at?: string | null;
  items: ReceiptItem[];
  items_count: number;
}

export interface ReceiptCreate {
  supplier: string;
  items: { product_id: number; quantity: number }[];
}

export const productsAPI = {
  list: (search?: string, token?: string | null) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return apiRequest<Product[]>(`/products${query}`, { method: "GET" }, token);
  },
  get: (id: number, token?: string | null) =>
    apiRequest<Product>(`/products/${id}`, { method: "GET" }, token),
  create: (payload: ProductCreate, token?: string | null) =>
    apiRequest<Product>(
      "/products",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    ),
  update: (id: number, payload: ProductUpdate, token?: string | null) =>
    apiRequest<Product>(
      `/products/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
      token
    ),
  delete: (id: number, token?: string | null) =>
    apiRequest<{ detail: string }>(`/products/${id}`, { method: "DELETE" }, token),
};

export const receiptsAPI = {
  list: (productId?: number, token?: string | null) => {
    const query = productId ? `?product_id=${productId}` : "";
    return apiRequest<Receipt[]>(`/receipts${query}`, { method: "GET" }, token);
  },
  get: (id: number, token?: string | null) =>
    apiRequest<Receipt>(`/receipts/${id}`, { method: "GET" }, token),
  create: (payload: ReceiptCreate, token?: string | null) =>
    apiRequest<Receipt>(
      "/receipts",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    ),
  validate: (id: number, token?: string | null) =>
    apiRequest<Receipt>(`/receipts/${id}/validate`, { method: "POST" }, token),
};

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  location?: string | null;
}

export interface RecordedStock {
  product_id: number;
  product_name: string;
  product_sku: string;
  warehouse_id: number;
  warehouse_name: string;
  recorded_quantity: number;
}

export interface Adjustment {
  id: number;
  reference_id: string;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  warehouse_id: number;
  warehouse_name?: string;
  recorded_quantity: number;
  previous_quantity: number;
  physical_quantity: number;
  counted_quantity: number;
  difference: number;
  reason?: string;
  status: string;
  created_by?: string;
  created_at?: string;
}

export interface AdjustmentCreate {
  product_id: number;
  warehouse_id: number;
  counted_quantity: number;
  reason?: string;
  user?: string;
}

export const warehousesAPI = {
  list: (token?: string | null) =>
    apiRequest<Warehouse[]>("/warehouses", { method: "GET" }, token),
};

export const adjustmentsAPI = {
  getRecordedStock: (productId: number, warehouseId: number, token?: string | null) =>
    apiRequest<RecordedStock>(
      `/adjustments/recorded-stock?productId=${productId}&warehouseId=${warehouseId}`,
      { method: "GET" },
      token
    ),
  create: (payload: AdjustmentCreate, token?: string | null) =>
    apiRequest<Adjustment>(
      "/adjustments",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    ),
  list: (productId?: number, warehouseId?: number, token?: string | null) => {
    let q = "";
    const params = new URLSearchParams();
    if (productId) params.append("productId", String(productId));
    if (warehouseId) params.append("warehouseId", String(warehouseId));
    if (params.toString()) q = `?${params.toString()}`;
    return apiRequest<Adjustment[]>(`/adjustments${q}`, { method: "GET" }, token);
  },
};

