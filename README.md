# Version 5 Chatbot App

[![CI](https://github.com/Lexicology/version-5-chatbot-app/actions/workflows/ci.yml/badge.svg?branch=integration/v4-master)](https://github.com/Lexicology/version-5-chatbot-app/actions/workflows/ci.yml)

Chatbot application using Microsoft Entra ID and Microsoft 365 Agents SDK with web, backend, and mobile packages.

## Getting started
- Copy the relevant `.env.example` files (root, `src/`, `backend/`, `mobile/`) and fill in Azure and Copilot Studio settings.
- Install dependencies and run tests:
  - `npm ci && npm test`
  - `cd backend && pip install -r requirements.txt && pytest`
  - `cd mobile && npm ci && npm test`
- Start the Express server with `npm run dev` and the FastAPI service with `uvicorn main:app --reload` inside `backend/`.

## Observability
- Incoming requests are assigned or forwarded an `X-Request-Id` header for consistent logging across services.
- Logs are structured and redact sensitive values by default.
