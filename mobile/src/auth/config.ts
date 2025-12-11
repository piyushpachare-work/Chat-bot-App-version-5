import Constants from "expo-constants";

const BACKEND_ENV_KEY = "EXPO_PUBLIC_BACKEND_URL";
const CLIENT_ID_ENV_KEY = "EXPO_PUBLIC_ENTRA_CLIENT_ID";
const TENANT_ID_ENV_KEY = "EXPO_PUBLIC_ENTRA_TENANT_ID";
const SCOPE_ENV_KEY = "EXPO_PUBLIC_ENTRA_SCOPES";

export function getBackendBaseUrl(): string {
  const value = process.env[BACKEND_ENV_KEY];
  if (!value) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL is required for authentication.");
  }
  return value.replace(/\/$/, "");
}

export function getEntraClientId(): string {
  const value = process.env[CLIENT_ID_ENV_KEY];
  if (!value) {
    throw new Error("EXPO_PUBLIC_ENTRA_CLIENT_ID is missing.");
  }
  return value;
}

export function getEntraTenantId(): string {
  const value = process.env[TENANT_ID_ENV_KEY];
  if (!value) {
    throw new Error("EXPO_PUBLIC_ENTRA_TENANT_ID is missing.");
  }
  return value;
}

export function getDefaultScopes(): string[] {
  const value = process.env[SCOPE_ENV_KEY];
  if (value) {
    return value
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
  }
  return ["openid", "profile", "offline_access"];
}

export function getRedirectScheme(): string {
  return Constants.expoConfig?.scheme ?? "mobile";
}

export function getRedirectPath(): string {
  return "auth/callback";
}

export function getAuthorityBaseUrl(): string {
  return `https://login.microsoftonline.com/${getEntraTenantId()}`;
}

