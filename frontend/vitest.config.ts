import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    reporters: "default",
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
