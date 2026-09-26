import pytest
from app.models.user import User
from app.core.security import verify_password


def test_signup_valid_user(client, db_session):
    """Test 1: Signup with valid data."""
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Jane Doe",
            "email": "jane.doe@example.com",
            "password": "SecurePassword123!",
            "role": "inventory_manager",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "jane.doe@example.com"
    assert data["user"]["name"] == "Jane Doe"
    assert data["user"]["role"] == "inventory_manager"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]
    
    # Verify in DB: Password must be hashed, never plain text
    user = db_session.query(User).filter(User.email == "jane.doe@example.com").first()
    assert user is not None
    assert user.password_hash != "SecurePassword123!"
    assert verify_password("SecurePassword123!", user.password_hash) is True


def test_signup_duplicate_email(client):
    """Test 2: Signup with duplicate email."""
    # First registration
    client.post(
        "/api/v1/auth/signup",
        json={
            "name": "John Doe",
            "email": "duplicate@example.com",
            "password": "Password123!",
            "role": "warehouse_staff",
        },
    )
    
    # Second registration with same email
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Another John",
            "email": "duplicate@example.com",
            "password": "AnotherPassword456!",
            "role": "inventory_manager",
        },
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_signup_invalid_email(client):
    """Test 3: Signup with invalid email format."""
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Invalid Email",
            "email": "not-an-email",
            "password": "Password123!",
            "role": "inventory_manager",
        },
    )
    assert response.status_code == 422  # Pydantic validation error


def test_login_correct_credentials(client):
    """Test 4: Login with correct credentials."""
    client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Valid User",
            "email": "login.test@example.com",
            "password": "CorrectPassword123!",
            "role": "inventory_manager",
        },
    )
    
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "login.test@example.com",
            "password": "CorrectPassword123!",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "login.test@example.com"


def test_login_incorrect_password(client):
    """Test 5: Login with incorrect password."""
    client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Test User",
            "email": "wrongpwd@example.com",
            "password": "CorrectPassword123!",
            "role": "warehouse_staff",
        },
    )
    
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "wrongpwd@example.com",
            "password": "WrongPassword999!",
        },
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_access_protected_without_auth(client):
    """Test 6 & 7: Access protected route without authentication."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_access_protected_with_auth(client):
    """Test 6: Access protected route after login."""
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Protected User",
            "email": "protected@example.com",
            "password": "Password123!",
            "role": "inventory_manager",
        },
    )
    token = signup_res.json()["access_token"]
    
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "protected@example.com"


def test_logout(client):
    """Test 8: Logout endpoint."""
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Logout User",
            "email": "logout@example.com",
            "password": "Password123!",
            "role": "warehouse_staff",
        },
    )
    token = signup_res.json()["access_token"]
    
    response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_forgot_and_reset_password_flow(client, db_session):
    """Test 10: Forgot-password foundation and reset flow."""
    # 1. Register user
    client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Reset User",
            "email": "reset@example.com",
            "password": "InitialPassword123!",
            "role": "inventory_manager",
        },
    )
    
    # 2. Request OTP
    forgot_res = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "reset@example.com"},
    )
    assert forgot_res.status_code == 200
    otp = forgot_res.json().get("dev_otp")
    assert otp is not None
    assert len(otp) == 6
    
    # 3. Test wrong OTP rejection
    bad_reset = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": "reset@example.com",
            "otp": "000000",
            "new_password": "BrandNewPassword123!",
        },
    )
    assert bad_reset.status_code == 400
    assert "Invalid or incorrect OTP" in bad_reset.json()["detail"]
    
    # 4. Complete reset with valid OTP
    good_reset = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": "reset@example.com",
            "otp": otp,
            "new_password": "BrandNewPassword123!",
        },
    )
    assert good_reset.status_code == 200
    assert "successfully" in good_reset.json()["message"]
    
    # 5. Verify old password fails
    old_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "reset@example.com",
            "password": "InitialPassword123!",
        },
    )
    assert old_login.status_code == 401
    
    # 6. Verify new password succeeds
    new_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "reset@example.com",
            "password": "BrandNewPassword123!",
        },
    )
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()
