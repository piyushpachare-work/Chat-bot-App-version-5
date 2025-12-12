"""
Tests for JWT authentication middleware in main.py.
"""
import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import os
from unittest.mock import patch, MagicMock

# Ensure backend directory is on path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

# Set environment variables before importing main
from cryptography.fernet import Fernet

# Generate a proper Fernet key for testing
test_fernet_key = Fernet.generate_key().decode("utf-8")

os.environ.setdefault("SESSION_SIGNING_KEY", "test-secret-key-for-jwt-signing")
os.environ.setdefault("ENTRA_TENANT_ID", "test-tenant")
os.environ.setdefault("ENTRA_CLIENT_ID", "test-client")
os.environ.setdefault("ENTRA_CLIENT_SECRET", "test-secret")
os.environ.setdefault("OIDC_REDIRECT_URI", "http://localhost/callback")
os.environ.setdefault("TOKEN_STORE_ENCRYPTION_KEY", test_fernet_key)
os.environ.setdefault("TOKEN_STORE_DB_PATH", ":memory:")

# Mock MSAL before importing auth_service
with patch("msal.ConfidentialClientApplication") as mock_msal:
    mock_msal.return_value = MagicMock()
    from main import app
    from auth_service import auth_service


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


def test_chat_endpoint_requires_auth(client):
    """Test that /chat endpoint returns 401 without Authorization header."""
    response = client.post("/chat", json={"message": "Hello"})
    assert response.status_code == 403  # FastAPI HTTPBearer returns 403 for missing token


def test_chat_endpoint_rejects_invalid_token(client):
    """Test that /chat endpoint returns 401 with invalid token."""
    response = client.post(
        "/chat",
        json={"message": "Hello"},
        headers={"Authorization": "Bearer invalid-token"}
    )
    assert response.status_code == 401


def test_chat_endpoint_accepts_valid_token(client):
    """Test that /chat endpoint accepts valid session JWT."""
    # Generate a valid session JWT
    token = auth_service.generate_session_jwt(
        sub="test-user-123",
        tid="test-tenant-id",
        scopes="openid profile"
    )
    
    # Mock copilot service to avoid actual API calls
    async def mock_send_message(user_id, message):
        return {
            "reply": "Test response",
            "has_attachments": False,
            "attachments": []
        }
    
    with patch("main.get_copilot_service") as mock_get_service:
        mock_service = MagicMock()
        mock_service.send_message = mock_send_message
        mock_get_service.return_value = mock_service
        
        response = client.post(
            "/chat",
            json={"message": "Hello"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        assert "reply" in response.json()


def test_health_endpoint_no_auth_required(client):
    """Test that /health endpoint does not require authentication."""
    response = client.get("/health")
    assert response.status_code == 200


def test_copilot_status_requires_auth(client):
    """Test that /copilot/status endpoint requires authentication."""
    response = client.get("/copilot/status")
    assert response.status_code == 403  # Missing token

