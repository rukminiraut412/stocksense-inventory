# StockSense – API Contract

> Base URL: `http://localhost:5000/api`
> All request and response bodies are `application/json`.

---

## Delivery Orders

### Create Delivery
**POST** `/deliveries`

Request body:
```json
{
  "customer_name": "Acme Corp",
  "notes": "Urgent",
  "lines": [
    { "product_id": 1, "quantity": 20 }
  ]
}
```
Response `201`:
```json
{
  "id": 1,
  "reference": "DEL-XXXXXXXX",
  "customer_name": "Acme Corp",
  "status": "DRAFT",
  "lines": [...]
}
```
Errors:
- `400` – no lines, invalid quantity, insufficient stock (at validate time)
- `404` – product not found

---

### List Deliveries
**GET** `/deliveries`

Response `200`: Array of delivery objects (without lines).

---

### Get Delivery Detail
**GET** `/deliveries/<id>`

Response `200`: Delivery object with `lines` array.

---

### Advance Delivery Status
**PATCH** `/deliveries/<id>/status`

Advances: `DRAFT → PICKED → PACKED` (not to VALIDATED – use validate endpoint).

Response `200`: Updated delivery.

Errors:
- `400` – already VALIDATED or already at PACKED (use validate)

---

### Validate Delivery
**POST** `/deliveries/<id>/validate`

Business logic:
- Status must NOT be VALIDATED (prevents double-validation).
- Checks all product lines for sufficient stock.
- Decrements `Product.current_stock` for each line.
- Sets status to `VALIDATED`.

Response `200`:
```json
{
  "message": "Delivery validated successfully. Stock decremented.",
  "delivery": { ... }
}
```
Errors:
- `400` – already validated, no lines
- `400` – insufficient stock (with details of which product)
- `404` – product not found

---

### Add Line to Draft Delivery
**POST** `/deliveries/<id>/lines`

Request body:
```json
{ "product_id": 2, "quantity": 5 }
```
Response `201`: Created delivery line.

---

## Internal Transfers

### Create Transfer
**POST** `/transfers`

Request body:
```json
{
  "source_location_id": 1,
  "destination_location_id": 2,
  "product_id": 1,
  "quantity": 30,
  "notes": "Weekly replenishment"
}
```
Response `201`:
```json
{
  "id": 1,
  "reference": "TRF-XXXXXXXX",
  "status": "DRAFT",
  "source_location_name": "Warehouse A",
  "destination_location_name": "Warehouse B",
  ...
}
```
Errors:
- `400` – missing fields, non-positive quantity, same source/destination
- `404` – location or product not found

---

### List Transfers
**GET** `/transfers`

Response `200`: Array of transfer objects.

---

### Get Transfer Detail
**GET** `/transfers/<id>`

Response `200`: Transfer object.

---

### Validate Transfer
**POST** `/transfers/<id>/validate`

Business logic:
- Status must be `DRAFT` (prevents double-validation).
- Checks `LocationStock` at source location.
- **Atomically**: decrements source `LocationStock.quantity`, increments destination `LocationStock.quantity`.
- `Product.current_stock` is NOT modified (total company stock unchanged).
- Sets status to `VALIDATED`.

Response `200`:
```json
{
  "message": "Transfer validated successfully. Stock moved atomically.",
  "transfer": { ... },
  "source_stock_after": 70,
  "destination_stock_after": 50
}
```
Errors:
- `400` – already validated, same source/destination
- `400` – insufficient stock at source (with available vs requested)
- `404` – location or product no longer exists

---

## Helper Endpoints (Products & Locations)

These stubs exist to support seeding and cross-team integration.
The Products team will own and expand the product endpoints.

### Products
- `GET /products` – list all products
- `POST /products` – `{ "name", "sku", "current_stock" }` → create product
- `GET /products/<id>` – get product

### Locations
- `GET /locations` – list all locations with stock entries
- `POST /locations` – `{ "name", "warehouse" }` → create location
- `POST /locations/<id>/stock` – `{ "product_id", "quantity" }` → set location stock (seed)
