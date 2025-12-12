# Version 5 Chatbot App

[![CI](https://github.com/Lexicology/version-5-chatbot-app/actions/workflows/ci.yml/badge.svg?branch=integration/v4-master)](https://github.com/Lexicology/version-5-chatbot-app/actions/workflows/ci.yml)

Enterprise-ready chatbot starter that uses Microsoft Entra ID (OIDC + PKCE) and Microsoft 365 Agents SDK. The project includes a web middleware (Node/Express), a backend service (FastAPI/Python) and a mobile client (Expo/React Native).

## Overview
- Secure auth with Entra ID (PKCE), session JWTs, and optional Azure Key Vault for secrets.
- Copilot Studio agent integration via the backend service.
- Shared logging with `X-Request-Id` propagation.
- Multi-target: web middleware, Python backend, and mobile app.

## Prerequisites
- Node.js 18+ and npm
- Python 3.10+ with `pip`
- Azure tenant with an App Registration (client ID/secret) and (optional) Azure Key Vault
- Copilot Studio agent details if you plan to enable Copilot integration
- Expo CLI (installed via `npm install -g expo-cli`) for mobile development

## Project layout
- `src/` — Node/Express middleware, Entra auth, chat routes, Key Vault client
- `backend/` — FastAPI service, auth middleware, Copilot service integration
- `mobile/` — Expo/React Native client using PKCE and session JWTs
- `docs/` — Architecture, deployment, migration guides

## Environment configuration (put secrets in `.env` only)
Create `.env` files; never hardcode secrets. Key Vault is recommended for production.

- Root/web (`.env`):
  - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`
  - **One of** `AZURE_CLIENT_SECRET` **or** `AZURE_KEY_VAULT_URL`
  - `SESSION_SIGNING_KEY` (32+ chars)
  - Optional: `AZURE_REDIRECT_URI`, `MICROSOFT_365_SCOPE`, `CORS_ALLOWED_ORIGINS`, rate limit and logging settings

- Backend (`backend/.env`):
  - `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` (or store in Key Vault)
  - `SESSION_SIGNING_KEY` (or Key Vault via `KEY_VAULT_URI`/`SESSION_SIGNING_KEY_NAME`)
  - Copilot (required if using Copilot): `COPILOTSTUDIOAGENT__ENVIRONMENTID`, `COPILOTSTUDIOAGENT__SCHEMANAME`, `COPILOTSTUDIOAGENT__AGENTAPPID`, `COPILOTSTUDIOAGENT__TENANTID`
  - Optional: `OIDC_REDIRECT_URI`, `OIDC_SCOPES`, `CORS_ALLOWED_ORIGINS`. Token storage: if neither `KEY_VAULT_URI` nor `TOKEN_STORE_ENCRYPTION_KEY` is set, the backend uses an in-memory token cache (good for local dev; resets on restart). Set `TOKEN_STORE_ENCRYPTION_KEY` + `TOKEN_STORE_DB_PATH` to persist locally without Key Vault.

- Mobile (`mobile/.env` or `mobile/app.json`):
  - `EXPO_PUBLIC_BACKEND_URL`, `EXPO_PUBLIC_ENTRA_CLIENT_ID`, `EXPO_PUBLIC_ENTRA_TENANT_ID`
  - Optional: `EXPO_PUBLIC_ENTRA_SCOPES`

> Tip: For production, put the client secret and signing key in Azure Key Vault and set `AZURE_KEY_VAULT_URL` / `KEY_VAULT_URI`.
> Use the same `SESSION_SIGNING_KEY` value in root and backend so the middleware can validate the tokens the backend issues.

## Setup and install
1) Clone and install root:
```bash
npm ci
```

2) Install backend:
```bash
cd backend
pip install -r requirements.txt
```

3) Install mobile:
```bash
cd mobile
npm ci
```

## Running locally
Open three terminals (or use background processes).

- Web middleware (Node/Express):
  ```bash
  npm run dev
  ```
  Defaults to port 3000 unless `PORT` is set.

- Backend API (FastAPI):
  ```bash
  cd backend
  uvicorn main:app --reload
  ```
  Defaults to port 8000 unless configured.

- Mobile (Expo):
  ```bash
  cd mobile
  npm start
  ```
  Configure `EXPO_PUBLIC_BACKEND_URL` to point at the middleware URL you run locally (e.g., `http://localhost:3000`).

## Testing
- Web middleware: `npm test`
- Backend: `cd backend && pytest`
- Mobile: `cd mobile && npm test`

## Security and secrets
- Keep secrets only in `.env` files or Azure Key Vault. Never commit `.env`.
- Rotate client secrets and signing keys regularly.
- PKCE is used for the mobile client to avoid embedding client secrets.
- Logging is sanitized; request IDs are propagated via `X-Request-Id`.

## Deployment notes
- Use Key Vault in production for `azure-client-secret`, session signing key, and refresh tokens.
- Configure CORS allowlists per environment.
- Enable HTTPS and secure cookies in production (`Secure`, `HttpOnly`, `SameSite=strict`).
- CI badge above points to GitHub Actions workflow; ensure environment secrets are set there as well.

## Troubleshooting
- Missing env vars: check the `.env` files match the lists above; the app will log which are missing.
- Auth redirect issues: verify `AZURE_REDIRECT_URI` / `OIDC_REDIRECT_URI` match your Azure App Registration.
- CORS errors: update `CORS_ALLOWED_ORIGINS` in the relevant `.env`.
- Mobile cannot log in: confirm `EXPO_PUBLIC_BACKEND_URL` is reachable from the device/emulator and that PKCE redirect is allowed in Azure.
