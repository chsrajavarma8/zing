// Real-browser walkthroughs (headless Chrome/Edge via CDP) against a running
// production build that points at the LOCAL Supabase stack, with emails read
// from the local mail catcher (Mailpit). Covers BUG-004, BUG-010, BUG-015,
// BUG-022 and RISK-003 end to end.
//
// Run: E2E_APP_URL=http://localhost:3000 npm run test:browser
// (The app's NEXT_PUBLIC_SITE_URL must be an allowed Auth redirect - see
// supabase/config.toml additional_redirect_urls.)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { service, anon, createUser, createTeam, defaultEvent, cleanup, signIn } from "../integration/local-supabase.mjs";
import { sessionCookies, APP_URL } from "./harness.mjs";
import { launch, q, byText } from "./cdp.mjs";

const MAILPIT = "http://127.0.0.1:54324";
const BROWSER = process.env.BROWSER ?? "chrome";
let browser;
let page;
let event;
const run = randomUUID().slice(0, 6);
const leadEmail = `it-br-lead-${run}@example.test`;
const memberEmail = `it-br-member-${run}@example.test`;
let registeredTeamRef;

const byId = (id) => `document.getElementById(${JSON.stringify(id)})`;
async function setValue(id, value) {
  await page.evaluate(`(() => {
    const el = ${byId(id)};
    if (!el) throw new Error("missing " + ${JSON.stringify(id)});
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("focusout", { bubbles: true }));
    return true;
  })()`);
}
const textPresent = (text) => page.evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);

async function inviteLink(email) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const href = msg.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)[1];
      return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${email}`);
}

let mobileSeq = 0;
const mobile = () => `7${String(Date.now()).slice(-7)}${String(mobileSeq++).padStart(2, "0")}`;

async function fillMember(i, { name, email, roll }) {
  await setValue(`members.${i}.fullName`, name);
  await setValue(`members.${i}.dateOfBirth`, "2004-03-05");
  await setValue(`members.${i}.college`, "Browser Test College");
  if (roll !== undefined) await setValue(`members.${i}.rollNumber`, roll);
  await setValue(`members.${i}.email`, email);
  await setValue(`members.${i}.mobile`, mobile());
}

before(async () => {
  event = await defaultEvent();
  await service
    .from("events")
    .update({ status: "published", team_size_min: 1, team_size_max: 4, gender_field_required: false, registration_open_at: null, registration_close_at: new Date(Date.now() + 864e5).toISOString() })
    .eq("id", event.id);
  browser = await launch(BROWSER);
  page = await browser.newPage();
  await page.viewport(1280);
});

after(async () => {
  await browser?.close();
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users.users.filter((x) => x.email?.includes(`-${run}@`))) await service.auth.admin.deleteUser(u.id);
  if (registeredTeamRef) await service.from("teams").delete().eq("reference_id", registeredTeamRef);
  await cleanup();
});

test(`[${BROWSER}] BUG-004: registration shows cross-field errors on the step that has them, then succeeds`, async () => {
  await page.goto(`${APP_URL}/register`);
  await setValue("teamName", `Browser Team ${run}`);
  await page.click(byText("button", "Continue"));
  await page.waitFor(`document.body.innerText.includes("Team lead details")`);

  // Lead with an empty college roll number: must be caught on THIS step.
  await fillMember(0, { name: "Browser Lead", email: leadEmail, roll: "" });
  await page.click(byText("button", "Continue"));
  await page.waitFor(`document.body.innerText.includes("Enter your college roll number.")`);
  assert.ok(await textPresent("Team lead details"), "still on the lead step");
  assert.equal(await page.evaluate(`${byId("members.0.rollNumber")}.getAttribute("aria-invalid")`), "true");
  assert.equal(await page.evaluate(`${byId("members.0.rollNumber")}.getAttribute("aria-describedby")`), "members.0.rollNumber-error");

  await setValue("members.0.rollNumber", `BR-${run}-1`);
  await page.click(byText("button", "Continue"));
  await page.waitFor(`document.body.innerText.includes("Add another member")`);

  // A member reusing the lead's email must be caught on the members step.
  await page.click(byText("button", "Add another member"));
  await page.waitFor(`!!${byId("members.1.fullName")}`);
  await fillMember(1, { name: "Browser Member", email: leadEmail, roll: `BR-${run}-2` });
  await page.click(byText("button", "Review registration"));
  await page.waitFor(`document.body.innerText.includes("This email is already used by another member of this team.")`);
  assert.ok(await textPresent("Add another member"), "still on the members step");

  await setValue("members.1.email", memberEmail);
  await page.click(byText("button", "Review registration"));
  await page.waitFor(`document.body.innerText.includes("Check your details before submitting.")`);
  await page.click(q("#termsAccepted"));
  await page.click(q("#privacyAccepted"));
  await page.click(byText("button", "Submit registration"));
  await page.waitFor(`document.body.innerText.includes("Your registration has been recorded.")`, 30000);
  assert.ok(await textPresent("Invitation emailed"));
  registeredTeamRef = await page.evaluate(`[...document.querySelectorAll("strong")].map((s) => s.textContent).find((t) => /^TEAM-/.test(t))`);
  assert.ok(registeredTeamRef);
  assert.deepEqual(page.consoleErrors, [], `console errors: ${page.consoleErrors.join(" | ")}`);
});

test(`[${BROWSER}] BUG-015: opening an invitation while signed in as someone else sets the INVITED account's password`, async () => {
  const other = await createUser(`br-other-${run}`);
  const cookies = (await sessionCookies(other)).split("; ").map((kv) => ({ name: kv.slice(0, kv.indexOf("=")), value: kv.slice(kv.indexOf("=") + 1), domain: "localhost", path: "/" }));
  await page.setCookies(cookies);
  await page.goto(`${APP_URL}/portal`); // browser is signed in as `other`

  const link = await inviteLink(leadEmail);
  assert.match(decodeURIComponent(link), /redirect_to=http:\/\/localhost:3000\/auth\/set-password\?flow=participant/);
  await page.goto(link);
  await page.waitFor(`document.body.innerText.includes("Create your password") || document.body.innerText.includes("expired or is invalid")`);
  assert.ok(await textPresent(leadEmail), "the page names the invited account, not the signed-in one");
  assert.ok(!(await page.url()).includes("access_token"), "tokens scrubbed from the address bar");

  const newPassword = `Br-${randomUUID()}`;
  await setValue("password", newPassword);
  await setValue("confirm", newPassword);
  await page.click(byText("button", "Set password"));
  await page.waitFor(`document.body.innerText.includes("Your password has been set.")`, 20000);
  await page.waitFor(`location.pathname === "/portal"`, 20000);
  await page.waitFor(`document.body.innerText.includes("Welcome, Browser.")`, 20000);

  assert.ifError((await anon().auth.signInWithPassword({ email: leadEmail, password: newPassword })).error, "invitee can sign in");
  assert.ifError((await anon().auth.signInWithPassword({ email: other.email, password: other.password })).error, "the other account's password is untouched");
  const { data: row } = await service.from("team_members").select("verification_status, profile_id").eq("email", leadEmail).single();
  assert.equal(row.verification_status, "verified");
  assert.ok(row.profile_id);
});

test(`[${BROWSER}] a reused invitation link is rejected`, async () => {
  await page.clearCookies();
  await page.goto(await inviteLink(leadEmail));
  await page.waitFor(`document.body.innerText.includes("This link has expired or is invalid")`);
  assert.ok(!(await textPresent("Create your password")));
});

test(`[${BROWSER}] an expired invitation link is rejected`, async () => {
  const link = await inviteLink(memberEmail);
  execSync(
    `docker exec supabase_db_zing psql -U postgres -tAc "update auth.users set confirmation_sent_at = now() - interval '3 days', invited_at = now() - interval '3 days' where email = '${memberEmail}'; update auth.one_time_tokens set created_at = now() - interval '3 days' where relates_to = '${memberEmail}';"`,
  );
  await page.clearCookies();
  await page.goto(link);
  await page.waitFor(`document.body.innerText.includes("This link has expired or is invalid")`);
  assert.ok(!(await textPresent("Create your password")));
});

test(`[${BROWSER}] BUG-022: an already-open notifications page shows a scheduled notification after release`, { timeout: 180_000 }, async () => {
  const user = await createUser(`br-notify-${run}`);
  await createTeam(event.id, [{ role: "lead", user }]);
  const cookies = (await sessionCookies(user)).split("; ").map((kv) => ({ name: kv.slice(0, kv.indexOf("=")), value: kv.slice(kv.indexOf("=") + 1), domain: "localhost", path: "/" }));
  await page.clearCookies();
  await page.setCookies(cookies);

  const title = `Scheduled ${run}`;
  const releaseAt = Date.now() + 20_000;
  const { data: n } = await service
    .from("notifications")
    .insert({ event_id: event.id, title, message: "Embargoed until release.", audience_type: "individual", scheduled_at: new Date(releaseAt).toISOString(), channels: ["in_app"] })
    .select("id")
    .single();
  await service.from("notification_recipients").insert({ notification_id: n.id, profile_id: user.id, channel: "in_app", delivery_status: "delivered" });

  await page.goto(`${APP_URL}/portal/notifications`);
  assert.ok(!(await textPresent(title)), "not visible before the scheduled time");
  // No reload or navigation from here on: the open page must update itself.
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(title)})`, 150_000);
  const shownAfterMs = Date.now() - releaseAt;
  assert.ok(shownAfterMs >= 0, "never shown before release");
  assert.ok(shownAfterMs <= 90_000, `shown ${Math.round(shownAfterMs / 1000)}s after release`);
  await service.from("notifications").delete().eq("id", n.id);
});
