// Controlled, one-time migration: create Supabase Auth accounts (with the
// deterministic temporary-password formula) for any already-registered
// participant who does NOT yet have an account, without touching anyone
// who already has one. Run manually - not part of deploy or registration.
//
// Usage: node scripts/migrate-temp-passwords.mjs [--event <event_id>] [--dry-run]

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
// The real implementation lives in src/lib/auth/temp-password.ts - imported
// directly (Node can run this .ts file's erasable-syntax-only source
// natively) rather than kept as a hand-maintained copy here, after that copy
// silently drifted out of sync with the real formula (2+5+MMDD here vs.
// 2+3+year in the real implementation) and produced accounts whose password
// never matched what the sign-in page told participants to compute.
import { generateTemporaryPassword } from "../src/lib/auth/temp-password.ts";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(rootDir, ".env.local");

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const eventIdx = args.indexOf("--event");
const eventId = eventIdx !== -1 ? args[eventIdx + 1] : null;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let query = supabase
  .from("team_members")
  .select("id, email, full_name, date_of_birth, teams(team_name)")
  .is("profile_id", null);
if (eventId) query = query.eq("event_id", eventId);

const { data: members, error } = await query;
if (error) {
  console.error("Failed to load team members:", error.message);
  process.exit(1);
}

console.log(`Found ${members.length} registered participant(s) without an account.${dryRun ? " (dry run)" : ""}`);

let created = 0;
let skipped = 0;
let failed = 0;

for (const m of members) {
  const teamName = m.teams?.team_name;
  if (!teamName) {
    console.warn(`- ${m.email}: skipped, no team name on file`);
    skipped++;
    continue;
  }

  let tempPassword;
  try {
    tempPassword = generateTemporaryPassword({ teamName, fullName: m.full_name, dateOfBirth: m.date_of_birth });
  } catch {
    console.warn(`- ${m.email}: skipped, invalid date of birth`);
    skipped++;
    continue;
  }

  if (dryRun) {
    console.log(`- ${m.email}: would create account`);
    created++;
    continue;
  }

  // Never overwrite an existing account - createUser fails outright if the
  // email is already registered, which is exactly the behavior we want.
  const { data, error: createError } = await supabase.auth.admin.createUser({
    email: m.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: m.full_name },
  });

  if (createError || !data.user) {
    console.warn(`- ${m.email}: failed (${createError?.message ?? "unknown error"})`);
    failed++;
    continue;
  }

  await supabase.from("profiles").update({ must_change_password: true }).eq("id", data.user.id);
  await supabase.from("team_members").update({ profile_id: data.user.id }).eq("id", m.id);
  console.log(`- ${m.email}: account created`);
  created++;
}

console.log(`\nDone. Created: ${created}, skipped: ${skipped}, failed: ${failed}.`);
console.log("No passwords were printed or logged - participants use the standard temporary-password formula.");
