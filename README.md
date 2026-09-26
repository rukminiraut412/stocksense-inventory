# StockSense – Inventory Management System

A hackathon inventory management system built with Flask + SQLAlchemy + SQLite.

## Team Structure

| Member | Branch | Modules |
|---|---|---|
| Team Member 3 | `feature/delivery-transfer` | Delivery Orders, Internal Transfers |

## Getting Started

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5000**

## Modules (Team Member 3)

- **Delivery Orders** — DRAFT → PICKED → PACKED → VALIDATED workflow. Stock decrements only on validation.
- **Internal Transfers** — Atomic stock move between locations. Total company stock stays unchanged.

## API Documentation

See [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)

## Testing

```bash
# With server running:
python test_stocksense.py
```

All 28 integration tests pass.
