import json
import logging
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import jwt
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from cryptography.fernet import Fernet
from fastapi import APIRouter, HTTPException
from jwt import PyJWKClient
from msal import ConfidentialClientApplication
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------


def _env(name: str, default: Optional[str] = None) -> str:
    value = os.getenv(name, default)
    if value is None:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _optional_env(name: str) -> Optional[str]:
    return os.getenv(name)


# ---------------------------------------------------------------------------
# Secure token storage
# ---------------------------------------------------------------------------


class SecureTokenStore:
    """
    Stores refresh tokens and ID token metadata securely.
    Prefers Azure Key Vault; falls back to encrypted SQLite using Fernet.
    """

    def __init__(
        self,
        key_vault_uri: Optional[str],
        encryption_key: Optional[str],
        sqlite_path: str = "./.secure_tokens.db",
    ):
        self._key_vault_uri = key_vault_uri
        self._encryption_key = encryption_key
        self._sqlite_path = sqlite_path
        self._fernet: Optional[Fernet] = None
        self._kv_client: Optional[SecretClient] = None

        if key_vault_uri:
            credential = DefaultAzureCredential(exclude_interactive_browser_credential=True)
            self._kv_client = SecretClient(vault_url=key_vault_uri, credential=credential)
            logger.info("SecureTokenStore configured to use Azure Key Vault.")
        else:
            if not encryption_key:
                raise ValueError(
                    "TOKEN_STORE_ENCRYPTION_KEY is required when Key Vault is not configured."
                )
            try:
                self._fernet = Fernet(encryption_key.encode("utf-8"))
            except ValueError as exc:
                raise ValueError(
                    "TOKEN_STORE_ENCRYPTION_KEY must be a 32-byte urlsafe base64 string."
                ) from exc
            self._init_sqlite()
            logger.info("SecureTokenStore using encrypted SQLite fallback.")

    def _init_sqlite(self) -> None:
        conn = sqlite3.connect(self._sqlite_path)
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tokens (
                    user_id TEXT PRIMARY KEY,
                    refresh_token BLOB NOT NULL,
                    id_token_meta BLOB
                )
                """
            )
            conn.commit()
        finally:
            conn.close()

    def _encrypt(self, value: str) -> bytes:
        assert self._fernet, "Encryption not initialized."
        return self._fernet.encrypt(value.encode("utf-8"))

    def _decrypt(self, blob: Optional[bytes]) -> Optional[str]:
        if not blob:
            return None
        assert self._fernet, "Encryption not initialized."
        return self._fernet.decrypt(blob).decode("utf-8")

    def store_tokens(self, user_id: str, refresh_token: str, id_token_meta: Dict[str, Any]) -> None:
        if self._kv_client:
            # Store in Key Vault as individual secrets to avoid large payloads.
            self._kv_client.set_secret(f"refresh-token-{user_id}", refresh_token)
            self._kv_client.set_secret(f"id-token-meta-{user_id}", json.dumps(id_token_meta))
            return

        encrypted_refresh = self._encrypt(refresh_token)
        encrypted_meta = self._encrypt(json.dumps(id_token_meta))

        conn = sqlite3.connect(self._sqlite_path)
        try:
            conn.execute(
                """
                INSERT INTO tokens (user_id, refresh_token, id_token_meta)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    refresh_token=excluded.refresh_token,
                    id_token_meta=excluded.id_token_meta
                """,
                (user_id, encrypted_refresh, encrypted_meta),
            )
            conn.commit()
        finally:
            conn.close()

    def get_tokens(self, user_id: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        if self._kv_client:
            try:
                refresh = self._kv_client.get_secret(f"refresh-token-{user_id}").value
            except Exception:
                refresh = None
            try:
                meta_raw = self._kv_client.get_secret(f"id-token-meta-{user_id}").value
                meta = json.loads(meta_raw) if meta_raw else None
            except Exception:
                meta = None
            return refresh, meta

        conn = sqlite3.connect(self._sqlite_path)
        try:
            row = conn.execute(
                "SELECT refresh_token, id_token_meta FROM tokens WHERE user_id = ?",
                (user_id,),
            ).fetchone()
        finally:
            conn.close()

        if not row:
            return None, None

        refresh = self._decrypt(row[0])
        meta_str = self._decrypt(row[1]) if row[1] else None
        meta = json.loads(meta_str) if meta_str else None
        return refresh, meta

    def delete_tokens(self, user_id: str) -> None:
        if self._kv_client:
            try:
                self._kv_client.begin_delete_secret(f"refresh-token-{user_id}")
            except Exception:
                pass
            try:
                self._kv_client.begin_delete_secret(f"id-token-meta-{user_id}")
            except Exception:
                pass
            return

        conn = sqlite3.connect(self._sqlite_path)
        try:
            conn.execute("DELETE FROM tokens WHERE user_id = ?", (user_id,))
            conn.commit()
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# Auth service
# ---------------------------------------------------------------------------


class AuthService:
    def __init__(self):
        tenant_id = _env("ENTRA_TENANT_ID")
        self.client_id = _env("ENTRA_CLIENT_ID")
        self.client_secret = _env("ENTRA_CLIENT_SECRET")
        self.redirect_uri = _env("OIDC_REDIRECT_URI")
        self.scopes = json.loads(os.getenv("OIDC_SCOPES", '["openid", "profile", "offline_access"]'))
        self.authority = f"https://login.microsoftonline.com/{tenant_id}"
        self.jwks_uri = f"{self.authority}/discovery/v2.0/keys"

        key_vault_uri = _optional_env("KEY_VAULT_URI")
        encryption_key = _optional_env("TOKEN_STORE_ENCRYPTION_KEY")
        sqlite_path = os.getenv("TOKEN_STORE_DB_PATH", "./.secure_tokens.db")

        self.token_store = SecureTokenStore(key_vault_uri, encryption_key, sqlite_path)
        self._session_ttl_minutes = int(os.getenv("SESSION_JWT_TTL_MINUTES", "15"))
        self._jwk_client = PyJWKClient(self.jwks_uri)
        self._confidential_client = ConfidentialClientApplication(
            client_id=self.client_id,
            client_credential=self.client_secret,
            authority=self.authority,
        )

    # ------------------------- Token exchange ------------------------------ #
    def build_auth_url(self, state: Optional[str] = None) -> str:
        return self._confidential_client.get_authorization_request_url(
            scopes=self.scopes,
            redirect_uri=self.redirect_uri,
            state=state,
            response_type="code",
        )

    def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        result = self._confidential_client.acquire_token_by_authorization_code(
            code=code,
            scopes=self.scopes,
            redirect_uri=self.redirect_uri,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail="Authorization code exchange failed.")
        return result

    def refresh_tokens(self, refresh_token: str) -> Dict[str, Any]:
        result = self._confidential_client.acquire_token_by_refresh_token(
            refresh_token=refresh_token,
            scopes=self.scopes,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail="Refresh token exchange failed.")
        return result

    # ----------------------- ID token validation --------------------------- #
    def validate_id_token(self, id_token: str) -> Dict[str, Any]:
        signing_key = self._jwk_client.get_signing_key_from_jwt(id_token).key
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=["RS256"],
            audience=self.client_id,
            options={"verify_at_hash": False},
        )
        return claims

    # ----------------------- Session JWT helpers --------------------------- #
    def _session_signing_key(self) -> str:
        kv_key_name = os.getenv("SESSION_SIGNING_KEY_NAME")
        key_vault_uri = _optional_env("KEY_VAULT_URI")
        if key_vault_uri and kv_key_name:
            client = SecretClient(
                vault_url=key_vault_uri,
                credential=DefaultAzureCredential(exclude_interactive_browser_credential=True),
            )
            secret = client.get_secret(kv_key_name).value
            if not secret:
                raise ValueError("Session signing key in Key Vault is empty.")
            return secret

        env_key = os.getenv("SESSION_SIGNING_KEY")
        if not env_key:
            raise ValueError("SESSION_SIGNING_KEY is required for session JWTs.")
        return env_key

    def generate_session_jwt(self, sub: str, tid: str, scopes: str) -> str:
        now = datetime.now(tz=timezone.utc)
        exp = now + timedelta(minutes=self._session_ttl_minutes)
        payload = {
            "sub": sub,
            "tid": tid,
            "scp": scopes,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }
        key = self._session_signing_key()
        token = jwt.encode(payload, key, algorithm="HS256")
        return token

    def decode_session_jwt(self, token: str) -> Dict[str, Any]:
        key = self._session_signing_key()
        return jwt.decode(token, key, algorithms=["HS256"])


# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------


auth_router = APIRouter(prefix="/auth", tags=["auth"])
auth_service = AuthService()


class LoginResponse(BaseModel):
    authorization_url: str


class CallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


class TokenResponse(BaseModel):
    session_token: str
    id_token_claims: Dict[str, Any]


class RefreshRequest(BaseModel):
    session_token: str


class LogoutRequest(BaseModel):
    session_token: str


@auth_router.post("/login", response_model=LoginResponse)
async def login() -> LoginResponse:
    auth_url = auth_service.build_auth_url()
    return LoginResponse(authorization_url=auth_url)


@auth_router.post("/callback", response_model=TokenResponse)
async def callback(payload: CallbackRequest) -> TokenResponse:
    tokens = auth_service.exchange_code_for_tokens(payload.code)
    id_token = tokens.get("id_token")
    refresh_token = tokens.get("refresh_token")

    if not id_token or not refresh_token:
        raise HTTPException(status_code=400, detail="OIDC tokens missing in response.")

    claims = auth_service.validate_id_token(id_token)
    user_id = claims.get("oid") or claims.get("sub")
    tenant_id = claims.get("tid")
    scopes = tokens.get("scope", "")

    if not user_id or not tenant_id:
        raise HTTPException(status_code=400, detail="ID token missing required claims.")

    id_token_meta = {
        "oid": user_id,
        "tid": tenant_id,
        "scp": scopes,
        "exp": claims.get("exp"),
        "iat": claims.get("iat"),
    }
    auth_service.token_store.store_tokens(user_id, refresh_token, id_token_meta)

    session_token = auth_service.generate_session_jwt(user_id, tenant_id, scopes)
    return TokenResponse(session_token=session_token, id_token_claims=claims)


@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest) -> TokenResponse:
    claims = auth_service.decode_session_jwt(payload.session_token)
    user_id = claims.get("sub")
    tenant_id = claims.get("tid")
    if not user_id or not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid session token.")

    stored_refresh, id_meta = auth_service.token_store.get_tokens(user_id)
    if not stored_refresh:
        raise HTTPException(status_code=401, detail="Refresh token not found.")

    tokens = auth_service.refresh_tokens(stored_refresh)
    id_token = tokens.get("id_token")
    refresh_token = tokens.get("refresh_token")
    scopes = tokens.get("scope", claims.get("scp", ""))

    if not id_token or not refresh_token:
        raise HTTPException(status_code=400, detail="OIDC tokens missing in refresh response.")

    id_claims = auth_service.validate_id_token(id_token)
    auth_service.token_store.store_tokens(user_id, refresh_token, id_meta or {})
    session_token = auth_service.generate_session_jwt(user_id, tenant_id, scopes)

    return TokenResponse(session_token=session_token, id_token_claims=id_claims)


@auth_router.post("/logout")
async def logout(payload: LogoutRequest) -> Dict[str, str]:
    claims = auth_service.decode_session_jwt(payload.session_token)
    user_id = claims.get("sub")
    if user_id:
        auth_service.token_store.delete_tokens(user_id)
    return {"status": "signed_out"}

