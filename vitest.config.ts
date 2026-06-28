import { defineConfig } from "vitest/config";

// Unit tests for pure logic (lib/*). `resolve.tsconfigPaths` makes Vite resolve
// the `@/…` alias from tsconfig.json natively, so tests import the same way app
// code does.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
