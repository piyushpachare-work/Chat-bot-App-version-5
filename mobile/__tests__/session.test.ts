import { ensureValidSession } from "@/src/auth/api";
import { getAuthToken, persistSession } from "@/src/auth/session";

describe("Session storage and refresh", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_BACKEND_URL = "https://api.example.com";
  });

  it("refreshes an expired session when a refresh token exists", async () => {
    const expiredTime = Date.now() - 1_000;
    const refreshedExpiry = Date.now() + 60_000;

    await persistSession({
      sessionJwt: "expired-jwt",
      refreshToken: "refresh-token",
      expiresAt: expiredTime,
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        session_jwt: "new-jwt",
        refresh_token: "refresh-token",
        expires_at: refreshedExpiry,
      }),
    });

    // @ts-expect-error global assignment for test
    global.fetch = fetchMock;

    const session = await ensureValidSession();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/auth/refresh",
      expect.any(Object)
    );
    expect(session?.sessionJwt).toBe("new-jwt");
    expect(await getAuthToken()).toBe("new-jwt");
  });
});

