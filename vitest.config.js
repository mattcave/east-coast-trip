import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // `next build` copies src (tests included) into .next/standalone; skip it
    // so the suite doesn't run twice against stale copies.
    exclude: [...configDefaults.exclude, ".next/**"],
  },
  resolve: {
    // Mirror the @/* alias from Next.js so imports work in tests
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
