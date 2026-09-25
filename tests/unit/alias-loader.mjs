// Test-only module resolution for running pure src/lib modules under Node's
// built-in TypeScript stripping: maps "@/x" to src/x and resolves
// extensionless relative imports to .ts files. Registered via --import.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = ${JSON.stringify(process.cwd())};
function candidates(base) { return [base, base + ".ts", base + ".tsx", path.join(base, "index.ts")]; }
export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith("@/")) base = path.join(root, "src", specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !path.extname(specifier)) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    for (const c of candidates(base)) if (existsSync(c) && !c.endsWith(path.sep)) {
      try { if ((await import("node:fs")).statSync(c).isFile()) return next(pathToFileURL(c).href, context); } catch {}
    }
  }
  return next(specifier, context);
}
`),
);
