import * as SecureStore from "expo-secure-store";
import { authenticatedFetch, ensureValidSession, refreshSessionToken } from "@/src/auth/api";
import {
  clearSession,
  getAuthHeader,
  getAuthToken,
  isSessionExpired,
  persistSession,
  readSession,
} from "@/src/auth/session";

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("Session storage and refresh", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_BACKEND_URL = "https://api.example.com";
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe("Session storage", () => {
    it("persists session tokens securely", async () => {
      const tokens = {
        sessionJwt: "test-jwt",
        refreshToken: "test-refresh",
        expiresAt: Date.now() + 3600000,
      };

      await persistSession(tokens);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("session_jwt", "test-jwt");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("refresh_token", "test-refresh");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "session_exp",
        tokens.expiresAt.toString()
      );
    });

    it("reads session tokens from secure storage", async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === "session_jwt") return Promise.resolve("test-jwt");
          if (key === "refresh_token") return Promise.resolve("test-refresh");
          if (key === "session_exp") return Promise.resolve((Date.now() + 3600000).toString());
          return Promise.resolve(null);
        });

      const session = await readSession();

      expect(session).toEqual({
        sessionJwt: "test-jwt",
        refreshToken: "test-refresh",
        expiresAt: expect.any(Number),
      });
    });

    it("returns null when no session exists", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const session = await readSession();

      expect(session).toBeNull();
    });

    it("clears session tokens", async () => {
      await clearSession();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("session_jwt");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refresh_token");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("session_exp");
    });
  });

  describe("getAuthHeader", () => {
    it("returns Authorization header with valid session", async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === "session_jwt") return Promise.resolve("test-jwt");
          if (key === "session_exp") return Promise.resolve((Date.now() + 3600000).toString());
          return Promise.resolve(null);
        });

      const header = await getAuthHeader();

      expect(header).toBe("Bearer test-jwt");
    });

    it("returns null when session is expired", async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === "session_jwt") return Promise.resolve("expired-jwt");
          if (key === "session_exp") return Promise.resolve((Date.now() - 1000).toString());
          return Promise.resolve(null);
        });

      const header = await getAuthHeader();

      expect(header).toBeNull();
    });

    it("returns null when no session exists", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const header = await getAuthHeader();

      expect(header).toBeNull();
    });
  });

  describe("Session expiration", () => {
    it("detects expired session by expiresAt", () => {
      const expiredSession = {
        sessionJwt: "jwt",
        expiresAt: Date.now() - 1000,
      };

      expect(isSessionExpired(expiredSession)).toBe(true);
    });

    it("detects valid session by expiresAt", () => {
      const validSession = {
        sessionJwt: "jwt",
        expiresAt: Date.now() + 3600000,
      };

      expect(isSessionExpired(validSession)).toBe(false);
    });
  });

  describe("Session refresh", () => {
    it("refreshes an expired session when a refresh token exists", async () => {
      const expiredTime = Date.now() - 1_000;
      const refreshedExpiry = Date.now() + 60_000;

      await persistSession({
        sessionJwt: "expired-jwt",
        refreshToken: "refresh-token",
        expiresAt: expiredTime,
      });

      // Mock secure store to return the persisted session
      (SecureStore.getItemAsync as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === "session_jwt") return Promise.resolve("expired-jwt");
          if (key === "refresh_token") return Promise.resolve("refresh-token");
          if (key === "session_exp") return Promise.resolve(expiredTime.toString());
          return Promise.resolve(null);
        });

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          session_jwt: "new-jwt",
          refresh_token: "new-refresh-token",
          expires_at: refreshedExpiry,
        }),
      });

      const session = await ensureValidSession(fetchMock as unknown as typeof fetch);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/auth/refresh",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(session?.sessionJwt).toBe("new-jwt");
      expect(session?.refreshToken).toBe("new-refresh-token");
      expect(await getAuthToken()).toBe("new-jwt");
    });

    it("handles single-use refresh token replacement", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          session_jwt: "new-jwt",
          refresh_token: "new-refresh-token", // New token replaces old one
          expires_at: Date.now() + 3600000,
        }),
      });

      const tokens = await refreshSessionToken("old-refresh-token", fetchMock);

      expect(tokens.refreshToken).toBe("new-refresh-token");
      expect(tokens.sessionJwt).toBe("new-jwt");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("refresh_token", "new-refresh-token");
    });
  });

  describe("authenticatedFetch", () => {
    it("adds Authorization header to requests", async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === "session_jwt") return Promise.resolve("test-jwt");
          if (key === "session_exp") return Promise.resolve((Date.now() + 3600000).toString());
          return Promise.resolve(null);
        });

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      });

      await authenticatedFetch("https://api.example.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, fetchMock as unknown as typeof fetch);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/chat",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-jwt",
          }),
        })
      );
    });

    it("handles 401 by refreshing token and retrying", async () => {
      let callCount = 0;
      const fetchMock = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call returns 401
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
        // Refresh call
        if (callCount === 2) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              session_jwt: "refreshed-jwt",
              refresh_token: "new-refresh",
              expires_at: Date.now() + 3600000,
            }),
          });
        }
        // Retry call succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: "success" }),
        });
      });

      (SecureStore.getItemAsync as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === "session_jwt") {
            return callCount < 3
              ? Promise.resolve("old-jwt")
              : Promise.resolve("refreshed-jwt");
          }
          if (key === "refresh_token") {
            return Promise.resolve("refresh-token");
          }
          if (key === "session_exp") {
            return Promise.resolve((Date.now() + 3600000).toString());
          }
          return Promise.resolve(null);
        });

      const response = await authenticatedFetch(
        "https://api.example.com/chat",
        { method: "POST" },
        fetchMock as unknown as typeof fetch
      );

      expect(fetchMock).toHaveBeenCalledTimes(3); // Original, refresh, retry
      expect(response.status).toBe(200);
    });

    it("clears session when refresh fails", async () => {
      const fetchMock = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({}),
        });
      });

      (SecureStore.getItemAsync as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === "session_jwt") return Promise.resolve("old-jwt");
          if (key === "refresh_token") return Promise.resolve("invalid-refresh");
          if (key === "session_exp") return Promise.resolve((Date.now() + 3600000).toString());
          return Promise.resolve(null);
        });

      // Mock refresh to fail
      fetchMock.mockImplementation((url: string) => {
        if (url.includes("/auth/refresh")) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({}),
        });
      });

      await expect(
        authenticatedFetch(
          "https://api.example.com/chat",
          { method: "POST" },
          fetchMock as unknown as typeof fetch
        )
      ).rejects.toThrow();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it("throws error when no session exists", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      await expect(
        authenticatedFetch("https://api.example.com/chat", { method: "POST" })
      ).rejects.toThrow("No valid session");
    });
  });
});

