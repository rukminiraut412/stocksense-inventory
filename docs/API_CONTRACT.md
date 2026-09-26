# StockSense – API Contract

This document specifies the REST API contract for the **StockSense – Inventory Management System**.

Base URL: `http://localhost:8000/api`  
Content-Type: `application/json`

---

## 1. Products Module (Team Member 1/2)

### 1.1 List Products
* **Endpoint:** `GET /products`
* **Query Parameters:**
  * `search` (string, optional): Case-insensitive search on SKU, product name, or category.
* **Success Response (200 OK):** Array of product objects.

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
* **Success Response (201 Created):** Full product object.

### 1.4 Get Product by ID
* **Endpoint:** `GET /products/{id}`
* **Success Response (200 OK):** Full product object.

### 1.5 Update Product
* **Endpoint:** `PUT /products/{id}`
* **Success Response (200 OK):** Full updated product object.

### 1.6 Delete Product
* **Endpoint:** `DELETE /products/{id}`
* **Success Response (200 OK):** `{"detail": "Product 1 deleted successfully."}`

---

## 2. Receipts Module (Team Member 1/2)

### 2.1 Create Receipt
* **Endpoint:** `POST /receipts`
* **Description:** Creates a goods receipt in `DRAFT` status. Stock is NOT increased.
* **Success Response (201 Created):** Full receipt object.

### 2.2 List Receipts
* **Endpoint:** `GET /receipts`
* **Success Response (200 OK):** Array of receipt objects.

### 2.3 Get Receipt Details
* **Endpoint:** `GET /receipts/{id}`
* **Success Response (200 OK):** Full receipt object including line items.

### 2.4 Validate Receipt
* **Endpoint:** `POST /receipts/{id}/validate`
* **Description:** Validates receipt: `current_stock = current_stock + received_quantity`. Idempotent.

---

## 3. Delivery Orders Module (Team Member 3)

### 3.1 Create Delivery Order
* **Endpoint:** `POST /deliveries`
* **Description:** Creates a delivery order in `DRAFT` status. Stock is NOT decremented.
* **Request Body:**
  ```json
  {
    "customer_name": "Acme Global Dynamics",
    "notes": "Urgent shipment",
    "lines": [
      {
        "product_id": 1,
        "quantity": 20.0
      }
    ]
  }
  ```
* **Validation Rules:**
  * `lines`: array, required, minimum 1 line.
  * `lines[].product_id`: integer, must reference an existing product.
  * `lines[].quantity`: number, strictly positive (`> 0`).
* **Success Response (201 Created):**
  ```json
  {
    "id": 1,
    "reference": "DEL-A1B2C3D4",
    "customer_name": "Acme Global Dynamics",
    "status": "DRAFT",
    "notes": "Urgent shipment",
    "created_at": "2026-09-26T04:20:00Z",
    "validated_at": null,
    "lines": [
      {
        "id": 1,
        "delivery_id": 1,
        "product_id": 1,
        "product_name": "Mechanical Keyboard",
        "product_sku": "KB-001",
        "quantity": 20.0
      }
    ]
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: If lines is empty, quantity is zero/negative.
  * `404 Not Found`: If a product ID does not exist.

### 3.2 List Delivery Orders
* **Endpoint:** `GET /deliveries`
* **Success Response (200 OK):** Array of delivery orders (newest first).

### 3.3 Get Delivery Order Details
* **Endpoint:** `GET /deliveries/{id}`
* **Success Response (200 OK):** Full delivery order object with line items.
* **Error Response (404 Not Found):** `{"detail": "Delivery 999 not found."}`

### 3.4 Advance Delivery Status
* **Endpoint:** `PATCH /deliveries/{id}/status`
* **Description:** Advances status through the workflow: `DRAFT -> PICKED -> PACKED`.
* **Optional Request Body:**
  ```json
  {
    "status": "PICKED"
  }
  ```
* **Validation Rules:**
  * Transition from `DRAFT` can only advance to `PICKED`.
  * Transition from `PICKED` can only advance to `PACKED`.
  * Once `PACKED`, status cannot be advanced via PATCH (must use `POST /deliveries/{id}/validate`).
  * Once `VALIDATED`, cannot be modified.
* **Success Response (200 OK):** Updated delivery order object.
* **Error Response (400 Bad Request):** If transition is invalid.

### 3.5 Validate Delivery Order
* **Endpoint:** `POST /deliveries/{id}/validate`
* **Description:** 
  * Validates the delivery order and transitions status from `PACKED` to `VALIDATED`.
  * Decrements product current stock: `current_stock = current_stock - delivered_quantity`.
  * Operates atomically within a database transaction.
  * Strict idempotency: Duplicate validation attempts are rejected with HTTP 400 and will **never** double-decrease stock.
  * Pre-flight stock check: Verifies all lines have sufficient stock before decrementing any stock.
* **Success Response (200 OK):**
  ```json
  {
    "id": 1,
    "reference": "DEL-A1B2C3D4",
    "customer_name": "Acme Global Dynamics",
    "status": "VALIDATED",
    "notes": "Urgent shipment",
    "created_at": "2026-09-26T04:20:00Z",
    "validated_at": "2026-09-26T04:22:15Z",
    "lines": [
      {
        "id": 1,
        "delivery_id": 1,
        "product_id": 1,
        "product_name": "Mechanical Keyboard",
        "product_sku": "KB-001",
        "quantity": 20.0
      }
    ]
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: If already validated ("Delivery is already VALIDATED. Stock has NOT been decremented again.").
  * `400 Bad Request`: If not in `PACKED` status ("Invalid status transition: Delivery must be in PACKED status to validate.").
  * `400 Bad Request`: If available stock is insufficient for any line item ("Insufficient stock for '...' Available: X, Requested: Y").

### 3.6 Add Line to Draft Delivery
* **Endpoint:** `POST /deliveries/{id}/lines`
* **Description:** Adds a product line to an existing delivery in `DRAFT` status.
* **Request Body:**
  ```json
  {
    "product_id": 1,
    "quantity": 5.0
  }
  ```
* **Success Response (201 Created):** Created delivery line object.
* **Error Response (400 Bad Request):** If delivery is not in `DRAFT` status.

---

## 4. Internal Transfers Module (Team Member 3)

### 4.1 List Warehouses / Locations
* **Endpoints:** `GET /transfers/warehouses`, `GET /warehouses`, `GET /locations`
* **Success Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "code": "WH-A",
      "name": "Warehouse A",
      "location": "Zone A"
    },
    {
      "id": 2,
      "code": "WH-B",
      "name": "Warehouse B",
      "location": "Zone B"
    }
  ]
  ```

### 4.2 Create Internal Transfer
* **Endpoint:** `POST /transfers`
* **Description:** Creates an internal transfer in `DRAFT` status. Stock is NOT moved.
* **Request Body:**
  ```json
  {
    "source_warehouse_id": 1,
    "destination_warehouse_id": 2,
    "product_id": 1,
    "quantity": 30.0,
    "notes": "Replenish Warehouse B"
  }
  ```
  *(Note: `source_location_id` and `destination_location_id` are also accepted as aliases.)*
* **Validation Rules:**
  * `source_warehouse_id` != `destination_warehouse_id`.
  * `quantity` must be strictly positive (`> 0`).
  * Source warehouse, destination warehouse, and product must all exist.
* **Success Response (201 Created):**
  ```json
  {
    "id": 1,
    "reference": "TRF-E5F6G7H8",
    "source_warehouse_id": 1,
    "source_warehouse_name": "Warehouse A",
    "destination_warehouse_id": 2,
    "destination_warehouse_name": "Warehouse B",
    "product_id": 1,
    "product_name": "Mechanical Keyboard",
    "product_sku": "KB-001",
    "quantity": 30.0,
    "status": "DRAFT",
    "notes": "Replenish Warehouse B",
    "created_at": "2026-09-26T04:25:00Z",
    "validated_at": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: If source equals destination, or quantity <= 0.
  * `404 Not Found`: If warehouse or product does not exist.

### 4.3 List Internal Transfers
* **Endpoint:** `GET /transfers`
* **Success Response (200 OK):** Array of transfer objects (newest first).

### 4.4 Get Internal Transfer Details
* **Endpoint:** `GET /transfers/{id}`
* **Success Response (200 OK):** Full transfer object.
* **Error Response (404 Not Found):** `{"detail": "Transfer 999 not found."}`

### 4.5 Validate Internal Transfer
* **Endpoint:** `POST /transfers/{id}/validate`
* **Description:**
  * Atomically transfers stock between source and destination warehouses:
    * `source_stock = source_stock - quantity`
    * `destination_stock = destination_stock + quantity`
  * **TOTAL COMPANY STOCK IS UNCHANGED** (`Product.current_stock` remains constant).
  * Strict idempotency: Duplicate validation attempts are rejected with HTTP 400 and will **never** cause duplicate stock movement.
  * Operates atomically within a database transaction with rollback protection.
* **Success Response (200 OK):**
  ```json
  {
    "id": 1,
    "reference": "TRF-E5F6G7H8",
    "source_warehouse_id": 1,
    "source_warehouse_name": "Warehouse A",
    "destination_warehouse_id": 2,
    "destination_warehouse_name": "Warehouse B",
    "product_id": 1,
    "product_name": "Mechanical Keyboard",
    "product_sku": "KB-001",
    "quantity": 30.0,
    "status": "VALIDATED",
    "notes": "Replenish Warehouse B",
    "created_at": "2026-09-26T04:25:00Z",
    "validated_at": "2026-09-26T04:26:30Z"
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: If already validated ("Transfer is already VALIDATED. Stock has NOT moved again.").
  * `400 Bad Request`: If source warehouse has insufficient stock ("Insufficient stock at 'Warehouse A'. Available: X, Requested: Y").
