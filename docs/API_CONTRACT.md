# StockSense – API Contract & Architecture Specification

**Project:** StockSense – Intelligent Inventory Management System  
**Version:** 1.0.0  
**Environment Base URL:** `http://localhost:8000/api/v1`  
**Team Leader Branch:** `feature/team-leader`

---

## 1. Team Ownership & Responsibilities

| Role / Member | Branch Name | Owned Modules & Endpoints |
|---|---|---|
| **Team Leader** (Current) | `feature/team-leader` | Project foundation, Database Core & User model, Authentication (`/auth/*`), Dashboard KPIs (`/dashboard/*`), Navigation Layout, Integration. |
| **Member 2** | `feature/member-2` | Products module (`/products/*`), Receipts (`/receipts/*`), Receipt stock increment. |
| **Member 3** | `feature/member-3` | Delivery Orders (`/deliveries/*`), Internal Transfers (`/transfers/*`), Delivery stock decrement. |
| **Member 4** | `feature/member-4` | Inventory Adjustments (`/adjustments/*`), Stock Ledger / Move History (`/ledger/*`), Low-Stock evaluation, Search/filter. |

---

## 2. Authentication Contract (Team Leader)

All authenticated endpoints require an `Authorization` header:
```http
Authorization: Bearer <access_token>
```

### 2.1 User Signup
- **Endpoint:** `POST /auth/signup`
- **Auth:** Public
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!",
  "role": "inventory_manager"
}
```
*Allowed roles:* `"inventory_manager"`, `"warehouse_staff"`

- **Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "role": "inventory_manager",
    "created_at": "2026-09-26T04:45:00Z"
  }
}
```
- **Error Codes:**
  - `400 Bad Request`: Email already registered.
  - `422 Unprocessable Entity`: Invalid email format or password < 6 characters.

---

### 2.2 User Login
- **Endpoint:** `POST /auth/login`
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!"
}
```
- **Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "role": "inventory_manager",
    "created_at": "2026-09-26T04:45:00Z"
  }
}
```
- **Error Codes:**
  - `401 Unauthorized`: Invalid email or password.

---

### 2.3 Current User Session Check
- **Endpoint:** `GET /auth/me`
- **Auth:** Bearer Token required
- **Response (200 OK):**
```json
{
  "id": 1,
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "role": "inventory_manager",
  "created_at": "2026-09-26T04:45:00Z"
}
```
- **Error Codes:**
  - `401 Unauthorized`: Expired or missing token.

---

### 2.4 User Logout
- **Endpoint:** `POST /auth/logout`
- **Auth:** Bearer Token required
- **Response (200 OK):**
```json
{
  "status": "success",
  "message": "User jane.doe@example.com successfully logged out."
}
```

---

### 2.5 Forgot Password (OTP Request)
- **Endpoint:** `POST /auth/forgot-password`
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "jane.doe@example.com"
}
```
- **Response (200 OK):**
```json
{
  "message": "Password reset OTP has been generated. Expires in 15 minutes.",
  "dev_otp": "729381"
}
```
*(Note: `dev_otp` is provided in development mode for easy hackathon demo without needing external email gateway).*

---

### 2.6 Reset Password (OTP Verification)
- **Endpoint:** `POST /auth/reset-password`
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "jane.doe@example.com",
  "otp": "729381",
  "new_password": "NewSecurePassword456!"
}
```
- **Response (200 OK):**
```json
{
  "message": "Password has been reset successfully. You can now login with your new password."
}
```
- **Error Codes:**
  - `400 Bad Request`: Invalid OTP or expired OTP.
  - `404 Not Found`: User not found.

---

## 3. Dashboard KPI Contract (Team Leader)

### 3.1 Get Dashboard KPIs
- **Endpoint:** `GET /dashboard/kpis`
- **Auth:** Bearer Token required
- **Query Parameters:**
  - `time_range` (optional, default `"all"`): `"today"` | `"week"` | `"month"` | `"all"`
  - `warehouse_id` (optional, integer): Filter KPIs by warehouse
- **Response (200 OK):**
```json
{
  "total_products_in_stock": {
    "key": "total_products_in_stock",
    "title": "Total Products in Stock",
    "value": 0,
    "unit": "units",
    "status": "awaiting_module",
    "module_owner": "Member 2",
    "module_name": "Products",
    "description": "Aggregated on-hand inventory count across all warehouse SKUs.",
    "is_connected": false
  },
  "low_stock_out_of_stock": {
    "key": "low_stock_out_of_stock",
    "title": "Low Stock / Out of Stock",
    "value": 0,
    "unit": "alerts",
    "status": "awaiting_module",
    "module_owner": "Member 4",
    "module_name": "Inventory Adjustments & Low-Stock",
    "description": "SKUs requiring immediate replenishment attention.",
    "is_connected": false
  },
  "pending_receipts": {
    "key": "pending_receipts",
    "title": "Pending Receipts",
    "value": 0,
    "unit": "orders",
    "status": "awaiting_module",
    "module_owner": "Member 2",
    "module_name": "Receipts",
    "description": "Incoming vendor deliveries waiting for dock processing.",
    "is_connected": false
  },
  "pending_deliveries": {
    "key": "pending_deliveries",
    "title": "Pending Deliveries",
    "value": 0,
    "unit": "shipments",
    "status": "awaiting_module",
    "module_owner": "Member 3",
    "module_name": "Delivery Orders",
    "description": "Outbound customer orders awaiting picking and dispatch.",
    "is_connected": false
  },
  "internal_transfers_scheduled": {
    "key": "internal_transfers_scheduled",
    "title": "Internal Transfers Scheduled",
    "value": 0,
    "unit": "transfers",
    "status": "awaiting_module",
    "module_owner": "Member 3",
    "module_name": "Internal Transfers",
    "description": "Relocations between warehouse bays or storage locations.",
    "is_connected": false
  },
  "system_status": "StockSense Team Leader Foundation Active",
  "timestamp": "2026-09-26T04:45:00Z",
  "summary_counts": {
    "total_products_in_stock": 0,
    "low_stock_out_of_stock": 0,
    "pending_receipts": 0,
    "pending_deliveries": 0,
    "internal_transfers_scheduled": 0
  }
}
```

> **Integration Note:**  
> When Member 2, Member 3, and Member 4 connect their database tables (`products`, `receipts`, `delivery_orders`, `internal_transfers`), `dashboard_service.py` automatically detects them and reflects real aggregated counts dynamically. Safe default values (0) are displayed when awaiting connection — NO fake data is presented.

---

## 4. Teammate Module Endpoints (Reserved Specifications)

The following routes are reserved and documented here so teammate branches can implement them without schema conflict:

### 4.1 Member 2: Products & Receipts
- **Target Router:** `backend/app/api/v1/endpoints/products.py` & `receipts.py`
- `GET /products` — List all products with current stock
- `POST /products` — Create new product
- `GET /products/{id}` — Get product details
- `GET /receipts` — List vendor receipts
- `POST /receipts` — Create incoming receipt
- `POST /receipts/{id}/receive` — Process receipt & increment stock

### 4.2 Member 3: Delivery Orders & Internal Transfers
- **Target Router:** `backend/app/api/v1/endpoints/deliveries.py` & `transfers.py`
- `GET /deliveries` — List outbound delivery orders
- `POST /deliveries` — Create delivery order
- `POST /deliveries/{id}/dispatch` — Process delivery & decrement stock
- `GET /transfers` — List internal warehouse transfers
- `POST /transfers` — Schedule internal transfer

### 4.3 Member 4: Adjustments, Ledger & Low-Stock
- **Target Router:** `backend/app/api/v1/endpoints/adjustments.py` & `ledger.py`
- `GET /adjustments` — List inventory adjustments
- `POST /adjustments` — Post stock count reconciliation
- `GET /ledger` — Move history & audit trail
- `GET /products/low-stock` — SKUs below minimum reorder thresholds

---

## 5. Shared Database Guidelines

1. **Base Class:** Import from `app.core.database`:
   ```python
   from app.core.database import Base
   ```
2. **User Relationship:** If your model references `user_id`:
   ```python
   user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
   ```
3. **Primary Keys:** Use autoincrementing integers or UUID strings.
4. **Environment Variables:** Use `DATABASE_URL` configured in `app.core.config.settings.DATABASE_URL`.
