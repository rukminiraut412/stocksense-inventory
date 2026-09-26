# StockSense API Contract

This document specifies the REST API contract for the **Products** and **Receipts** modules of **StockSense – Inventory Management System** (Team Member 2), fully reconciled and integrated with the Team Leader Foundation.

Base URL: `http://localhost:8000/api/v1` (with `/api` compatibility alias)

---

## 1. Products Module

### 1.1 List Products
* **Endpoint:** `GET /products`
* **Query Parameters:**
  * `search` (string, optional): Case-insensitive search on SKU, product name, or category.
* **Success Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "name": "Standard Laptop Stand",
      "sku": "STAND-001",
      "category": "Accessories",
      "unit_of_measure": "pcs",
      "current_stock": 25.0,
      "initial_stock": 25.0,
      "low_stock_threshold": 10.0,
      "created_at": "2026-09-26T04:15:30Z",
      "updated_at": "2026-09-26T04:15:30Z"
    }
  ]
  ```

### 1.2 Dedicated Product Search
* **Endpoint:** `GET /products/search`
* **Query Parameters:**
  * `q` (string, required, min_length=1): Search query matching SKU or Name substring.
* **Success Response (200 OK):** Same schema as List Products.

### 1.3 Create Product
* **Endpoint:** `POST /products`
* **Request Body:**
  ```json
  {
    "name": "Mechanical Keyboard",
    "sku": "KB-001",
    "category": "Peripherals",
    "unit_of_measure": "pcs",
    "initial_stock": 10.0,
    "low_stock_threshold": 10.0
  }
  ```
* **Validation Rules:**
  * `name`: string, required, non-empty.
  * `sku`: string, required, unique across all products.
  * `category`: string, required, non-empty.
  * `unit_of_measure`: string, required, non-empty.
  * `initial_stock`: number, optional, default `0.0`, must be `>= 0`.
  * `low_stock_threshold`: number, optional, default `10.0`, must be `>= 0`.
* **Success Response (201 Created):** Full product object.
* **Error Response (400 Bad Request):**
  ```json
  {
    "detail": "Product with SKU 'KB-001' already exists."
  }
  ```

### 1.4 Get Product by ID
* **Endpoint:** `GET /products/{id}`
* **Success Response (200 OK):** Full product object.
* **Error Response (404 Not Found):**
  ```json
  {
    "detail": "Product with ID 999 not found."
  }
  ```

### 1.5 Update Product
* **Endpoint:** `PUT /products/{id}`
* **Request Body:**
  ```json
  {
    "name": "Updated Keyboard Name",
    "category": "Gaming Peripherals",
    "unit_of_measure": "pcs",
    "sku": "KB-001-RGB"
  }
  ```
* **Success Response (200 OK):** Full updated product object.
* **Error Response (400 Bad Request):** If new SKU collides with another product.

### 1.6 Delete Product
* **Endpoint:** `DELETE /products/{id}`
* **Success Response (200 OK):**
  ```json
  {
    "detail": "Product 1 deleted successfully."
  }
  ```

---

## 2. Receipts Module

### 2.1 Create Receipt
* **Endpoint:** `POST /receipts`
* **Description:** Creates a goods receipt in `DRAFT` status. **Stock is NOT increased at this point.**
* **Request Body:**
  ```json
  {
    "supplier": "Acme Global Dynamics",
    "items": [
      {
        "product_id": 1,
        "quantity": 50.0
      }
    ]
  }
  ```
* **Validation Rules:**
  * `supplier`: string, required, non-empty.
  * `items`: array, required, minimum 1 item.
  * `items[].product_id`: integer, must reference an existing product.
  * `items[].quantity`: number, strictly positive (`> 0`).
* **Success Response (201 Created):**
  ```json
  {
    "id": 1,
    "receipt_number": "REC-20260926-0001",
    "supplier": "Acme Global Dynamics",
    "status": "DRAFT",
    "created_at": "2026-09-26T04:20:00Z",
    "validated_at": null,
    "items_count": 1,
    "items": [
      {
        "id": 1,
        "product_id": 1,
        "product_name": "Mechanical Keyboard",
        "product_sku": "KB-001",
        "quantity": 50.0
      }
    ]
  }
  ```
* **Error Response (400 Bad Request):**
  ```json
  {
    "detail": "Product with ID 999 does not exist."
  }
  ```

### 2.2 List Receipts
* **Endpoint:** `GET /receipts`
* **Query Parameters:**
  * `product_id` (integer, optional): Filter receipts containing a specific product ID.
* **Success Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "receipt_number": "REC-20260926-0001",
      "supplier": "Acme Global Dynamics",
      "status": "DRAFT",
      "created_at": "2026-09-26T04:20:00Z",
      "validated_at": null,
      "items_count": 1,
      "items": [ ... ]
    }
  ]
  ```

### 2.3 Get Receipt Details
* **Endpoint:** `GET /receipts/{id}`
* **Success Response (200 OK):** Full receipt object including line items and product details.
* **Error Response (404 Not Found):**
  ```json
  {
    "detail": "Receipt with ID 999 not found."
  }
  ```

### 2.4 Validate Receipt
* **Endpoint:** `POST /receipts/{id}/validate` (and alias `POST /receipts/{id}/receive`)
* **Description:** 
  * Validates the receipt and transitions status from `DRAFT` to `VALIDATED`.
  * Increases product current stock: `current_stock = current_stock + received_quantity`.
  * Operates atomically within a database transaction.
  * Strict idempotency: Duplicate validation attempts are rejected with HTTP 400 and will **never** double-increase stock.
* **Success Response (200 OK):**
  ```json
  {
    "id": 1,
    "receipt_number": "REC-20260926-0001",
    "supplier": "Acme Global Dynamics",
    "status": "VALIDATED",
    "created_at": "2026-09-26T04:20:00Z",
    "validated_at": "2026-09-26T04:20:22Z",
    "items_count": 1,
    "items": [
      {
        "id": 1,
        "product_id": 1,
        "product_name": "Mechanical Keyboard",
        "product_sku": "KB-001",
        "quantity": 50.0
      }
    ]
  }
  ```
* **Duplicate Validation Error (400 Bad Request):**
  ```json
  {
    "detail": "Receipt REC-20260926-0001 is already validated. Duplicate validation is not allowed."
  }
  ```

