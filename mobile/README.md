# Mobile App

React Native mobile app built with Expo for the Version 5 Chatbot App.

## Authentication

The mobile app uses Authorization Code + PKCE flow with Microsoft Entra ID:

1. Opens system browser for user authentication
2. Receives authorization code
3. Exchanges code + code_verifier for session JWT via middleware `/auth/callback`
4. Stores session JWT and refresh token securely using Expo SecureStore
5. Automatically includes `Authorization: Bearer <session_token>` header in API requests
6. Handles token refresh automatically on 401 responses

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `EXPO_PUBLIC_BACKEND_URL`: Your middleware/backend URL
- `EXPO_PUBLIC_ENTRA_CLIENT_ID`: Azure App Registration Client ID
- `EXPO_PUBLIC_ENTRA_TENANT_ID`: Azure AD Tenant ID
- `EXPO_PUBLIC_ENTRA_SCOPES`: OAuth scopes (optional, defaults to `openid,profile,offline_access`)

## Local Development

### Mocking Middleware for Local Development

If you need to mock the middleware `/auth/callback` endpoint for local development:

1. Set up a local mock server (e.g., using `json-server` or a simple Express server)
2. Update `EXPO_PUBLIC_BACKEND_URL` to point to your local mock server (e.g., `http://localhost:3000`)
3. Ensure your mock server responds to `POST /auth/callback` with:
   ```json
   {
     "session_jwt": "mock-jwt-token",
     "refresh_token": "mock-refresh-token",
     "expires_at": 1735689600000
   }
   ```
4. Ensure your mock server responds to `POST /auth/refresh` with:
   ```json
   {
     "session_jwt": "new-mock-jwt-token",
     "refresh_token": "new-mock-refresh-token",
     "expires_at": 1735689600000
   }
   ```

**Note**: For production, always use the real middleware server. Never store client secrets in the mobile app.

## Running the App

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

## Security Notes

- Session tokens are stored in Expo SecureStore (encrypted storage)
- Refresh tokens are stored securely and handled as single-use replacements
- No client secrets are stored in the mobile app
- All API requests automatically include authentication headers
- Token refresh is handled automatically on 401 responses
