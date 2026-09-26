# StockSense – Intelligent Inventory Management System

StockSense is an enterprise-ready, role-based Intelligent Inventory Management System built for high-throughput warehouse logistics and supply chain visibility.

This repository is organized for an 8-hour hackathon with 4 developers collaborating on dedicated Git branches without merge conflicts or overlapping responsibilities.

---

## 👥 Team Ownership & Branching Strategy

| Member | Branch | Assigned Modules & Scope |
|---|---|---|
| **Team Leader** (Current) | `feature/team-leader` | Project foundation, Core Database & User Model, Authentication (Signup, Login, OTP Reset, Session check), Protected Routing, Dashboard KPIs & Aggregation Interfaces, Main Layout / Navigation, Integration & Contract Testing. |
| **Member 2** | `feature/member-2` | Products module, Receipts, Receipt stock increment. |
| **Member 3** | `feature/member-3` | Delivery Orders, Internal Transfers, Delivery stock decrement. |
| **Member 4** | `feature/member-4` | Inventory Adjustments, Stock Ledger / Move History, Low-stock alerts, Search & filter support. |

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python, SQLAlchemy, Pydantic v2
- **Database:** PostgreSQL-ready architecture (SQLite default for instant local zero-setup execution)
- **Security:** Bcrypt password hashing, JWT Bearer tokens, OTP reset foundation, strict role-based access control (RBAC).

---

## 🚀 Quick Start Guide

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment (if not already created)
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn app.main:app --reload --port 8000
```
- API Docs (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)
- Base API: [http://localhost:8000/api/v1](http://localhost:8000/api/v1)

### 2. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run Next.js development server
npm run dev
```
- Frontend Web App: [http://localhost:3000](http://localhost:3000)

### 3. Running Backend Tests

```bash
cd backend
.\venv\Scripts\python -m pytest tests -v
```

---

## 🔒 Authentication & Role-Based Access Control

The system supports two core operational roles:
1. `inventory_manager`: Full access to warehouse configuration, approvals, and metrics.
2. `warehouse_staff`: Dock and floor operations access.

Passwords are never stored in plain text and are securely hashed using `bcrypt`. Authentication state is maintained via standard JWT Bearer tokens.

---

## 📊 Dashboard KPI Cards

The dashboard delivers real-time visibility across five critical warehouse operations:
1. **Total Products in Stock** (Integration with Member 2)
2. **Low Stock / Out of Stock Alerts** (Integration with Member 4)
3. **Pending Receipts** (Integration with Member 2)
4. **Pending Deliveries** (Integration with Member 3)
5. **Internal Transfers Scheduled** (Integration with Member 3)

*Note: Safe default/zero values are returned when teammate modules are pending integration. No misleading mock data is presented.*

---

## 📚 Documentation

- API Contract & Schemas: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)
