import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";

import {
  getAuthorityBaseUrl,
  getDefaultScopes,
  getEntraClientId,
  getRedirectPath,
  getRedirectScheme,
} from "./config";

WebBrowser.maybeCompleteAuthSession();

export type AuthCodeRequest = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
};

export type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
};

export async function deriveCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );

  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPkcePair(): Promise<PkcePair> {
  const codeVerifier = await AuthSession.generateRandomAsync(64);
  const codeChallenge = await deriveCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

export function buildRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: getRedirectScheme(),
    path: getRedirectPath(),
  });
}

export async function startSystemBrowserLogin(): Promise<AuthCodeRequest> {
  const { codeChallenge, codeVerifier } = await createPkcePair();
  const redirectUri = buildRedirectUri();
  const discovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: `${getAuthorityBaseUrl()}/oauth2/v2.0/authorize`,
    tokenEndpoint: `${getAuthorityBaseUrl()}/oauth2/v2.0/token`,
  };

  const request = new AuthSession.AuthRequest({
    clientId: getEntraClientId(),
    responseType: AuthSession.ResponseType.Code,
    redirectUri,
    usePKCE: true,
    codeChallenge,
    codeChallengeMethod: "S256",
    scopes: getDefaultScopes(),
    extraParams: {
      prompt: "select_account",
      response_mode: "query",
    },
  });

  const result = await request.promptAsync(discovery, {
    useProxy: false,
    windowName: "entra-signin",
  });

  if (result.type !== "success" || !result.params.code) {
    throw new Error("Microsoft Entra sign-in was cancelled or failed.");
  }

  return {
    code: String(result.params.code),
    codeVerifier,
    redirectUri,
  };
}

