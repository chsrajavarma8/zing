// Tests scripts/reprovision-legacy-participants.mjs against the LOCAL stack
// with disposable legacy fixtures: dry run, targeting guard, invitations,
// temp-password remediation (email -> random password -> session revocation
// -> done marker), idempotent re-runs, rate-limit retries, and partial
// failures. A small proxy in front of the local API injects Auth errors.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { env, service, anon, createUser, createTeam, defaultEvent, cleanup, signIn } from "./local-supabase.mjs";

const MAILPIT = "http://127.0.0.1:54324";
let proxy;
let proxyUrl;
const faults = { recover429: 0, recover500ForEmail: null };

async function mailsTo(address) {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  return (await r.json()).messages_count ?? 0;
}

function runScript(args, targetUrl = proxyUrl) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/reprovision-legacy-participants.mjs", ...args], {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: targetUrl,
        SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

let legacyA;
let legacyB;
let staffTemp;
let unlinkedEmail;
let sessionA;

before(async () => {
  // Fault-injecting proxy in front of the local API gateway.
  proxy = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      if (req.url.startsWith("/auth/v1/recover")) {
        if (faults.recover429 > 0) {
          faults.recover429--;
          res.writeHead(429, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" }));
        }
        if (faults.recover500ForEmail && body.toString().includes(faults.recover500ForEmail)) {
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ code: 500, msg: "injected failure" }));
        }
      }
      const upstream = http.request(
        { host: "127.0.0.1", port: new URL(env.API_URL).port, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${new URL(env.API_URL).port}` } },
        (up) => {
          res.writeHead(up.statusCode, up.headers);
          up.pipe(res);
        },
      );
      upstream.end(body);
    });
  });
  await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
  proxyUrl = `http://127.0.0.1:${proxy.address().port}`;

  const event = await defaultEvent();
  legacyA = await createUser("legacy-a");
  legacyB = await createUser("legacy-b");
  staffTemp = await createUser("legacy-staff");
  await service.from("profiles").update({ must_change_password: true }).in("id", [legacyA.id, legacyB.id, staffTemp.id]);
  await service.from("event_admins").insert({ event_id: event.id, user_id: staffTemp.id, role: "reviewer" });
  unlinkedEmail = `it-unlinked-legacy-${randomUUID().slice(0, 8)}@example.test`;
  await createTeam(event.id, [
    { role: "lead", user: legacyA },
    { role: "member", user: legacyB },
    { role: "member", email: unlinkedEmail },
  ]);
  sessionA = await signIn(legacyA);
});

after(async () => {
  proxy.close();
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  const invited = users.users.find((u) => u.email === unlinkedEmail);
  if (invited) await service.auth.admin.deleteUser(invited.id);
  await cleanup();
});

test("dry run changes nothing and sends nothing", async () => {
  const before = await mailsTo(legacyA.email);
  const { code, out } = await runScript(["--invite-unlinked", "--revoke-temp-passwords"]);
  assert.equal(code, 0, out);
  assert.match(out, /Dry run/);
  assert.match(out, /would secure/);
  assert.equal(await mailsTo(legacyA.email), before);
  assert.ifError((await anon().auth.signInWithPassword({ email: legacyA.email, password: legacyA.password })).error);
  assert.equal((await service.from("profiles").select("must_change_password").eq("id", legacyA.id).single()).data.must_change_password, true);
});

test("--apply requires the exact target URL", async () => {
  const missing = await runScript(["--revoke-temp-passwords", "--apply"]);
  assert.equal(missing.code, 1);
  assert.match(missing.out, /Refusing to write/);
  const wrong = await runScript(["--revoke-temp-passwords", "--apply", "--confirm-target", "https://prod.example.supabase.co"]);
  assert.equal(wrong.code, 1);
  assert.equal((await service.from("profiles").select("must_change_password").eq("id", legacyA.id).single()).data.must_change_password, true);
});

test("a failed recovery email leaves the account untouched and is reported (exit 1)", async () => {
  faults.recover500ForEmail = legacyB.email.toLowerCase();
  const { code, out } = await runScript(["--revoke-temp-passwords", "--apply", "--confirm-target", proxyUrl, "--max-retries", "0"]);
  faults.recover500ForEmail = null;
  assert.equal(code, 1, out);
  assert.match(out, /recovery email failed .*password left unchanged/);
  assert.ifError((await anon().auth.signInWithPassword({ email: legacyB.email, password: legacyB.password })).error, "B's password unchanged");
  assert.equal((await service.from("profiles").select("must_change_password").eq("id", legacyB.id).single()).data.must_change_password, true, "B still pending");
  // A was processed in the same run.
  assert.equal((await service.from("profiles").select("must_change_password").eq("id", legacyA.id).single()).data.must_change_password, false);
});

test("secured accounts: recovery emailed, old password dead, old session rejected, staff untouched", async () => {
  assert.ok((await mailsTo(legacyA.email)) >= 1, "recovery email delivered to the local mail catcher");
  assert.ok((await anon().auth.signInWithPassword({ email: legacyA.email, password: legacyA.password })).error, "formula password no longer works");
  const rest = await fetch(`${env.API_URL}/rest/v1/profiles?select=id&id=eq.${legacyA.id}`, {
    headers: { apikey: env.ANON_KEY, Authorization: `Bearer ${sessionA.session.access_token}` },
  });
  assert.equal(rest.status, 401, "a session opened with the temporary password is rejected");
  assert.equal((await service.from("profiles").select("must_change_password").eq("id", staffTemp.id).single()).data.must_change_password, true, "staff skipped");
  assert.ifError((await anon().auth.signInWithPassword({ email: staffTemp.email, password: staffTemp.password })).error);
});

test("re-run retries only the failed account, survives a rate limit, and is idempotent", async () => {
  const mailsA = await mailsTo(legacyA.email);
  faults.recover429 = 1;
  const { code, out } = await runScript(["--revoke-temp-passwords", "--apply", "--confirm-target", proxyUrl, "--retry-wait-ms", "1500"]);
  assert.equal(code, 0, out);
  assert.match(out, /rate-limited, retrying/);
  assert.equal(await mailsTo(legacyA.email), mailsA, "already-secured account is not emailed again");
  assert.equal((await service.from("profiles").select("must_change_password").eq("id", legacyB.id).single()).data.must_change_password, false);
  assert.ok((await anon().auth.signInWithPassword({ email: legacyB.email, password: legacyB.password })).error);

  const again = await runScript(["--revoke-temp-passwords", "--apply", "--confirm-target", proxyUrl]);
  assert.equal(again.code, 0);
  assert.match(again.out, /secured 0/);
});

test("--invite-unlinked invites and links once", async () => {
  const first = await runScript(["--invite-unlinked", "--apply", "--confirm-target", proxyUrl]);
  assert.equal(first.code, 0, first.out);
  assert.equal(await mailsTo(unlinkedEmail), 1);
  const { data: row } = await service.from("team_members").select("profile_id").eq("email", unlinkedEmail).single();
  assert.ok(row.profile_id, "linked to the invited account");
  const second = await runScript(["--invite-unlinked", "--apply", "--confirm-target", proxyUrl]);
  assert.equal(second.code, 0);
  assert.equal(await mailsTo(unlinkedEmail), 1, "no duplicate invitation");
});
