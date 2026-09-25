import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated/local-only directories that are not application source
    // (BUG-030): nested agent worktrees (full copies of the repo) and the
    // Supabase CLI's temp output (bundled edge-runtime code).
    ".claude/**",
    "supabase/.temp/**",
    "supabase/.branches/**",
  ]),
]);

export default eslintConfig;
