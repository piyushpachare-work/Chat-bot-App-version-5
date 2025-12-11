import * as AuthSession from "expo-auth-session";
import { deriveCodeChallenge, createPkcePair } from "@/src/auth/pkce";

jest.mock("expo-auth-session", () => ({
  generateRandomAsync: jest.fn(),
}));

describe("PKCE utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds an RFC-compliant code challenge", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates verifier and challenge together", async () => {
    (AuthSession.generateRandomAsync as jest.Mock).mockResolvedValueOnce(
      "random_verifier"
    );

    const pair = await createPkcePair();
    expect(pair.codeVerifier).toBe("random_verifier");
    // The digest mock in jest.setup.js returns base64; ensure url-safe
    expect(pair.codeChallenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(pair.codeChallenge).not.toContain("=");
    expect(pair.codeChallenge.length).toBeGreaterThan(10);
  });
});

