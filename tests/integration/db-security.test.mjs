// Database-boundary regression tests (RLS, triggers, RPCs, views, storage
// policies) for the 2026-09 audit fixes. Every test talks to PostgREST /
// Storage / Auth exactly like a browser holding the anon key would, so a
// hidden UI control cannot make a test pass.
//
// Run: npm run test:integration   (requires `npx supabase start`)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  anon,
  env,
  cleanup,
  createTeam,
  createUser,
  defaultEvent,
  service,
  signIn,
} from "./local-supabase.mjs";

let event;
let round;
let users = {};
let clients = {};
let teamA;
let teamB;

before(async () => {
  event = await defaultEvent();
  // Local, disposable DB: make sure team changes are allowed and sizes are permissive.
  await service
    .from("events")
    .update({ status: "published", team_size_min: 1, team_size_max: 6, team_lock_at: null, registration_close_at: new Date(Date.now() + 864e5).toISOString() })
    .eq("id", event.id);
  const { data: rounds } = await service.from("rounds").select("*").eq("event_id", event.id).order("order_index");
  round = rounds[1];

  for (const label of ["leadA", "memberA1", "memberA2", "leadB", "reviewer", "eventAdmin"]) {
    users[label] = await createUser(label);
  }
  await service.from("event_admins").insert([
    { event_id: event.id, user_id: users.reviewer.id, role: "reviewer" },
    { event_id: event.id, user_id: users.eventAdmin.id, role: "event_admin" },
  ]);

  teamA = await createTeam(event.id, [
    { role: "lead", user: users.leadA, dob: "2001-01-11", gender: "Female" },
    { role: "member", user: users.memberA1, dob: "2002-02-12" },
    { role: "member", user: users.memberA2, dob: "2003-03-13" },
  ]);
  teamB = await createTeam(event.id, [{ role: "lead", user: users.leadB }]);

  for (const label of Object.keys(users)) clients[label] = (await signIn(users[label])).client;
});

after(async () => {
  await cleanup();
});

// ---------------------------------------------------------------------------
test("BUG-002: a user cannot rewrite their own profiles.email", async () => {
  const c = clients.memberA1;
  const { error } = await c.from("profiles").update({ email: "victim@example.test" }).eq("id", users.memberA1.id);
  const { data } = await service.from("profiles").select("email").eq("id", users.memberA1.id).single();
  assert.equal(data.email, users.memberA1.email.toLowerCase(), "profiles.email must be unchanged");
  assert.ok(error, "the write must be rejected, not silently succeed");
});

test("BUG-002: a new auth account is not auto-linked to an unlinked team_members row by email", async () => {
  const victimEmail = `it-unlinked-${Date.now()}@example.test`;
  const { members } = await createTeam(event.id, [{ role: "lead", email: victimEmail }]);
  const u = await service.auth.admin.createUser({ email: victimEmail, password: "Pw-unlinked-123456", email_confirm: false });
  const { data } = await service.from("team_members").select("profile_id").eq("id", members[0].id).single();
  await service.auth.admin.deleteUser(u.data.user.id);
  assert.equal(data.profile_id, null);
});

test("BUG-009: anonymous callers cannot probe is_login_eligible", async () => {
  const { data, error } = await anon().rpc("is_login_eligible", { p_email: users.leadA.email });
  assert.ok(error, `expected an error, got data=${JSON.stringify(data)}`);
});

// ---------------------------------------------------------------------------
test("BUG-016: a teammate cannot read another member's DOB/gender/mobile; roster view is limited", async () => {
  const { data: rows } = await clients.memberA1.from("team_members").select("id, date_of_birth, gender, mobile").eq("team_id", teamA.team.id);
  const others = (rows ?? []).filter((r) => r.id !== teamA.members[1].id);
  assert.equal(others.length, 0, "only the caller's own full row may be visible");

  const { data: roster, error } = await clients.memberA1.from("team_roster").select("*").eq("team_id", teamA.team.id);
  assert.ifError(error);
  assert.equal(roster.length, 3);
  assert.ok(!("date_of_birth" in roster[0]) && !("gender" in roster[0]) && !("mobile" in roster[0]));
  const leadRowSeenByMember = roster.find((r) => r.role === "lead");
  assert.equal(leadRowSeenByMember.email, null, "members must not see the lead's email");

  const { data: rosterForLead } = await clients.leadA.from("team_roster").select("*").eq("team_id", teamA.team.id);
  assert.ok(rosterForLead.every((r) => typeof r.email === "string"), "the lead sees member emails");

  const { data: crossTeam } = await clients.leadB.from("team_roster").select("*").eq("team_id", teamA.team.id);
  assert.equal(crossTeam.length, 0, "no cross-team roster access");
});

test("BUG-019: only the lead can remove a member, via RPC, with explicit errors", async () => {
  const target = teamA.members[2];
  const denied = await clients.memberA1.rpc("lead_remove_team_member", { p_member_id: target.id });
  assert.ok(denied.error, "a non-lead must get an error, not a silent no-op");

  const leadSelf = await clients.leadA.rpc("lead_remove_team_member", { p_member_id: teamA.members[0].id });
  assert.ok(leadSelf.error, "the lead row cannot be removed");

  const crossTeam = await clients.leadB.rpc("lead_remove_team_member", { p_member_id: target.id });
  assert.ok(crossTeam.error, "another team's lead cannot remove this member");

  const direct = await clients.leadA.from("team_members").delete().eq("id", target.id).select("id");
  assert.equal((direct.data ?? []).length, 0, "direct table delete by a lead is not allowed");

  const ok = await clients.leadA.rpc("lead_remove_team_member", { p_member_id: target.id });
  assert.ifError(ok.error);
  const { data: gone } = await service.from("team_members").select("id").eq("id", target.id).maybeSingle();
  assert.equal(gone, null);
});

test("BUG-019: lead_add_team_member enforces lead + max size atomically", async () => {
  const member = {
    full_name: "Added Member",
    date_of_birth: "2004-04-04",
    education_level: "college",
    college: "Integration College",
    roll_number: `ADD-${Date.now()}`,
    email: `it-added-${Date.now()}@example.test`,
    mobile: `8${String(Date.now()).slice(-9)}`,
    whatsapp: `8${String(Date.now()).slice(-9)}`,
    whatsapp_same_as_mobile: true,
  };
  const denied = await clients.memberA1.rpc("lead_add_team_member", { p_team_id: teamA.team.id, p_member: member });
  assert.ok(denied.error);

  const { count: before } = await service.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamA.team.id);
  await service.from("events").update({ team_size_max: before + 1 }).eq("id", event.id);
  const results = await Promise.all(
    [0, 1, 2].map((i) =>
      clients.leadA.rpc("lead_add_team_member", {
        p_team_id: teamA.team.id,
        p_member: { ...member, email: `it-race-${i}-${Date.now()}@example.test`, mobile: `9${i}${String(Date.now()).slice(-8)}`, roll_number: `RACE-${i}-${Date.now()}` },
      }),
    ),
  );
  await service.from("events").update({ team_size_max: 6 }).eq("id", event.id);
  const { count } = await service.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamA.team.id);
  assert.equal(count, before + 1, "exactly one concurrent add fits under the max");
  assert.equal(results.filter((r) => !r.error).length, 1, "exactly one concurrent add succeeds; the rest are rejected");
});

test("BUG-013: lead transfer succeeds regardless of row order and keeps exactly one lead", async () => {
  for (let i = 0; i < 4; i++) {
    const lead = await createUser(`xfer-lead-${i}`);
    const mem = await createUser(`xfer-mem-${i}`);
    const t = await createTeam(event.id, [
      { role: "lead", user: lead },
      { role: "member", user: mem },
    ]);
    // Touch the lead row so its new tuple lands after the member's in the heap.
    await service.from("team_members").update({ college: "Moved College" }).eq("id", t.members[0].id);
    const leadClient = (await signIn(lead)).client;
    const r1 = await leadClient.rpc("transfer_team_lead", { p_team_id: t.team.id, p_new_lead_member_id: t.members[1].id });
    assert.ifError(r1.error);
    const memClient = (await signIn(mem)).client;
    const r2 = await memClient.rpc("transfer_team_lead", { p_team_id: t.team.id, p_new_lead_member_id: t.members[0].id });
    assert.ifError(r2.error);
    const { data } = await service.from("team_members").select("id, role").eq("team_id", t.team.id);
    assert.deepEqual(data.filter((m) => m.role === "lead").map((m) => m.id), [t.members[0].id]);
  }
});

// ---------------------------------------------------------------------------
test("BUG-007/BUG-014: base score tables are staff-only; views mask comments and exclude disqualified teams", async () => {
  const { data: score, error } = await service
    .from("final_scores")
    .insert({ round_id: round.id, team_id: teamB.team.id, judge_id: users.reviewer.id, score: 77, comments: "PRIVATE judge note" })
    .select("id")
    .single();
  assert.ifError(error);
  await service.from("publications").upsert(
    [
      { round_id: round.id, scope: "participant", is_published: true, reviewer_feedback_visible: false },
      { round_id: round.id, scope: "public", is_published: true, reviewer_feedback_visible: false },
    ],
    { onConflict: "round_id,scope" },
  );

  const { data: memberBase } = await clients.leadB.from("final_scores").select("comments, judge_id").eq("id", score.id);
  assert.equal((memberBase ?? []).length, 0, "participants must not read the base table");
  const { data: anonBase } = await anon().from("final_scores").select("comments").eq("id", score.id);
  assert.equal((anonBase ?? []).length, 0, "anonymous callers must not read the base table");

  const { data: view } = await clients.leadB.from("final_scores_participant_visible").select("*").eq("team_id", teamB.team.id);
  assert.equal(view.length, 1);
  assert.equal(view[0].comments, null);
  assert.ok(!("judge_id" in view[0]));

  const { data: pub } = await anon().from("public_round_scores").select("*").eq("team_id", teamB.team.id);
  assert.equal(pub.length, 1);
  assert.equal(Number(pub[0].average_score), 77);

  const { data: staff } = await clients.reviewer.from("final_scores").select("comments").eq("id", score.id);
  assert.equal(staff[0].comments, "PRIVATE judge note", "staff keep full access");

  await service.from("teams").update({ status: "disqualified" }).eq("id", teamB.team.id);
  const { data: pubAfter } = await anon().from("public_round_scores").select("*").eq("team_id", teamB.team.id);
  const { data: namesAfter } = await anon().from("public_scoreboard_teams").select("*").eq("id", teamB.team.id);
  await service.from("teams").update({ status: "pending" }).eq("id", teamB.team.id);
  await service.from("publications").delete().eq("round_id", round.id);
  await service.from("final_scores").delete().eq("id", score.id);
  assert.equal(pubAfter.length, 0, "disqualified teams are not publicly ranked");
  assert.equal(namesAfter.length, 0);
});

test("NEW-002: owner-privileged views are read-only (no write-through to base tables)", async () => {
  const { data: rounds } = await service.from("rounds").select("id").eq("event_id", event.id).order("order_index");
  const { data: score } = await service
    .from("final_scores")
    .insert({ round_id: rounds[2].id, team_id: teamB.team.id, judge_id: users.reviewer.id, score: 40 })
    .select("id")
    .single();
  await service.from("publications").upsert(
    [
      { round_id: rounds[2].id, scope: "public", is_published: true },
      { round_id: rounds[2].id, scope: "participant", is_published: true },
    ],
    { onConflict: "round_id,scope" },
  );
  const original = (await service.from("teams").select("team_name").eq("id", teamB.team.id).single()).data.team_name;

  const attempts = [
    ["anon rename via public_scoreboard_teams", anon().from("public_scoreboard_teams").update({ team_name: "DEFACED" }).eq("id", teamB.team.id).select()],
    ["anon delete via public_scoreboard_teams", anon().from("public_scoreboard_teams").delete().eq("id", teamB.team.id).select()],
    ["member rescore via final_scores_participant_visible", clients.leadB.from("final_scores_participant_visible").update({ score: 100 }).eq("id", score.id).select()],
    ["member edit via team_roster", clients.leadA.from("team_roster").update({ full_name: "X" }).eq("id", teamA.members[1].id).select()],
    ["member insert via team_roster", clients.leadA.from("team_roster").insert({ team_id: teamA.team.id, full_name: "X" }).select()],
  ];
  for (const [label, q] of attempts) {
    const { data, error } = await q;
    assert.ok(error || (data ?? []).length === 0, `${label} must be rejected`);
  }

  assert.equal((await service.from("teams").select("team_name").eq("id", teamB.team.id).single()).data.team_name, original);
  assert.equal((await service.from("final_scores").select("score").eq("id", score.id).single()).data.score, 40);
  await service.from("publications").delete().eq("round_id", rounds[2].id);
  await service.from("final_scores").delete().eq("id", score.id);
});

// ---------------------------------------------------------------------------
test("BUG-006: a scheduled notification is invisible to recipients until released", async () => {
  const { data: n } = await service
    .from("notifications")
    .insert({ event_id: event.id, title: "Embargoed", message: "secret", audience_type: "individual", scheduled_at: new Date(Date.now() + 36e5).toISOString(), channels: ["in_app"] })
    .select("id")
    .single();
  await service.from("notification_recipients").insert({ notification_id: n.id, profile_id: users.memberA1.id, channel: "in_app", delivery_status: "delivered" });

  const early = await clients.memberA1.from("notification_recipients").select("id, notifications(title)").eq("notification_id", n.id);
  const earlyN = await clients.memberA1.from("notifications").select("id").eq("id", n.id);
  assert.equal(early.data.length, 0, "recipient row must be hidden before release");
  assert.equal(earlyN.data.length, 0, "notification must be hidden before release");

  await service.from("notifications").update({ scheduled_at: new Date(Date.now() - 1000).toISOString() }).eq("id", n.id);
  const released = await clients.memberA1.from("notification_recipients").select("id, notifications(title)").eq("notification_id", n.id);
  assert.equal(released.data.length, 1);
  assert.equal(released.data[0].notifications.title, "Embargoed");
  await service.from("notifications").delete().eq("id", n.id);
});

// ---------------------------------------------------------------------------
test("BUG-012: policy publication is atomic and serialized", async () => {
  const label = `it-${Date.now()}`;
  const first = await clients.eventAdmin.rpc("publish_policy_version", { p_event_id: event.id, p_type: "rules", p_version: label, p_content: "v1" });
  assert.ifError(first.error);

  const dup = await clients.eventAdmin.rpc("publish_policy_version", { p_event_id: event.id, p_type: "rules", p_version: label, p_content: "dup" });
  assert.ok(dup.error, "duplicate label must fail");
  const { data: current } = await service.from("policy_versions").select("id").eq("event_id", event.id).eq("type", "rules").eq("is_current", true);
  assert.deepEqual(current.map((c) => c.id), [first.data], "the previous current version survives a failed publish");

  const results = await Promise.all(
    [1, 2, 3, 4].map((i) => clients.eventAdmin.rpc("publish_policy_version", { p_event_id: event.id, p_type: "rules", p_version: `${label}-c${i}`, p_content: `c${i}` })),
  );
  results.forEach((r) => assert.ifError(r.error));
  const { data: afterConcurrent } = await service.from("policy_versions").select("id").eq("event_id", event.id).eq("type", "rules").eq("is_current", true);
  assert.equal(afterConcurrent.length, 1);

  const reviewerTry = await clients.reviewer.rpc("publish_policy_version", { p_event_id: event.id, p_type: "rules", p_version: `${label}-r`, p_content: "x" });
  assert.ok(reviewerTry.error, "reviewers cannot publish policies");
});

// ---------------------------------------------------------------------------
test("BUG-018: participants cannot post organizer-flagged request messages", async () => {
  const { data: req, error } = await clients.memberA1
    .from("requests")
    .insert({ event_id: event.id, team_id: teamA.team.id, requester_profile_id: users.memberA1.id, type: "general", subject: "s", message: "m", status: "resolved" })
    .select("id, status")
    .single();
  assert.ifError(error);
  assert.equal(req.status, "open", "participants cannot choose a request status");

  const { data: msg, error: mErr } = await clients.memberA1
    .from("request_messages")
    .insert({ request_id: req.id, sender_profile_id: users.memberA1.id, message: "Resolved, no action needed", is_admin: true })
    .select("is_admin")
    .single();
  assert.ifError(mErr);
  assert.equal(msg.is_admin, false);

  const { data: staffMsg } = await clients.reviewer
    .from("request_messages")
    .insert({ request_id: req.id, sender_profile_id: users.reviewer.id, message: "Organizer reply" })
    .select("is_admin")
    .single();
  assert.equal(staffMsg.is_admin, true, "staff messages are flagged by the database");
});

// ---------------------------------------------------------------------------
test("BUG-023: only event admins can write branding objects for their event", async () => {
  const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" });
  const path = `${event.id}/it-${Date.now()}.png`;
  const byReviewer = await clients.reviewer.storage.from("branding").upload(path, png, { contentType: "image/png" });
  assert.ok(byReviewer.error, "reviewers cannot upload branding");
  const byParticipant = await clients.leadA.storage.from("branding").upload(path, png, { contentType: "image/png" });
  assert.ok(byParticipant.error, "participants cannot upload branding");
  const badPath = await clients.eventAdmin.storage.from("branding").upload(`not-a-uuid/x-${Date.now()}.png`, png, { contentType: "image/png" });
  assert.ok(badPath.error, "paths outside an event folder are rejected");
  const byAdmin = await clients.eventAdmin.storage.from("branding").upload(path, png, { contentType: "image/png" });
  assert.ifError(byAdmin.error);
  await service.storage.from("branding").remove([path]);
});

// ---------------------------------------------------------------------------
test("RISK-002: shared rate limiter is service-role only and enforces the window", async () => {
  const bucket = `it:${Date.now()}`;
  const denied = await clients.memberA1.rpc("rate_limit_hit", { p_bucket: bucket, p_limit: 2, p_window_seconds: 60 });
  assert.ok(denied.error, "clients cannot call the limiter");
  const outcomes = [];
  for (let i = 0; i < 3; i++) {
    const { data, error } = await service.rpc("rate_limit_hit", { p_bucket: bucket, p_limit: 2, p_window_seconds: 60 });
    assert.ifError(error);
    outcomes.push(data[0].allowed);
  }
  assert.deepEqual(outcomes, [true, true, false]);
});

test("RISK-003: revoke_user_sessions invalidates existing sessions for server-side checks", async () => {
  const u = await createUser("revoke");
  const { client } = await signIn(u);
  assert.ifError((await client.auth.getUser()).error);
  const denied = await client.rpc("revoke_user_sessions", { p_user_id: u.id });
  assert.ok(denied.error, "clients cannot call session revocation");
  const { error } = await service.rpc("revoke_user_sessions", { p_user_id: u.id });
  assert.ifError(error);
  const { error: afterError } = await client.auth.getUser();
  assert.ok(afterError, "getUser() must fail once the session is revoked");
});

test("RISK-003: an access token issued before revocation is rejected immediately (Data API + Storage)", async () => {
  const u = await createUser("revoke-access");
  const { client, session } = await signIn(u);
  const rest = (token) =>
    fetch(`${env.API_URL}/rest/v1/profiles?select=email&id=eq.${u.id}`, {
      headers: { apikey: env.ANON_KEY, Authorization: `Bearer ${token}` },
    });

  const before = await rest(session.access_token);
  assert.equal(before.status, 200);
  assert.equal((await before.json()).length, 1);

  // Revocation after an admin password change (the RISK-003 scenario).
  await service.auth.admin.updateUserById(u.id, { password: `Reset-${Date.now()}-x` });
  await service.rpc("revoke_user_sessions", { p_user_id: u.id });

  const after = await rest(session.access_token);
  assert.equal(after.status, 401, "revoked session's access token must be rejected by the Data API");
  const rpc = await client.rpc("notification_released", { nid: "00000000-0000-4000-8000-000000000000" });
  assert.ok(rpc.error, "RPCs are covered too");

  const refresh = await fetch(`${env.API_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  assert.notEqual(refresh.status, 200, "refresh token no longer works");

  // Anonymous, service-role and live sessions are unaffected.
  assert.equal((await anon().from("publications").select("id").limit(1)).error, null);
  assert.equal((await service.from("profiles").select("id").eq("id", u.id)).data.length, 1);
  assert.equal((await clients.leadA.from("teams").select("id").eq("id", teamA.team.id)).data.length, 1);
});

test("RISK-003: a revoked event admin can no longer write branding objects with an old token", async () => {
  const adminUser = await createUser("revoke-branding");
  await service.from("event_admins").insert({ event_id: event.id, user_id: adminUser.id, role: "event_admin" });
  const { client } = await signIn(adminUser);
  const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" });
  const live = await client.storage.from("branding").upload(`${event.id}/live-${Date.now()}.png`, png, { contentType: "image/png" });
  assert.ifError(live.error);
  await service.rpc("revoke_user_sessions", { p_user_id: adminUser.id });
  const stale = await client.storage.from("branding").upload(`${event.id}/stale-${Date.now()}.png`, png, { contentType: "image/png" });
  assert.ok(stale.error, "Storage write with a revoked session is rejected");
  await service.storage.from("branding").remove([live.data.path]);
});

test("BUG-005 (DB side): participants still cannot set their own verification_status directly", async () => {
  const own = teamA.members[1];
  await clients.memberA1.from("team_members").update({ verification_status: "verified" }).eq("id", own.id);
  const { data } = await service.from("team_members").select("verification_status").eq("id", own.id).single();
  assert.equal(data.verification_status, "pending");
});
