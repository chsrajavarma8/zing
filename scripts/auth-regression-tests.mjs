// Offline regression tests for participant authentication - no network, no
// Supabase project, no dev server required. Run with:
//   node scripts/auth-regression-tests.mjs
//
// These exist because of a real incident: scripts/migrate-temp-passwords.mjs
// and scripts/security-tests/run.mjs each kept a hand-written copy of the
// temporary-password formula (comment: "kept in sync manually"), and that
// copy silently drifted from the real implementation in
// src/lib/auth/temp-password.ts (2 letters + 5 letters + MMDD vs. the real
// 2 letters + 3 letters + 4-digit year). Every account either script touched
// ended up with a password that didn't match what the sign-in page told the
// participant to compute - a real, reported "can't sign in" support case.
// Both scripts now import generateTemporaryPassword directly instead of
// re-implementing it (Node can run this repo's .ts sources natively, since
// they only use erasable TypeScript syntax - no build step needed).
//
// Test 1 locks the canonical formula's documented behavior in place so a
// future change to temp-password.ts itself doesn't silently break the
// examples participants are shown. Test 2 is the guard against the original
// incident recurring: it fails the moment any script under scripts/ starts
// hand-rolling the formula again instead of importing it.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateTemporaryPassword,
  InvalidDateOfBirthError,
} from "../src/lib/auth/temp-password.ts";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = rootDir;

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? " - " + detail : ""}`);
  }
}

function test1_canonicalFormula() {
  console.log("\n1. generateTemporaryPassword formula stays as documented on the sign-in page");

  check(
    "documented example: team Zing, name Rajavarma, born 1998",
    generateTemporaryPassword({ teamName: "Zing", fullName: "Rajavarma", dateOfBirth: "1998-09-14" }) === "ziraj1998",
  );

  check(
    "spaces and punctuation are stripped before taking letters",
    generateTemporaryPassword({ teamName: "Team #1", fullName: "A B C", dateOfBirth: "2005-01-01" }) === "teabc2005",
  );

  check(
    "short team/name parts are padded with x, not guessed at",
    generateTemporaryPassword({ teamName: "A", fullName: "Al", dateOfBirth: "2000-05-05" }) === "axalx2000",
  );

  check(
    "uppercase input is lowercased",
    generateTemporaryPassword({ teamName: "ZING", fullName: "RAJAVARMA", dateOfBirth: "1998-09-14" }) === "ziraj1998",
  );

  let threw = false;
  try {
    generateTemporaryPassword({ teamName: "Zing", fullName: "Rajavarma", dateOfBirth: "2024-02-30" });
  } catch (err) {
    threw = err instanceof InvalidDateOfBirthError;
  }
  check("an impossible calendar date (e.g. Feb 30) is rejected, not silently rolled forward", threw);
}

function test2_noReimplementation() {
  console.log("\n2. no script re-implements the temp-password formula instead of importing it");

  // Anything that smells like the formula's building blocks (letter
  // normalization, x-padding, or hand-rolling teamPart/namePart/year) outside
  // the canonical file itself is exactly how this drifted silently last time.
  const suspiciousPatterns = [/replace\(\/\[\^a-z\]/i, /repeat\(.*length.*-/i, /"x"\.repeat/];

  const canonicalFile = path.join(rootDir, "..", "src", "lib", "auth", "temp-password.ts");
  const candidates = readdirSync(scriptsDir, { recursive: true })
    .filter((f) => f.endsWith(".mjs") || f.endsWith(".js"))
    .map((f) => path.join(scriptsDir, f));

  for (const file of candidates) {
    if (path.resolve(file) === path.resolve(canonicalFile)) continue;
    const contents = readFileSync(file, "utf8");
    const relative = path.relative(path.join(rootDir, ".."), file);
    const matched = suspiciousPatterns.some((p) => p.test(contents));
    check(`${relative} does not hand-roll the temp-password formula`, !matched);
  }
}

test1_canonicalFormula();
test2_noReimplementation();

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
