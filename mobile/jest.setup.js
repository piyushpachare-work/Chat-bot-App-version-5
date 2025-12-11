import "@testing-library/jest-native/extend-expect";

jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

jest.mock("expo-crypto", () => {
  const nodeCrypto = require("crypto");
  const digestStringAsync = jest.fn(async (_algorithm, data, options) => {
    const digest = nodeCrypto.createHash("sha256").update(data).digest(
      options?.encoding?.toLowerCase() === "hex" ? "hex" : "base64"
    );
    return digest;
  });

  return {
    CryptoDigestAlgorithm: { SHA256: "SHA256" },
    CryptoEncoding: { BASE64: "BASE64" },
    digestStringAsync,
  };
});

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map();
  return {
    getItem: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

