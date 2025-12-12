import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import jwtDecode from "jwt-decode";

export type SessionTokens = {
  sessionJwt: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
};

type StoredSession = {
  sessionJwt: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
};

const SESSION_KEY = "session_jwt";
const REFRESH_KEY = "refresh_token";
const EXP_KEY = "session_exp";

export async function persistSession(tokens: SessionTokens): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, tokens.sessionJwt);

  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }

  if (tokens.expiresAt) {
    await SecureStore.setItemAsync(EXP_KEY, tokens.expiresAt.toString());
  } else {
    await SecureStore.deleteItemAsync(EXP_KEY);
  }
}

export async function readSession(): Promise<StoredSession | null> {
  const [sessionJwt, refreshToken, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(SESSION_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(EXP_KEY),
  ]);

  if (!sessionJwt) return null;

  return {
    sessionJwt,
    refreshToken: refreshToken ?? null,
    expiresAt: expiresAt ? Number(expiresAt) : null,
  };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(EXP_KEY),
  ]);
}

export function decodeExpiryFromJwt(token: string): number | null {
  try {
    const decoded: { exp?: number } = jwtDecode(token);
    if (decoded.exp) {
      return decoded.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

export function isSessionExpired(session: StoredSession | SessionTokens): boolean {
  const now = Date.now();
  if (session.expiresAt) {
    return session.expiresAt <= now;
  }
  const exp = decodeExpiryFromJwt(session.sessionJwt);
  return exp ? exp <= now : false;
}

export async function getAuthToken(): Promise<string | null> {
  const session = await readSession();
  if (!session || isSessionExpired(session)) {
    return null;
  }
  return session.sessionJwt;
}

/**
 * Returns the Authorization header value for authenticated requests.
 * @returns Authorization header string (e.g., "Bearer <token>") or null if no valid session
 */
export async function getAuthHeader(): Promise<string | null> {
  const token = await getAuthToken();
  return token ? `Bearer ${token}` : null;
}

export async function saveConversationId(conversationId: string): Promise<void> {
  await AsyncStorage.setItem("conversation_id", conversationId);
}

export async function getConversationId(): Promise<string | null> {
  return AsyncStorage.getItem("conversation_id");
}

export async function clearConversation(): Promise<void> {
  await AsyncStorage.removeItem("conversation_id");
}

