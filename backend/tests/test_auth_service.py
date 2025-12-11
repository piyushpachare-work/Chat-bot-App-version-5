import importlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from cryptography.fernet import Fernet


class FakeConfidentialClient:
    def __init__(self, *args, **kwargs):
        self.auth_url = "https://login.example/authorize?response_type=code"
        self.token_result = kwargs.pop("token_result", {})
        self.refresh_result = kwargs.pop("refresh_result", {})

    def get_authorization_request_url(self, **kwargs):
        return self.auth_url

    def acquire_token_by_authorization_code(self, **kwargs):
        return self.token_result

    def acquire_token_by_refresh_token(self, **kwargs):
        return self.refresh_result


@pytest.fixture
def configured_service(tmp_path, monkeypatch):
    # Ensure backend directory is on path for module imports
    backend_root = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(backend_root))

    # Patch MSAL client to avoid outbound calls during tests
    import msal
    monkeypatch.setattr(msal, "ConfidentialClientApplication", FakeConfidentialClient)

    # Regenerate module with clean state for each test.
    key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setenv("ENTRA_TENANT_ID", "test-tenant")
    monkeypatch.setenv("ENTRA_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("ENTRA_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("OIDC_REDIRECT_URI", "https://localhost/callback")
    monkeypatch.setenv("OIDC_SCOPES", json.dumps(["openid", "profile", "offline_access"]))
    monkeypatch.setenv("TOKEN_STORE_ENCRYPTION_KEY", key)
    monkeypatch.setenv("TOKEN_STORE_DB_PATH", str(tmp_path / "tokens.db"))
    monkeypatch.setenv("SESSION_SIGNING_KEY", "super-secret-session-key")

    import auth_service

    importlib.reload(auth_service)

    service = auth_service.AuthService()
    return service


def test_login_url_generated(configured_service):
    configured_service._confidential_client = FakeConfidentialClient(
        auth_url="https://login.example/authorize?response_type=code",
        token_result={},
        refresh_result={},
    )
    url = configured_service.build_auth_url()
    assert "response_type=code" in url


def test_callback_stores_tokens_and_generates_session(configured_service, monkeypatch):
    now = datetime.now(tz=timezone.utc)
    id_claims = {"oid": "user-1", "tid": "tenant-1", "iat": int(now.timestamp()), "exp": int((now + timedelta(hours=1)).timestamp())}
    configured_service._confidential_client = FakeConfidentialClient(
        auth_url="",
        token_result={
            "id_token": "id-token-value",
            "refresh_token": "refresh-token-value",
            "scope": "openid profile",
        },
        refresh_result={},
    )
    monkeypatch.setattr(configured_service, "validate_id_token", lambda token: id_claims)

    tokens = configured_service.exchange_code_for_tokens("abc123")
    claims = configured_service.validate_id_token(tokens["id_token"])
    configured_service.token_store.store_tokens(
        claims["oid"], tokens["refresh_token"], {"scp": tokens["scope"]}
    )
    session = configured_service.generate_session_jwt(claims["oid"], claims["tid"], tokens["scope"])
    decoded = configured_service.decode_session_jwt(session)

    assert decoded["sub"] == "user-1"
    assert decoded["tid"] == "tenant-1"


def test_refresh_flow_uses_stored_refresh_token(configured_service, monkeypatch):
    id_claims = {"oid": "user-2", "tid": "tenant-2"}
    configured_service._confidential_client = FakeConfidentialClient(
        auth_url="",
        token_result={},
        refresh_result={
            "id_token": "new-id-token",
            "refresh_token": "new-refresh-token",
            "scope": "openid profile offline_access",
        },
    )
    monkeypatch.setattr(configured_service, "validate_id_token", lambda token: id_claims)

    configured_service.token_store.store_tokens("user-2", "old-refresh", {"scp": "initial"})
    session = configured_service.generate_session_jwt("user-2", "tenant-2", "initial")
    claims = configured_service.decode_session_jwt(session)

    stored_refresh, _ = configured_service.token_store.get_tokens("user-2")
    assert stored_refresh == "old-refresh"

    refreshed = configured_service.refresh_tokens(stored_refresh)
    configured_service.token_store.store_tokens("user-2", refreshed["refresh_token"], {"scp": refreshed["scope"]})
    new_refresh, _ = configured_service.token_store.get_tokens("user-2")

    assert refreshed["refresh_token"] == "new-refresh-token"
    assert new_refresh == "new-refresh-token"

