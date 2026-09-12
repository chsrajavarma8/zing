// One-time bootstrap: invite the first platform super admin.
// Usage: node scripts/invite-super-admin.mjs someone@example.com
// Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SITE_URL in .env.local.
// The invited email is granted super_admin automatically the first time
// they complete the password-setup link this script sends them.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(rootDir, ".env.local");

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/invite-super-admin.mjs someone@example.com");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const token = randomBytes(32).toString("hex");

const { error: inviteRowError } = await supabase
  .from("admin_invites")
  .insert({ email, scope: "platform", role: "super_admin", token });

if (inviteRowError) {
  console.error("Failed to create invite:", inviteRowError.message);
  process.exit(1);
}

// The role is granted only when this exact token is presented from an
// authenticated session matching this email (acceptAdminInvite) - never by
// profile creation alone.
const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/set-password?invite=${encodeURIComponent(token)}`;

const { error: sendError } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
if (sendError) {
  // Account may already exist (e.g. re-running this script) - fall back to a reset link.
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) {
    console.error("Invite row created, but could not send the setup email:", sendError.message, "/", resetError.message);
    console.error("They can still request one themselves from /forgot-password once eligible.");
    process.exit(1);
  }
}

console.log(`Invite created and a password-setup email sent to ${email}.`);
console.log("They'll be granted super_admin automatically once they set their password.");
