import { exchangeCodeForSession } from "@/src/auth/api";

describe("Authentication callback", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_BACKEND_URL = "https://api.example.com";
  });

  it("sends code payload to middleware and returns session tokens", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        session_jwt: "jwt-123",
        refresh_token: "refresh-123",
        expires_at: 1730000000000,
      }),
    });

    const tokens = await exchangeCodeForSession(
      {
        code: "code-abc",
        codeVerifier: "verifier-xyz",
        redirectUri: "mobile://auth/callback",
      },
      fetchMock as unknown as typeof fetch
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/auth/callback",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );

    expect(body).toEqual({
      code: "code-abc",
      code_verifier: "verifier-xyz",
      redirect_uri: "mobile://auth/callback",
    });
    expect(tokens.sessionJwt).toBe("jwt-123");
    expect(tokens.refreshToken).toBe("refresh-123");
    expect(tokens.expiresAt).toBe(1730000000000);
  });
});

