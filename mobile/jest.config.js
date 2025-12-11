module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(expo|@expo|@react-native|react-native|@react-navigation|expo-auth-session|expo-linking|expo-secure-store|@react-native-async-storage)/)",
  ],
};

