"""Live end-to-end server verification script testing both Next.js and FastAPI."""
import time
import httpx
import pytest

FRONTEND_URL = "http://127.0.0.1:3000"
BACKEND_URL = "http://127.0.0.1:8000"


def test_frontend_routes_accessible():
    routes = [
        "/",
        "/login",
        "/signup",
        "/forgot-password",
        "/dashboard",
        "/products",
        "/operations/receipts",
        "/operations/deliveries",
        "/operations/transfers",
        "/operations/adjustments",
        "/operations/move-history",
        "/settings/warehouse",
        "/profile",
    ]
    with httpx.Client(timeout=10.0) as client:
        for r in routes:
            res = client.get(f"{FRONTEND_URL}{r}")
            assert res.status_code == 200, f"Route {r} failed with status {res.status_code}"


def test_live_backend_auth_and_kpis():
    unique_email = f"live.tester.{int(time.time()*1000)}@stocksense.io"
    with httpx.Client(timeout=10.0) as client:
        # 1. Health check
        res = client.get(f"{BACKEND_URL}/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        # 2. Signup
        signup_res = client.post(
            f"{BACKEND_URL}/api/v1/auth/signup",
            json={
                "name": "Live Tester",
                "email": unique_email,
                "password": "Password123!",
                "role": "inventory_manager",
            },
        )
        assert signup_res.status_code == 201
        data = signup_res.json()
        token = data["access_token"]
        assert token is not None

        # 3. Current user
        me_res = client.get(
            f"{BACKEND_URL}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        assert me_res.json()["email"] == unique_email

        # 4. Dashboard KPIs
        kpi_res = client.get(
            f"{BACKEND_URL}/api/v1/dashboard/kpis",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert kpi_res.status_code == 200
        kpi_data = kpi_res.json()
        assert kpi_data["total_products_in_stock"]["value"] == 0
        assert kpi_data["low_stock_out_of_stock"]["value"] == 0
        assert kpi_data["pending_receipts"]["value"] == 0
        assert kpi_data["pending_deliveries"]["value"] == 0
        assert kpi_data["internal_transfers_scheduled"]["value"] == 0

        # 5. Forgot Password & Reset
        forgot_res = client.post(
            f"{BACKEND_URL}/api/v1/auth/forgot-password",
            json={"email": unique_email},
        )
        assert forgot_res.status_code == 200
        dev_otp = forgot_res.json().get("dev_otp")
        assert dev_otp is not None

        reset_res = client.post(
            f"{BACKEND_URL}/api/v1/auth/reset-password",
            json={
                "email": unique_email,
                "otp": dev_otp,
                "new_password": "NewLivePassword456!",
            },
        )
        assert reset_res.status_code == 200

        # 6. Login with new password
        login_res = client.post(
            f"{BACKEND_URL}/api/v1/auth/login",
            json={
                "email": unique_email,
                "password": "NewLivePassword456!",
            },
        )
        assert login_res.status_code == 200
        assert "access_token" in login_res.json()
