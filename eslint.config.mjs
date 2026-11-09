import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Locally installed agent skills and settings, not app code. Their
    // bundled asset scripts trip react-hooks rules (e.g. a non-hook named
    // useFallback) and would fail `npm run lint`.
    ".agents/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
