import { getBackendBaseUrl } from "./config";
import { AuthCodeRequest, startSystemBrowserLogin } from "./pkce";
import {
  SessionTokens,
  clearSession,
  getAuthHeader,
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

  // Handle single-use refresh token replacement: use new refresh_token if provided, otherwise clear
  // The middleware returns a new refresh_token when the old one is consumed
  const tokens: SessionTokens = {
    sessionJwt: data.session_jwt,
    refreshToken: data.refresh_token ?? null, // Use new token or null (single-use replacement)
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

/**
 * Authenticated fetch wrapper that automatically:
 * - Adds Authorization header with session token
 * - Handles 401 responses by refreshing the session token and retrying
 * - Clears session on refresh failure
 * 
 * @param url - Request URL
 * @param options - Fetch options (headers will be merged with auth header)
 * @param fetcher - Optional fetch implementation for testing
 * @returns Promise<Response>
 * @throws Error if session is invalid and refresh fails
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  fetcher: typeof fetch = fetch
): Promise<Response> {
  const authHeader = await getAuthHeader();
  if (!authHeader) {
    throw new Error("No valid session. Please sign in.");
  }

  // Merge auth header with existing headers
  const headers = new Headers(options.headers);
  headers.set("Authorization", authHeader);

  const requestOptions: RequestInit = {
    ...options,
    headers,
  };

  let response = await fetcher(url, requestOptions);

  // Handle 401 Unauthorized - attempt refresh and retry
  if (response.status === 401) {
    const session = await readSession();
    if (!session?.refreshToken) {
      await clearSession();
      throw new Error("Session expired and no refresh token available.");
    }

    try {
      // Refresh the session token (handles single-use replacement)
      const refreshed = await refreshSessionToken(session.refreshToken, fetcher);
      
      // Retry the original request with new token
      const newAuthHeader = `Bearer ${refreshed.sessionJwt}`;
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set("Authorization", newAuthHeader);
      
      const retryOptions: RequestInit = {
        ...options,
        headers: retryHeaders,
      };
      
      response = await fetcher(url, retryOptions);
      
      // If retry still fails with 401, clear session
      if (response.status === 401) {
        await clearSession();
        throw new Error("Session refresh failed. Please sign in again.");
      }
    } catch (error) {
      await clearSession();
      throw error instanceof Error ? error : new Error("Session refresh failed.");
    }
  }

  return response;
}

