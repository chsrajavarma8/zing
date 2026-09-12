// Security regression tests for the 2026-09-11 audit fixes
// (0017_security_hardening.sql, 0018_admin_invite_tokens.sql).
//
// IMPORTANT: these exercise NEW behavior added by those migrations, so they
// cannot pass until the migrations are applied to the target database. They
// deliberately use the PUBLIC (anon) Supabase client for every attack
// attempt - only setup/verification steps use the service-role client - so
// that a service-role bypass never hides a real RLS/policy failure.
//
// Usage: node scripts/security-tests/run.mjs
// Requires .env.local pointed at a database with 0001-0018 applied. Creates
// and deletes its own throwaway teams/users; does not touch other data.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const envPath = path.join(rootDir, ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

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

function anonClient() {
  return createClient(URL, ANON_KEY, { auth: { persistSession: false } });
}

async function signInAs(email, password) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client, userId: data.user.id };
}

// Mirrors src/lib/auth/temp-password.ts
function tempPassword({ teamName, fullName, dateOfBirth }) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + "x".repeat(n - s.length));
  const [, mm, dd] = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  return pad(norm(teamName), 2) + pad(norm(fullName), 5) + mm + dd;
}

async function getEvent() {
  const { data } = await admin.from("events").select("id").eq("status", "published").limit(1).single();
  return data.id;
}

async function cleanupTeam(teamName) {
  const { data: team } = await admin.from("teams").select("id").eq("team_name", teamName).maybeSingle();
  if (team) await admin.from("teams").delete().eq("id", team.id);
}

async function cleanupUser(email) {
  const { data: users } = await admin.auth.admin.listUsers();
  const u = users.users.find((x) => x.email === email);
  if (u) await admin.auth.admin.deleteUser(u.id);
}

async function registerTeam(eventId, teamName, members) {
  const res = await fetch(`${SITE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId,
      teamName,
      members,
      privacyAccepted: true,
      termsAccepted: true,
      promotionalConsent: false,
      extraFields: {},
    }),
  });
  return res.json();
}

function member(role, { fullName, email, dob = "2000-01-15", roll }) {
  return {
    fullName,
    dateOfBirth: dob,
    college: "Test College",
    rollNumber: roll,
    email,
    mobile: "+919999999999",
    whatsapp: "",
    whatsappSameAsMobile: true,
    gender: "",
    role,
  };
}

async function test1_adminInviteHijack(eventId) {
  console.log("\n1. CRITICAL: participant registration must not consume a pending admin invite");
  const email = "sectest-invite-target@example.com";
  const teamName = "SecTest Invite";
  await cleanupTeam(teamName);
  await cleanupUser(email);
  await admin.from("admin_invites").delete().eq("email", email);

  const token = "test-token-" + Math.random().toString(36).slice(2);
  await admin.from("admin_invites").insert({ email, scope: "platform", role: "super_admin", token });

  const result = await registerTeam(eventId, teamName, [member("lead", { fullName: "Attacker Person", email, roll: "SEC-001" })]);
  check("registration succeeded (account created)", !!result.team, JSON.stringify(result));

  const { data: roles } = await admin.from("platform_roles").select("*").eq("user_id", (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === email)?.id ?? "");
  check("no platform_roles row was granted", !roles || roles.length === 0, JSON.stringify(roles));

  const { data: invite } = await admin.from("admin_invites").select("consumed_at").eq("token", token).single();
  check("invite remains unconsumed", invite.consumed_at === null);

  await cleanupTeam(teamName);
  await cleanupUser(email);
  await admin.from("admin_invites").delete().eq("token", token);
}

async function test2_selfPromotion(eventId) {
  console.log("\n2. HIGH: participant must not self-promote member -> lead");
  const teamName = "SecTest Promo";
  const leadEmail = "sectest-promo-lead@example.com";
  const memberEmail = "sectest-promo-member@example.com";
  await cleanupTeam(teamName);
  await cleanupUser(leadEmail);
  await cleanupUser(memberEmail);

  const dob = "2000-06-01";
  await registerTeam(eventId, teamName, [
    member("lead", { fullName: "Lead Person", email: leadEmail, dob, roll: "SEC-010" }),
    member("member", { fullName: "Member Person", email: memberEmail, dob, roll: "SEC-011" }),
  ]);

  const memberPw = tempPassword({ teamName, fullName: "Member Person", dateOfBirth: dob });
  const { client } = await signInAs(memberEmail, memberPw);

  const { data: myRow } = await client.from("team_members").select("id, role").eq("email", memberEmail).single();
  check("starts as member", myRow.role === "member");

  await client.from("team_members").update({ role: "lead" }).eq("id", myRow.id);
  const { data: after } = await admin.from("team_members").select("role").eq("id", myRow.id).single();
  check("role unchanged after direct client update attempt", after.role === "member", `role is now ${after.role}`);

  await cleanupTeam(teamName);
  await cleanupUser(leadEmail);
  await cleanupUser(memberEmail);
}

async function test3_mandatoryChangeBlocksMutation(eventId) {
  console.log("\n3. HIGH: temp-password session must be blocked from protected mutations (server boundary)");
  const teamName = "SecTest Gate";
  const email = "sectest-gate-lead@example.com";
  await cleanupTeam(teamName);
  await cleanupUser(email);

  const dob = "2000-03-20";
  await registerTeam(eventId, teamName, [member("lead", { fullName: "Gate Person", email, dob, roll: "SEC-020" })]);
  const pw = tempPassword({ teamName, fullName: "Gate Person", dateOfBirth: dob });

  const { data: signIn } = await anonClient().auth.signInWithPassword({ email, password: pw });
  check("temp-password sign-in succeeds", !!signIn.session);

  const res = await fetch(`${SITE_URL}/api/exam/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${signIn.session.access_token}` },
    body: JSON.stringify({ examId: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  check("exam start rejected before password change", res.status === 403, `status=${res.status} body=${JSON.stringify(body)}`);

  await cleanupTeam(teamName);
  await cleanupUser(email);
}

async function test5_existingAccountNotAutoLinked(eventId) {
  console.log("\n5. HIGH: registering with an email that already has an account must not auto-link it");
  const teamName = "SecTest Existing";
  const email = "sectest-existing@example.com";
  await cleanupTeam(teamName);
  await cleanupUser(email);

  // Pre-create a real, unrelated account for this email (simulates a
  // returning user with their own private password).
  await admin.auth.admin.createUser({ email, password: "TheirOwnRealPassword123", email_confirm: true });

  await registerTeam(eventId, teamName, [member("lead", { fullName: "Existing Person", email, roll: "SEC-030" })]);

  const { data: tm } = await admin.from("team_members").select("profile_id").eq("email", email).eq("team_id", (await admin.from("teams").select("id").eq("team_name", teamName).single()).data.id).single();
  check("profile_id NOT set at registration time", tm.profile_id === null, `profile_id=${tm.profile_id}`);

  await cleanupTeam(teamName);
  await cleanupUser(email);
}

async function test6_submissionSelfAcceptBlocked(eventId) {
  console.log("\n6. HIGH: team lead must not self-accept their own submission via direct write");
  const teamName = "SecTest Submission";
  const email = "sectest-submission-lead@example.com";
  await cleanupTeam(teamName);
  await cleanupUser(email);

  const dob = "2000-08-08";
  await registerTeam(eventId, teamName, [member("lead", { fullName: "Sub Person", email, dob, roll: "SEC-040" })]);
  const pw = tempPassword({ teamName, fullName: "Sub Person", dateOfBirth: dob });
  const { client, userId } = await signInAs(email, pw);

  // Clear the mandatory-change flag directly (service role) so this test
  // isolates the submission-review bypass, not the onboarding gate.
  await admin.from("profiles").update({ must_change_password: false }).eq("id", userId);
  await admin.from("team_members").update({ verification_status: "verified" }).eq("profile_id", userId);

  const { data: team } = await admin.from("teams").select("id, event_id").eq("team_name", teamName).single();
  const { data: round } = await admin.from("rounds").select("id").eq("event_id", team.event_id).limit(1).maybeSingle();
  if (!round) {
    console.log("  SKIP  no round configured for this event - cannot exercise submissions RLS");
    await cleanupTeam(teamName);
    await cleanupUser(email);
    return;
  }

  await client
    .from("submissions")
    .upsert({ team_id: team.id, round_id: round.id, drive_folder_url: "https://drive.google.com/drive/folders/test", public_access_self_confirmed: true }, { onConflict: "team_id,round_id" });

  await client.from("submissions").update({ review_status: "accepted", reviewer_notes: "self-accepted" }).eq("team_id", team.id).eq("round_id", round.id);

  const { data: sub } = await admin.from("submissions").select("review_status, reviewer_notes").eq("team_id", team.id).eq("round_id", round.id).single();
  check("review_status not self-accepted", sub.review_status !== "accepted", `review_status=${sub.review_status}`);
  check("reviewer_notes not self-set", sub.reviewer_notes !== "self-accepted", `reviewer_notes=${sub.reviewer_notes}`);

  await cleanupTeam(teamName);
  await cleanupUser(email);
}

async function main() {
  const eventId = await getEvent();
  console.log(`Running security regression tests against event ${eventId}`);
  console.log("These require 0017_security_hardening.sql and 0018_admin_invite_tokens.sql to be applied first.\n");

  try {
    await test1_adminInviteHijack(eventId);
    await test2_selfPromotion(eventId);
    await test3_mandatoryChangeBlocksMutation(eventId);
    await test5_existingAccountNotAutoLinked(eventId);
    await test6_submissionSelfAcceptBlocked(eventId);
  } catch (err) {
    console.error("\nTest run aborted with an error:", err.message);
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
