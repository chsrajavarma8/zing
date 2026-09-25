// Responsive + accessibility checks in a real browser (headless Chrome/Edge)
// across the audit's viewport widths: horizontal overflow, accessible names,
// console/hydration errors, WCAG 2.5.8 target size (with the spacing and
// inline exceptions), visible keyboard focus, and one <h1> per page.
//
// Run: E2E_APP_URL=http://localhost:3000 [BROWSER=edge] npm run test:browser
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { service, createUser, createTeam, defaultEvent, cleanup } from "../integration/local-supabase.mjs";
import { sessionCookies, APP_URL } from "./harness.mjs";
import { launch } from "./cdp.mjs";

const BROWSER = process.env.BROWSER ?? "chrome";
const WIDTHS = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920];

const AUDIT = `(() => {
  const vw = document.documentElement.clientWidth;
  const visible = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && !el.closest("[aria-hidden=true]"); };
  const describe = (el) => (el.outerHTML.slice(0, 90));

  // Horizontal overflow not contained by a scrolling/clipping ancestor.
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || getComputedStyle(el).position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1) continue;
    let contained = false;
    for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { contained = true; break; }
    if (!contained) offenders.push(describe(el));
  }
  const overflow = Math.max(0, document.documentElement.scrollWidth - vw);

  // Accessible names for interactive controls.
  const controls = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=combobox], [role=checkbox], [role=switch]")]
    .filter((el) => visible(el) && el.tabIndex !== -1);
  const nameOf = (el) => (el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent) || [...(el.labels ?? [])].map((l) => l.textContent).join(" ") || el.getAttribute("title") || (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ? "" : el.textContent) || el.querySelector?.("img[alt]")?.getAttribute("alt") || "").trim();
  const unnamed = controls.filter((el) => !nameOf(el)).map(describe);

  // WCAG 2.5.8 Target Size (Minimum): undersized targets pass if a 24px
  // circle centred on each doesn't intersect another target or another
  // undersized target's circle; inline links in a sentence are exempt.
  const targets = controls.filter((el) => !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || ["checkbox", "radio", "button", "submit"].includes(el.type));
  const rects = targets.map((el) => ({ el, r: el.getBoundingClientRect() }));
  const small = rects.filter(({ r }) => r.width < 24 || r.height < 24);
  const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const distToRect = (p, r) => Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom));
  const isInline = (el) => {
    if (getComputedStyle(el).display !== "inline") return false;
    const block = el.closest("p, li, dd, td, span, label");
    return block && block.textContent.trim().length > el.textContent.trim().length + 3;
  };
  const targetFailures = [];
  for (const a of small) {
    if (isInline(a.el)) continue;
    const ca = center(a.r);
    const clash = rects.some((b) => {
      if (b.el === a.el || b.el.contains(a.el) || a.el.contains(b.el)) return false;
      if (distToRect(ca, b.r) < 12) return true;
      const isSmall = b.r.width < 24 || b.r.height < 24;
      if (isSmall) { const cb = center(b.r); return Math.hypot(ca.x - cb.x, ca.y - cb.y) < 24; }
      return false;
    });
    if (clash) targetFailures.push(describe(a.el) + " " + Math.round(a.r.width) + "x" + Math.round(a.r.height));
  }

  return { overflow, offenders: offenders.slice(0, 3), unnamed: unnamed.slice(0, 5), targetFailures: targetFailures.slice(0, 5), h1: document.querySelectorAll("h1").length };
})()`;

const FOCUS_CHECK = `(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return { tag: "BODY", visible: true };
  const st = getComputedStyle(e);
  const ring = (st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0) || (st.boxShadow && st.boxShadow !== "none");
  return { tag: e.tagName + (e.id ? "#" + e.id : ""), visible: Boolean(ring) };
})()`;

let browser;
let page;
let leadCookies;
let adminCookies;

const toCookies = (s) => s.split("; ").map((kv) => ({ name: kv.slice(0, kv.indexOf("=")), value: kv.slice(kv.indexOf("=") + 1), domain: "localhost", path: "/" }));

before(async () => {
  const event = await defaultEvent();
  await service.from("events").update({ status: "published", registration_open_at: null, registration_close_at: new Date(Date.now() + 864e5).toISOString() }).eq("id", event.id);
  const lead = await createUser("rsp-lead");
  const admin = await createUser("rsp-admin");
  await service.from("event_admins").insert({ event_id: event.id, user_id: admin.id, role: "event_admin" });
  await createTeam(event.id, [{ role: "lead", user: lead, name: "Responsive Lead With A Fairly Long Name" }]);
  leadCookies = toCookies(await sessionCookies(lead));
  adminCookies = toCookies(await sessionCookies(admin));
  browser = await launch(BROWSER);
  page = await browser.newPage();
});

after(async () => {
  await browser?.close();
  await cleanup();
});

const PAGES = [
  ["/", null], ["/login", null], ["/register", null], ["/forgot-password", null], ["/auth/set-password", null],
  ["/schedule", null], ["/scoreboard", null], ["/faq", null], ["/rounds/advanced", null],
  ["/portal", "lead"], ["/portal/team", "lead"], ["/portal/submission", "lead"], ["/portal/notifications", "lead"], ["/portal/id-card", "lead"],
  ["/admin", "admin"], ["/admin/registrations", "admin"], ["/admin/judging", "admin"], ["/admin/content", "admin"], ["/admin/notifications", "admin"], ["/admin/events", "admin"],
];

for (const [path, who] of PAGES) {
  test(`[${BROWSER}] ${path}: no overflow, named controls, 2.5.8 targets, no console errors, one h1 (10 widths)`, async () => {
    await page.clearCookies();
    if (who) await page.setCookies(who === "lead" ? leadCookies : adminCookies);
    const problems = [];
    for (const width of WIDTHS) {
      await page.viewport(width);
      page.consoleErrors.length = 0;
      await page.goto(`${APP_URL}${path}`);
      const a = await page.evaluate(AUDIT);
      if (a.overflow > 0 || a.offenders.length) problems.push(`${width}px overflow ${a.overflow}px: ${a.offenders.join(" | ")}`);
      if (a.unnamed.length) problems.push(`${width}px unnamed: ${a.unnamed.join(" | ")}`);
      if (a.targetFailures.length) problems.push(`${width}px 2.5.8: ${a.targetFailures.join(" | ")}`);
      if (a.h1 !== 1) problems.push(`${width}px h1 count ${a.h1}`);
      if (page.consoleErrors.length) problems.push(`${width}px console: ${[...new Set(page.consoleErrors)].join(" | ")}`);
    }
    assert.deepEqual(problems, []);
  });
}

test(`[${BROWSER}] keyboard: every Tab stop on key pages shows a visible focus indicator`, async () => {
  const failures = [];
  for (const [path, who] of [["/login", null], ["/register", null], ["/portal/team", "lead"], ["/admin/content", "admin"]]) {
    await page.clearCookies();
    if (who) await page.setCookies(who === "lead" ? leadCookies : adminCookies);
    await page.viewport(1280);
    await page.goto(`${APP_URL}${path}`);
    await page.evaluate("document.activeElement?.blur(); window.focus(); true");
    for (let i = 0; i < 25; i++) {
      await page.key("Tab", "Tab", 9);
      const f = await page.evaluate(FOCUS_CHECK);
      if (!f.visible) failures.push(`${path} #${i + 1} ${f.tag}`);
    }
  }
  assert.deepEqual(failures, []);
});

test(`[${BROWSER}] BUG-021: admin sign-out is reachable from the mobile menu`, async () => {
  await page.clearCookies();
  await page.setCookies(adminCookies);
  await page.viewport(375);
  await page.goto(`${APP_URL}/admin`);
  const result = await page.evaluate(`(async () => {
    document.querySelector('button[aria-label="Open menu"]').click();
    await new Promise((r) => setTimeout(r, 700));
    const so = [...document.querySelectorAll('[role=dialog] button')].find((b) => /Sign out/.test(b.textContent));
    if (!so) return "missing";
    const r = so.getBoundingClientRect();
    return r.width > 0 && r.bottom <= innerHeight ? "visible" : "offscreen";
  })()`);
  assert.equal(result, "visible");
});
