import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    // Mirror the @/* alias from Next.js so imports work in tests
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
