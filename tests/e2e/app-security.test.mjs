// End-to-end regression tests against a running production build (see
// harness.mjs). Covers server-action authorization, false-success handling,
// onboarding/identity flows, uploads, and rendered-page behavior.
//
// Run: npm run test:e2e   (requires `npx supabase start` and the app built +
// started against the local stack - see docs/SECURITY-FIXES-2026-09.md)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { service, createUser, createTeam, defaultEvent, cleanup, signIn, anon } from "../integration/local-supabase.mjs";
import { callAction, sessionCookies, getPage, postJson, APP_URL } from "./harness.mjs";

let event;
let round;
const u = {};
const c = {};
let team;
let legacyPassword;

before(async () => {
  event = await defaultEvent();
  await service
    .from("events")
    .update({ status: "published", team_size_min: 1, team_size_max: 6, team_lock_at: null, registration_open_at: null, registration_close_at: new Date(Date.now() + 864e5).toISOString() })
    .eq("id", event.id);
  const { data: rounds } = await service.from("rounds").select("*").eq("event_id", event.id).order("order_index");
  round = rounds[0];
  await service.from("rounds").update({ is_active: true, starts_at: null, ends_at: new Date(Date.now() + 864e5).toISOString() }).eq("id", round.id);

  for (const label of ["lead", "member", "legacy", "reviewer", "eventAdmin", "outsider"]) u[label] = await createUser(`e2e-${label}`);
  await service.from("event_admins").insert([
    { event_id: event.id, user_id: u.reviewer.id, role: "reviewer" },
    { event_id: event.id, user_id: u.eventAdmin.id, role: "event_admin" },
  ]);
  // A legacy participant still on a known temporary password.
  legacyPassword = u.legacy.password;
  await service.from("profiles").update({ must_change_password: true }).eq("id", u.legacy.id);

  team = await createTeam(event.id, [
    { role: "lead", user: u.lead },
    { role: "member", user: u.member },
    { role: "member", user: u.legacy },
  ]);
  for (const label of ["lead", "member", "reviewer", "eventAdmin", "outsider"]) c[label] = await sessionCookies(u[label]);
});

after(async () => {
  await service.storage.from("team-submissions").remove([`${team.team.id}/${round.id}/e2e.pdf`]);
  await cleanup();
});

const TEAM_ACTIONS = "src/app/portal/team/actions.ts";
const SUBMISSION_ACTIONS = "src/app/portal/submission/actions.ts";

async function auditCount(actor) {
  const { count } = await service.from("audit_logs").select("id", { count: "exact", head: true }).eq("actor_profile_id", actor);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
test("BUG-001: renameTeam is lead-only and never touches anyone's password", async () => {
  const before = (await service.from("teams").select("team_name").eq("id", team.team.id).single()).data.team_name;

  const asMember = await callAction({ file: TEAM_ACTIONS, name: "renameTeam", pagePath: "/portal/team", args: [team.team.id, "Hijacked"], cookie: c.member });
  assert.equal(asMember.ok, false);
  const asAnon = await callAction({ file: TEAM_ACTIONS, name: "renameTeam", pagePath: "/portal/team", args: [team.team.id, "Hijacked"] });
  assert.notEqual(asAnon.ok, true);
  const asOutsider = await callAction({ file: TEAM_ACTIONS, name: "renameTeam", pagePath: "/portal/team", args: [team.team.id, "Hijacked"], cookie: c.outsider });
  assert.equal(asOutsider.ok, false);
  assert.equal((await service.from("teams").select("team_name").eq("id", team.team.id).single()).data.team_name, before);

  const asLead = await callAction({ file: TEAM_ACTIONS, name: "renameTeam", pagePath: "/portal/team", args: [team.team.id, "Renamed By Lead"], cookie: c.lead });
  assert.equal(asLead.ok, true);
  assert.equal((await service.from("teams").select("team_name").eq("id", team.team.id).single()).data.team_name, "Renamed By Lead");

  // The legacy member's password was not reset by any of this.
  const { error } = await anon().auth.signInWithPassword({ email: u.legacy.email, password: legacyPassword });
  assert.ifError(error);
});

test("BUG-019: non-leads get errors (not false success) for member removal and delegation", async () => {
  const remove = await callAction({ file: TEAM_ACTIONS, name: "removeTeamMember", pagePath: "/portal/team", args: [team.members[2].id], cookie: c.member });
  assert.equal(remove.ok, false);
  const delegate = await callAction({ file: TEAM_ACTIONS, name: "setSubmissionDelegate", pagePath: "/portal/team", args: [team.team.id, team.members[1].id], cookie: c.member });
  assert.equal(delegate.ok, false);
  const { data } = await service.from("teams").select("submission_delegate_member_id").eq("id", team.team.id).single();
  assert.equal(data.submission_delegate_member_id, null);
  const { count } = await service.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", team.team.id);
  assert.equal(count, 3);
});

// ---------------------------------------------------------------------------
test("BUG-025: an empty document link can't create an empty submission", async () => {
  const res = await callAction({ file: SUBMISSION_ACTIONS, name: "saveDocumentLink", pagePath: "/portal/submission", args: [team.team.id, round.id, ""], cookie: c.lead });
  assert.equal(res.ok, false);
  const { data } = await service.from("submissions").select("id").eq("team_id", team.team.id).eq("round_id", round.id);
  assert.equal(data.length, 0);
});

test("BUG-003: a non-lead member cannot delete the team's submission file", async () => {
  const path = `${team.team.id}/${round.id}/e2e.pdf`;
  await service.storage.from("team-submissions").upload(path, new Blob([new TextEncoder().encode("%PDF-1.4 test")], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
  const { data: sub } = await service
    .from("submissions")
    .insert({ team_id: team.team.id, round_id: round.id, document_storage_path: path, file_name: "e2e.pdf", submitted_by: u.lead.id })
    .select("id")
    .single();

  const res = await callAction({ file: SUBMISSION_ACTIONS, name: "deleteSubmission", pagePath: "/portal/submission", args: [sub.id, team.team.id, round.id], cookie: c.member });
  assert.equal(res.ok, false);
  const exists = await service.storage.from("team-submissions").exists(path);
  assert.equal(exists.data, true, "the file must still exist");
  assert.ok((await service.from("submissions").select("id").eq("id", sub.id).maybeSingle()).data, "the row must still exist");

  const byLead = await callAction({ file: SUBMISSION_ACTIONS, name: "deleteSubmission", pagePath: "/portal/submission", args: [sub.id, team.team.id, round.id], cookie: c.lead });
  assert.equal(byLead.ok, true);
  assert.equal((await service.storage.from("team-submissions").exists(path)).data, false);
});

test("RISK-001/RISK-008: signed direct uploads are authorized and content-verified", async () => {
  const start = (cookie, file) => postJson("/api/portal/submissions/upload-url", { teamId: team.team.id, roundId: round.id, fileName: file.name, fileType: file.type, fileSize: file.size }, cookie);
  const upload = async (cookie, file, bytes) => {
    const s = await start(cookie, file);
    if (s.status !== 200) return { stage: "start", ...s };
    const put = await anon().storage.from("team-submissions").uploadToSignedUrl(s.body.path, s.body.token, new Blob([bytes], { type: file.type }), { contentType: file.type });
    if (put.error) return { stage: "put", error: put.error.message };
    const done = await postJson("/api/portal/submissions/complete", { teamId: team.team.id, roundId: round.id, path: s.body.path, fileName: file.name }, cookie);
    return { stage: "complete", path: s.body.path, ...done };
  };

  const denied = await start(c.member, { name: "a.pdf", type: "application/pdf", size: 10 });
  assert.equal(denied.status, 403, "non-lead/non-delegate members can't get upload URLs");
  const wrongType = await start(c.lead, { name: "a.exe", type: "application/pdf", size: 10 });
  assert.equal(wrongType.status, 400);

  const fake = await upload(c.lead, { name: "fake.pdf", type: "application/pdf", size: 20 }, new TextEncoder().encode("<html><script>x</script>"));
  assert.equal(fake.stage, "complete");
  assert.equal(fake.status, 400, "content that isn't a PDF is rejected");
  assert.equal((await service.storage.from("team-submissions").exists(fake.path)).data, false, "rejected objects are deleted");

  // 6 MB - above the 4.5 MB serverless request-body limit the old route hit.
  const big = new Uint8Array(6 * 1024 * 1024);
  big.set(new TextEncoder().encode("%PDF-1.7\n"));
  const ok = await upload(c.lead, { name: "big.pdf", type: "application/pdf", size: big.length }, big);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const { data: row } = await service.from("submissions").select("document_storage_path, file_size, mime_type").eq("team_id", team.team.id).eq("round_id", round.id).single();
  assert.equal(row.document_storage_path, ok.path);
  assert.equal(Number(row.file_size), big.length);
  await service.from("submissions").delete().eq("team_id", team.team.id).eq("round_id", round.id);
  await service.storage.from("team-submissions").remove([ok.path]);
});

// ---------------------------------------------------------------------------
test("BUG-011: admin actions reject participants and write no audit entries", async () => {
  const before = await auditCount(u.lead.id);
  const status = await callAction({
    file: "src/app/admin/registrations/[teamId]/actions.ts",
    name: "setTeamStatus",
    pagePath: `/admin/registrations/${team.team.id}`,
    args: [team.team.id, event.id, "verified"],
    cookie: c.lead,
  });
  assert.equal(status.ok, false);
  const evt = await callAction({ file: "src/app/admin/events/actions.ts", name: "updateEvent", pagePath: "/admin/events", args: [event.id, { name: "Pwned" }], cookie: c.lead });
  assert.equal(evt.ok, false);
  const byReviewer = await callAction({ file: "src/app/admin/events/actions.ts", name: "updateEvent", pagePath: "/admin/events", args: [event.id, { name: "Pwned" }], cookie: c.reviewer });
  assert.equal(byReviewer.ok, false, "reviewers can't change event settings");
  assert.equal(await auditCount(u.lead.id), before, "no forged audit entries");
  assert.equal((await service.from("events").select("name").eq("id", event.id).single()).data.name, event.name);

  const ok = await callAction({ file: "src/app/admin/registrations/[teamId]/actions.ts", name: "setTeamStatus", pagePath: `/admin/registrations/${team.team.id}`, args: [team.team.id, event.id, "verified"], cookie: c.eventAdmin });
  assert.equal(ok.ok, true);
  await service.from("teams").update({ status: "pending" }).eq("id", team.team.id);
});

test("BUG-020: reviewers can't edit content; the page renders read-only", async () => {
  const { count: before } = await service.from("faqs").select("id", { count: "exact", head: true }).eq("event_id", event.id);
  const res = await callAction({ file: "src/app/admin/content/actions.ts", name: "upsertFaq", pagePath: "/admin/content", args: [event.id, { question: "Q?", answer: "A", orderIndex: 0, published: true }], cookie: c.reviewer });
  assert.equal(res.ok, false);
  const { count: after } = await service.from("faqs").select("id", { count: "exact", head: true }).eq("event_id", event.id);
  assert.equal(after, before);
  const page = await getPage("/admin/content", c.reviewer);
  assert.equal(page.status, 200);
  assert.match(page.text, /read-only access/);
});

test("BUG-018: participants can't use the organizer reply action", async () => {
  const { data: req } = await service
    .from("requests")
    .insert({ event_id: event.id, team_id: team.team.id, requester_profile_id: u.member.id, type: "general", subject: "s", message: "m" })
    .select("id")
    .single();
  const res = await callAction({ file: "src/app/admin/requests/actions.ts", name: "replyToRequest", pagePath: "/admin/requests", args: [req.id, event.id, "Resolved!", "resolved"], cookie: c.member });
  assert.equal(res.ok, false);
  const { data: msgs } = await service.from("request_messages").select("id").eq("request_id", req.id);
  assert.equal(msgs.length, 0);
});

test("BUG-006: an already-released scheduled notification can't be cancelled", async () => {
  const { data: n } = await service
    .from("notifications")
    .insert({ event_id: event.id, title: "Due", message: "m", audience_type: "all", scheduled_at: new Date(Date.now() - 60_000).toISOString(), channels: ["in_app"] })
    .select("id")
    .single();
  const res = await callAction({ file: "src/app/admin/notifications/actions.ts", name: "cancelScheduledNotification", pagePath: "/admin/notifications", args: [n.id, event.id], cookie: c.eventAdmin });
  assert.equal(res.ok, false);
  assert.ok((await service.from("notifications").select("id").eq("id", n.id).maybeSingle()).data);
  await service.from("notifications").delete().eq("id", n.id);
});

// ---------------------------------------------------------------------------
test("BUG-008: the login action never returns an external redirect", async () => {
  const ext = await callAction({ file: "src/app/login/actions.ts", name: "signIn", pagePath: "/login", args: [u.outsider.email, u.outsider.password, "https://evil.example/phish"] });
  assert.equal(ext.ok, true);
  assert.ok(ext.redirectTo.startsWith("/") && !ext.redirectTo.startsWith("//"), ext.redirectTo);
  const internal = await callAction({ file: "src/app/login/actions.ts", name: "signIn", pagePath: "/login", args: [u.outsider.email, u.outsider.password, "/portal/team"] });
  assert.equal(internal.redirectTo, "/portal/team");
});

test("BUG-005/RISK-003: legacy password change marks the member verified and revokes older sessions", async () => {
  const older = await signIn({ email: u.legacy.email, password: legacyPassword });
  const cookie = await sessionCookies({ email: u.legacy.email, password: legacyPassword });
  const newPassword = `New-${randomUUID()}`;
  const res = await callAction({ file: "src/app/change-password/actions.ts", name: "completeMandatoryPasswordChange", pagePath: "/change-password", args: [newPassword], cookie });
  assert.equal(res.ok, true, JSON.stringify(res));

  const { data: member } = await service.from("team_members").select("verification_status").eq("id", team.members[2].id).single();
  assert.equal(member.verification_status, "verified");
  const { data: profile } = await service.from("profiles").select("must_change_password").eq("id", u.legacy.id).single();
  assert.equal(profile.must_change_password, false);
  const { error } = await older.client.auth.getUser();
  assert.ok(error, "a session opened with the temporary password is revoked");
  u.legacy.password = newPassword;
});

test("BUG-015: password setup refuses a session that isn't the link's account", async () => {
  const res = await callAction({ file: "src/app/auth/set-password/actions.ts", name: "completePasswordSetup", pagePath: "/auth/set-password", args: ["Another-Password-1", u.outsider.id], cookie: c.lead });
  assert.equal(res.ok, false);
  assert.ifError((await anon().auth.signInWithPassword({ email: u.lead.email, password: u.lead.password })).error, "lead's password unchanged");
});

// ---------------------------------------------------------------------------
test("BUG-010/BUG-026: registration sends invitations and validates custom fields", async () => {
  const fieldKey = `it_${randomUUID().slice(0, 6)}`;
  const { data: field } = await service
    .from("registration_fields")
    .insert({ event_id: event.id, key: fieldKey, label: "Portfolio", field_type: "text", required: true, active: true })
    .select("id")
    .single();

  const email = `e2e-reg-${randomUUID().slice(0, 8)}@example.test`;
  const payload = (extraFields) => ({
    eventId: event.id,
    teamName: `E2E ${randomUUID().slice(0, 6)}`,
    members: [
      {
        fullName: "Reg Lead",
        dateOfBirth: "2004-01-02",
        educationLevel: "college",
        college: "Reg College",
        rollNumber: `REG-${randomUUID().slice(0, 6)}`,
        classGrade: "",
        email,
        mobile: `6${String(Date.now()).slice(-9)}`,
        whatsapp: "",
        whatsappSameAsMobile: true,
        gender: "",
        role: "lead",
      },
    ],
    privacyAccepted: true,
    termsAccepted: true,
    promotionalConsent: false,
    extraFields,
  });

  const missing = await postJson("/api/register", payload({}));
  assert.equal(missing.status, 422);

  const ok = await postJson("/api/register", payload({ [fieldKey]: "https://example.test", injected: "<script>" }));
  await service.from("registration_fields").delete().eq("id", field.id);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.members[0].accountStatus, "invited");

  const { data: teamRow } = await service.from("teams").select("id, extra_fields").eq("reference_id", ok.body.team.referenceId).single();
  assert.deepEqual(teamRow.extra_fields, { [fieldKey]: "https://example.test" }, "unknown keys are dropped");

  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  const created = users.users.find((x) => x.email === email);
  assert.ok(created, "an invited account exists");
  assert.equal(created.email_confirmed_at ?? null, null, "the address is NOT confirmed on the registrant's behalf");
  const { error: guess } = await anon().auth.signInWithPassword({ email, password: "reregl2004" });
  assert.ok(guess, "no formula-derived password works");

  await service.from("teams").delete().eq("id", teamRow.id);
  await service.auth.admin.deleteUser(created.id);
});

// ---------------------------------------------------------------------------
test("BUG-029: malformed and out-of-range pages render safely", async () => {
  const bad = await getPage("/admin/registrations?page=abc", c.eventAdmin);
  assert.equal(bad.status, 200);
  assert.match(bad.text, /teams registered/);
  const far = await getPage("/admin/registrations?page=9999", c.eventAdmin);
  assert.equal(far.status, 200);
  assert.match(far.text, /past the end of the results/);
});

test("BUG-027 / BUG-016: dashboard shows team status; roster HTML carries no teammate PII", async () => {
  const cookie = await sessionCookies(u.member);
  const page = await getPage("/portal", cookie);
  assert.equal(page.status, 200);
  assert.match(page.text, /Team registration/);
  assert.match(page.text, /Pending review|Verified/);
  const teamPage = await getPage("/portal/team", cookie);
  assert.ok(!teamPage.text.includes(u.lead.email.toLowerCase()), "members don't see the lead's email");
});

test("BUG-024 / RISK-005: security headers and no-JS reveal fallback", async () => {
  const home = await getPage("/");
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.match(home.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(home.headers.get("x-powered-by"), null);
  assert.match(home.text, /<noscript><style>\[data-reveal\]/);
  assert.ok(APP_URL);
});
