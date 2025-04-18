/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node", "d.ts"],
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": [
      "ts-jest",
      { tsconfig: "tsconfig.json", isolatedModules: false },
    ],
  },
  coverageProvider: "v8",
  moduleDirectories: ["node_modules", "src"],
}
