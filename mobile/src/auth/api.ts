import { getBackendBaseUrl } from "./config";
import { AuthCodeRequest, startSystemBrowserLogin } from "./pkce";
import {
  SessionTokens,
  clearSession,
  isSessionExpired,
  persistSession,
  readSession,
} from "./session";

type CallbackResponse = {
  session_jwt: string;
  refresh_token?: string | null;
  expires_at?: number | null;
};

export async function exchangeCodeForSession(
  payload: AuthCodeRequest,
  fetcher: typeof fetch = fetch
): Promise<SessionTokens> {
  const response = await fetcher(`${getBackendBaseUrl()}/auth/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: payload.code,
      code_verifier: payload.codeVerifier,
      redirect_uri: payload.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error("Authentication callback failed.");
  }

  const data: CallbackResponse = await response.json();
  if (!data.session_jwt) {
    throw new Error("Missing session JWT in callback response.");
  }

  const tokens: SessionTokens = {
    sessionJwt: data.session_jwt,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_at ?? null,
  };

  await persistSession(tokens);
  return tokens;
}

export async function refreshSessionToken(
  refreshToken: string,
  fetcher: typeof fetch = fetch
): Promise<SessionTokens> {
  const response = await fetcher(`${getBackendBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Session refresh failed.");
  }

  const data: CallbackResponse = await response.json();
  if (!data.session_jwt) {
    throw new Error("Missing session JWT in refresh response.");
  }

  const tokens: SessionTokens = {
    sessionJwt: data.session_jwt,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_at ?? null,
  };

  await persistSession(tokens);
  return tokens;
}

export async function ensureValidSession(): Promise<SessionTokens | null> {
  const existing = await readSession();
  if (existing && !isSessionExpired(existing)) {
    return existing;
  }

  if (existing?.refreshToken) {
    try {
      return await refreshSessionToken(existing.refreshToken);
    } catch {
      await clearSession();
      return null;
    }
  }

  return null;
}

export async function interactiveLogin(): Promise<SessionTokens> {
  const authCode = await startSystemBrowserLogin();
  return exchangeCodeForSession(authCode);
}

