// Operator script for moving existing participants off the retired
// formula-based temporary passwords (RISK-002 / BUG-010). Replaces the old
// scripts/migrate-temp-passwords.mjs, which created accounts with those
// predictable passwords.
//
// DRY RUN BY DEFAULT. Nothing is written unless you pass --apply AND
// --confirm-target <exact NEXT_PUBLIC_SUPABASE_URL>, so it can't be pointed at
// the wrong project by accident. Requires working SMTP on that project
// (invitation/recovery emails).
//
// Modes (choose one or both):
//   --invite-unlinked         Registered participants with no account yet:
//                             send a Supabase invitation and link the account.
//   --revoke-temp-passwords   Accounts still on a formula temporary password
//                             (profiles.must_change_password = true, not staff):
//                             email a recovery link, replace the password with
//                             a random one, revoke all sessions, then clear the
//                             flag so a re-run skips the account.
//
// Options:
//   --limit <n>               Process at most n accounts per mode (batching).
//   --retry-wait-ms <ms>      Wait before retrying a rate-limited email (default 65000).
//   --max-retries <n>         Retries per rate-limited email (default 3).
//
// Idempotent and safe to re-run: completed accounts are skipped; an account
// is only marked done after every step succeeded, and a failed recovery email
// leaves its password untouched. Exit code 1 if anything failed.
//
// Usage:
//   node scripts/reprovision-legacy-participants.mjs --invite-unlinked --revoke-temp-passwords
//   node scripts/reprovision-legacy-participants.mjs --revoke-temp-passwords --limit 50 --apply --confirm-target https://xyz.supabase.co
//
// Never prints passwords, tokens, keys, or email addresses (only row ids).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  for (const line of readFileSync(path.join(rootDir, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
} catch {
  // Environment may be provided directly instead of via .env.local.
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const apply = flag("--apply");
const inviteUnlinked = flag("--invite-unlinked");
const revokeTemp = flag("--revoke-temp-passwords");
const confirmTarget = option("--confirm-target", null);
const limit = Number(option("--limit", "0")) || Infinity;
const retryWaitMs = Number(option("--retry-wait-ms", "65000"));
const maxRetries = Number(option("--max-retries", "3"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

if (!url || !serviceKey || !siteUrl) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SITE_URL are required.");
  process.exit(1);
}
if (!inviteUnlinked && !revokeTemp) {
  console.error("Choose --invite-unlinked and/or --revoke-temp-passwords.");
  process.exit(1);
}
if (apply && confirmTarget !== url) {
  console.error("Refusing to write: pass --confirm-target with the exact NEXT_PUBLIC_SUPABASE_URL of the target project.");
  process.exit(1);
}

const redirectTo = `${siteUrl}/auth/set-password?flow=participant`;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
console.log(`${apply ? "APPLYING to" : "Dry run against"} ${new URL(url).host}\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isRateLimited = (error) => error && (error.status === 429 || /rate limit/i.test(error.message ?? "") || error.code === "over_email_send_rate_limit");

// Retries an email-sending call when Supabase Auth rate-limits it.
async function withEmailRetry(label, fn) {
  for (let attempt = 0; ; attempt++) {
    const result = await fn();
    if (!isRateLimited(result.error) || attempt >= maxRetries) return result;
    console.warn(`- ${label}: email rate-limited, retrying in ${Math.round(retryWaitMs / 1000)}s (${attempt + 1}/${maxRetries})`);
    await sleep(retryWaitMs);
  }
}

async function isStaff(userId) {
  const [{ data: pr, error: e1 }, { data: ea, error: e2 }] = await Promise.all([
    admin.from("platform_roles").select("user_id").eq("user_id", userId).maybeSingle(),
    admin.from("event_admins").select("id").eq("user_id", userId).limit(1),
  ]);
  if (e1 || e2) throw new Error("role lookup failed");
  return Boolean(pr) || Boolean(ea && ea.length > 0);
}

let anyFailed = false;

if (inviteUnlinked) {
  const { data: members, error } = await admin.from("team_members").select("id, email, full_name").is("profile_id", null).order("created_at");
  if (error) throw error;
  let invited = 0;
  let existing = 0;
  let failed = 0;
  let processed = 0;
  for (const m of members) {
    if (processed >= limit) break;
    const { data: existingId, error: lookupError } = await admin.rpc("auth_user_id_by_email", { p_email: m.email });
    if (lookupError) {
      failed++;
      console.warn(`- member ${m.id}: account lookup failed`);
      continue;
    }
    if (existingId) {
      existing++;
      continue; // linked automatically when the owner signs in with a confirmed email
    }
    processed++;
    if (!apply) {
      invited++;
      continue;
    }
    const { data, error: inviteError } = await withEmailRetry(`member ${m.id}`, () =>
      admin.auth.admin.inviteUserByEmail(m.email, { redirectTo, data: { full_name: m.full_name } }),
    );
    if (inviteError || !data?.user) {
      failed++;
      console.warn(`- member ${m.id}: invitation failed (${inviteError?.code ?? inviteError?.status ?? "unknown"})`);
      continue;
    }
    const { error: linkError } = await admin.from("team_members").update({ profile_id: data.user.id }).eq("id", m.id).is("profile_id", null);
    if (linkError) {
      failed++;
      console.warn(`- member ${m.id}: invited but not linked; it will be linked at the owner's first confirmed sign-in`);
      continue;
    }
    invited++;
  }
  console.log(`Unlinked participants: ${apply ? "invited" : "would invite"} ${invited}, already have an account ${existing}, failed ${failed}.`);
  anyFailed ||= failed > 0;
}

if (revokeTemp) {
  const { data: profiles, error } = await admin.from("profiles").select("id, email").eq("must_change_password", true).order("created_at");
  if (error) throw error;
  let done = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  for (const p of profiles) {
    if (processed >= limit) break;
    let staff;
    try {
      staff = await isStaff(p.id);
    } catch {
      failed++;
      console.warn(`- profile ${p.id}: could not verify roles; skipped`);
      continue;
    }
    if (staff) {
      skipped++;
      continue;
    }
    processed++;
    if (!apply) {
      done++;
      continue;
    }

    // The recovery goes to the account's verified Auth email, never to
    // profiles.email (which older migrations let users rewrite - BUG-002).
    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(p.id);
    if (userError || !authUser?.user?.email) {
      failed++;
      console.warn(`- profile ${p.id}: auth account not found; skipped`);
      continue;
    }

    // 1. Recovery email first: if it can't be sent, leave the account as is.
    const { error: recoverError } = await withEmailRetry(`profile ${p.id}`, () =>
      admin.auth.resetPasswordForEmail(authUser.user.email, { redirectTo }),
    );
    if (recoverError) {
      failed++;
      console.warn(`- profile ${p.id}: recovery email failed (${recoverError.code ?? recoverError.status ?? "unknown"}); password left unchanged`);
      continue;
    }
    // 2. Make the old (predictable) password useless, 3. end every session.
    const { error: pwError } = await admin.auth.admin.updateUserById(p.id, { password: randomBytes(32).toString("base64url") });
    if (pwError) {
      failed++;
      console.warn(`- profile ${p.id}: recovery sent, but the password could not be replaced; re-run to retry`);
      continue;
    }
    const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user_id: p.id });
    if (revokeError) {
      failed++;
      console.warn(`- profile ${p.id}: password replaced, but sessions could not be revoked; re-run to retry`);
      continue;
    }
    // 4. Mark done only now, so every partial failure above is retried by a re-run.
    const { error: flagError } = await admin.from("profiles").update({ must_change_password: false }).eq("id", p.id);
    if (flagError) {
      failed++;
      console.warn(`- profile ${p.id}: secured, but not marked done; a re-run will send one more recovery email`);
      continue;
    }
    done++;
  }
  console.log(`Temporary-password accounts: ${apply ? "secured" : "would secure"} ${done}, staff skipped ${skipped}, failed ${failed}.`);
  anyFailed ||= failed > 0;
}

// exitCode (not process.exit) lets pending HTTP sockets close cleanly.
process.exitCode = anyFailed ? 1 : 0;
