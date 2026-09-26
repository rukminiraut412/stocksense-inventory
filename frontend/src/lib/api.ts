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
