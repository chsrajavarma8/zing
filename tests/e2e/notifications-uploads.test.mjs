// Scheduled email dispatch (BUG-022) and direct-upload abuse cases (RISK-001,
// RISK-008) against a running local build. The app must be started with:
//   CRON_SECRET=local-test-cron-secret RESEND_API_KEY=mock-key
//   RESEND_API_URL=<mock endpoint> ORPHAN_UPLOAD_MIN_AGE_MINUTES=0
// and MOCK_RESEND_LOG pointing at the mock's JSON-lines request log.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { service, anon, createUser, createTeam, defaultEvent, cleanup, signIn } from "../integration/local-supabase.mjs";
import { sessionCookies, postJson, APP_URL } from "./harness.mjs";

const CRON_SECRET = process.env.CRON_SECRET ?? "local-test-cron-secret";
const mockLog = () => {
  try {
    return readFileSync(process.env.MOCK_RESEND_LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};
const cron = (auth = `Bearer ${CRON_SECRET}`) =>
  fetch(`${APP_URL}/api/cron/dispatch-notifications`, { headers: auth ? { Authorization: auth } : {} }).then(async (r) => ({ status: r.status, body: await r.json() }));

let event;
let round;
let leadA;
let leadB;
let cookieA;
let cookieB;
let teamA;
let teamB;

before(async () => {
  event = await defaultEvent();
  const { data: rounds } = await service.from("rounds").select("*").eq("event_id", event.id).order("order_index");
  round = rounds[0];
  await service.from("rounds").update({ is_active: true, starts_at: null, ends_at: new Date(Date.now() + 864e5).toISOString() }).eq("id", round.id);
  leadA = await createUser("up-lead-a");
  leadB = await createUser("up-lead-b");
  teamA = await createTeam(event.id, [{ role: "lead", user: leadA }]);
  teamB = await createTeam(event.id, [{ role: "lead", user: leadB }]);
  cookieA = await sessionCookies(leadA);
  cookieB = await sessionCookies(leadB);
});

after(async () => {
  for (const t of [teamA, teamB]) {
    const { data } = await service.storage.from("team-submissions").list(`${t.team.id}/${round.id}`);
    if (data?.length) await service.storage.from("team-submissions").remove(data.map((o) => `${t.team.id}/${round.id}/${o.name}`));
  }
  await cleanup();
});

// ---------------------------------------------------------------------------
test("BUG-022 (email): due scheduled emails are sent once, escaped; future ones wait; cron is secret-protected", async () => {
  const user = await createUser("mail-user");
  const mk = async (title, scheduledAt) => {
    const { data: n } = await service
      .from("notifications")
      .insert({ event_id: event.id, title, message: `Hello <script>alert(1)</script>\nLine two`, audience_type: "individual", scheduled_at: scheduledAt, channels: ["in_app", "email"] })
      .select("id")
      .single();
    await service.from("notification_recipients").insert([
      { notification_id: n.id, profile_id: user.id, channel: "in_app", delivery_status: "delivered" },
      { notification_id: n.id, profile_id: user.id, channel: "email", delivery_status: "pending" },
    ]);
    return n.id;
  };
  const due = await mk("Due now", new Date(Date.now() - 60_000).toISOString());
  const future = await mk("Later", new Date(Date.now() + 3_600_000).toISOString());

  assert.equal((await cron(null)).status, 401);
  assert.equal((await cron("Bearer wrong")).status, 401);

  const before = mockLog().length;
  const first = await cron();
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const sent = mockLog().slice(before);
  const toUser = sent.filter((m) => m.body.to === user.email.toLowerCase());
  assert.equal(toUser.length, 1, "exactly one email for the due notification");
  assert.equal(toUser[0].body.subject, "Due now");
  assert.ok(toUser[0].body.html.includes("&lt;script&gt;") && !toUser[0].body.html.includes("<script>"), "content escaped");
  assert.ok(toUser[0].body.html.includes("<br/>"), "line breaks preserved");

  const { data: dueRow } = await service.from("notifications").select("sent_at").eq("id", due).single();
  assert.ok(dueRow.sent_at, "due notification marked sent");
  const { data: emailRcpt } = await service.from("notification_recipients").select("delivery_status").eq("notification_id", due).eq("channel", "email").single();
  assert.equal(emailRcpt.delivery_status, "sent");
  const { data: futureRow } = await service.from("notifications").select("sent_at").eq("id", future).single();
  assert.equal(futureRow.sent_at, null, "future notification untouched");

  const again = mockLog().length;
  await cron();
  assert.equal(mockLog().length, again, "a second run sends nothing more");
  await service.from("notifications").delete().in("id", [due, future]);
});

// ---------------------------------------------------------------------------
const MiB = 1024 * 1024;
const pdfBytes = (size) => {
  const b = new Uint8Array(size);
  b.set(new TextEncoder().encode("%PDF-1.7\n"));
  return b;
};
const pngBytes = (size = 64) => {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b;
};
const start = (cookie, team, meta) => postJson("/api/portal/submissions/upload-url", { teamId: team.team.id, roundId: round.id, ...meta }, cookie);
const put = (path, token, bytes, type) => anon().storage.from("team-submissions").uploadToSignedUrl(path, token, new Blob([bytes], { type }), { contentType: type });
const complete = (cookie, team, path, fileName = "f") => postJson("/api/portal/submissions/complete", { teamId: team.team.id, roundId: round.id, path, fileName }, cookie);
const exists = async (path) => (await service.storage.from("team-submissions").exists(path)).data === true;

test("RISK-001: exactly 25 MiB is accepted end to end", async () => {
  const bytes = pdfBytes(25 * MiB);
  const s = await start(cookieA, teamA, { fileName: "max.pdf", fileType: "application/pdf", fileSize: bytes.length });
  assert.equal(s.status, 200);
  assert.ifError((await put(s.body.path, s.body.token, bytes, "application/pdf")).error);
  const c = await complete(cookieA, teamA, s.body.path, "max.pdf");
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const { data } = await service.from("submissions").select("file_size").eq("team_id", teamA.team.id).eq("round_id", round.id).single();
  assert.equal(Number(data.file_size), 25 * MiB);
});

test("RISK-001: oversized files are rejected whether the size is declared honestly or not", async () => {
  const honest = await start(cookieA, teamA, { fileName: "big.pdf", fileType: "application/pdf", fileSize: 25 * MiB + 1 });
  assert.equal(honest.status, 400);

  const lie = await start(cookieA, teamA, { fileName: "lie.pdf", fileType: "application/pdf", fileSize: 1024 });
  assert.equal(lie.status, 200);
  const up = await put(lie.body.path, lie.body.token, pdfBytes(25 * MiB + 4096), "application/pdf");
  assert.ok(up.error, "Storage enforces the bucket's 25 MiB limit on the signed upload");
  assert.equal(await exists(lie.body.path), false);
});

test("RISK-008: spoofed types and signatures are rejected and removed", async () => {
  const cases = [
    { name: "png-as-pdf.pdf", type: "application/pdf", bytes: pngBytes() },
    { name: "pdf-as-png.png", type: "image/png", bytes: pdfBytes(64) },
    { name: "script.pdf", type: "application/pdf", bytes: new TextEncoder().encode("<svg onload=alert(1)>") },
  ];
  for (const c of cases) {
    const s = await start(cookieA, teamA, { fileName: c.name, fileType: c.type, fileSize: c.bytes.length });
    assert.equal(s.status, 200, c.name);
    assert.ifError((await put(s.body.path, s.body.token, c.bytes, c.type)).error);
    const r = await complete(cookieA, teamA, s.body.path, c.name);
    assert.equal(r.status, 400, `${c.name} must be rejected`);
    assert.equal(await exists(s.body.path), false, `${c.name} must be deleted`);
  }
  const html = await start(cookieA, teamA, { fileName: "page.html", fileType: "text/html", fileSize: 10 });
  assert.equal(html.status, 400, "disallowed types never get an upload URL");
});

test("RISK-001: cross-team and path-tampering attempts fail", async () => {
  const crossStart = await start(cookieB, teamA, { fileName: "x.pdf", fileType: "application/pdf", fileSize: 100 });
  assert.equal(crossStart.status, 403, "team B's lead can't get an upload URL for team A");

  const s = await start(cookieA, teamA, { fileName: "mine.pdf", fileType: "application/pdf", fileSize: 64 });
  assert.ifError((await put(s.body.path, s.body.token, pdfBytes(64), "application/pdf")).error);
  const stolen = await complete(cookieB, teamB, s.body.path);
  assert.equal(stolen.status, 400, "team B can't claim team A's object");
  const crossComplete = await complete(cookieB, teamA, s.body.path);
  assert.equal(crossComplete.status, 403, "team B can't finalize for team A");
  for (const bad of [`${teamA.team.id}/${round.id}/../../x.pdf`, `${teamA.team.id}/${round.id}/sub/x.pdf`, `/${s.body.path}`]) {
    assert.equal((await complete(cookieA, teamA, bad)).status, 400, bad);
  }

  const other = await put(`${teamA.team.id}/${round.id}/elsewhere.pdf`, s.body.token, pdfBytes(64), "application/pdf");
  assert.ok(other.error, "a token only works for the path it was issued for");
});

test("RISK-001: signed upload tokens are NOT single-use; replays are contained", async () => {
  // Replay after a successful, recorded upload: the path exists, no overwrite.
  const ok = await start(cookieA, teamA, { fileName: "keep.pdf", fileType: "application/pdf", fileSize: 64 });
  assert.ifError((await put(ok.body.path, ok.body.token, pdfBytes(64), "application/pdf")).error);
  assert.equal((await complete(cookieA, teamA, ok.body.path, "keep.pdf")).status, 200);
  const overwrite = await put(ok.body.path, ok.body.token, pngBytes(), "application/pdf");
  assert.ok(overwrite.error, "cannot overwrite a recorded file with the same token");

  // Replay after a rejected upload: the token still works (verified), but the
  // new object is unreferenced, not downloadable by anyone, and cleaned up.
  const bad = await start(cookieA, teamA, { fileName: "bad.pdf", fileType: "application/pdf", fileSize: 64 });
  assert.ifError((await put(bad.body.path, bad.body.token, pngBytes(), "application/pdf")).error);
  assert.equal((await complete(cookieA, teamA, bad.body.path)).status, 400);
  const replay = await put(bad.body.path, bad.body.token, pngBytes(), "application/pdf");
  assert.equal(replay.error, null, "observed: the same signed token can upload again after the object was removed");
  assert.equal(await exists(bad.body.path), true);
  const { data: signedByUser } = await (await signIn(leadA)).client.storage.from("team-submissions").createSignedUrl(bad.body.path, 60);
  assert.equal(signedByUser, null, "participants cannot read unrecorded objects");
  const anonDownload = await anon().storage.from("team-submissions").download(bad.body.path);
  assert.ok(anonDownload.error);

  // Abandoned upload (never completed) and a finalization that fails because
  // the round closed in between.
  const abandoned = await start(cookieA, teamA, { fileName: "abandoned.pdf", fileType: "application/pdf", fileSize: 64 });
  assert.ifError((await put(abandoned.body.path, abandoned.body.token, pdfBytes(64), "application/pdf")).error);
  const late = await start(cookieA, teamA, { fileName: "late.pdf", fileType: "application/pdf", fileSize: 64 });
  assert.ifError((await put(late.body.path, late.body.token, pdfBytes(64), "application/pdf")).error);
  await service.from("rounds").update({ is_active: false }).eq("id", round.id);
  const lateComplete = await complete(cookieA, teamA, late.body.path);
  await service.from("rounds").update({ is_active: true }).eq("id", round.id);
  assert.equal(lateComplete.status, 403, "finalization refused once the round closes");
  const { data: rowAfter } = await service.from("submissions").select("document_storage_path").eq("team_id", teamA.team.id).eq("round_id", round.id).single();
  assert.equal(rowAfter.document_storage_path, ok.body.path, "the recorded submission is unchanged by the failed finalization");

  // Cleanup (secured cron) removes every unreferenced object, keeps the recorded one.
  const res = await cron();
  assert.equal(res.status, 200);
  assert.ok(res.body.orphanedUploadsRemoved >= 3, JSON.stringify(res.body));
  assert.equal(await exists(bad.body.path), false);
  assert.equal(await exists(abandoned.body.path), false);
  assert.equal(await exists(late.body.path), false);
  assert.equal(await exists(ok.body.path), true, "referenced file kept");
});
