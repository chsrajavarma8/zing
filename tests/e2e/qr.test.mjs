// RISK-006: the QR code actually rendered on /portal/id-card encodes the
// canonical verification URL, and that URL resolves to a valid card.
// Run against a build made with the NEXT_PUBLIC_SITE_URL under test:
//   EXPECT_QR_BASE=https://skillglider.in EXPECT_CANONICAL=true npm run test:e2e -- tests/e2e/qr.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { service, createUser, createTeam, defaultEvent, cleanup } from "../integration/local-supabase.mjs";
import { sessionCookies, APP_URL } from "./harness.mjs";
import { launch } from "./cdp.mjs";

const EXPECT_BASE = process.env.EXPECT_QR_BASE;
const EXPECT_CANONICAL = process.env.EXPECT_CANONICAL === "true";
let browser;
let token;
let cookie;
let memberName;

before(async () => {
  assert.ok(EXPECT_BASE, "set EXPECT_QR_BASE");
  const event = await defaultEvent();
  const user = await createUser("qr");
  memberName = `QR Member ${Date.now()}`;
  const { members } = await createTeam(event.id, [{ role: "lead", user, name: memberName }]);
  const { data: card } = await service.from("id_cards").insert({ team_member_id: members[0].id }).select("qr_token").single();
  token = card.qr_token;
  cookie = await sessionCookies(user);
  browser = await launch(process.env.BROWSER ?? "chrome");
});

after(async () => {
  await browser?.close();
  await cleanup();
});

test(`QR encodes ${EXPECT_BASE}/verify/<token> (canonical=${EXPECT_CANONICAL})`, async () => {
  const page = await browser.newPage();
  await page.setCookies(cookie.split("; ").map((kv) => ({ name: kv.slice(0, kv.indexOf("=")), value: kv.slice(kv.indexOf("=") + 1), domain: new URL(APP_URL).hostname, path: "/" })));
  await page.viewport(1280);
  await page.goto(`${APP_URL}/portal/id-card`);
  const src = await page.waitFor(`document.querySelector('img[alt="QR verification code"]')?.src`);

  // Compare QR MODULES, not PNG bytes (browser canvas and Node encode PNGs
  // differently): sample the centre of every module in the rendered image and
  // compare with the matrix the qrcode library produces for the expected URL.
  const expectedUrl = `${EXPECT_BASE}/verify/${token}`;
  const matrix = QRCode.create(expectedUrl).modules;
  const margin = 1;
  const rendered = await page.evaluate(`(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(src)};
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const n = ${matrix.size};
    const scale = img.naturalWidth / (n + ${margin} * 2);
    const out = [];
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      const px = ctx.getImageData(Math.floor((${margin} + col + 0.5) * scale), Math.floor((${margin} + r + 0.5) * scale), 1, 1).data;
      out.push(px[0] < 128 ? 1 : 0);
    }
    return out;
  })()`);
  assert.equal(rendered.length, matrix.size * matrix.size, "QR version/size matches the expected URL's encoding");
  const mismatches = rendered.filter((v, i) => v !== matrix.data[i]).length;
  assert.equal(mismatches, 0, `rendered QR differs from ${expectedUrl} in ${mismatches} modules`);

  // Negative control: the same comparison against a different origin fails.
  const other = QRCode.create(`${EXPECT_BASE === "https://skillglider.in" ? "http://localhost:3000" : "https://skillglider.in"}/verify/${token}`).modules;
  assert.ok(other.size !== matrix.size || rendered.some((v, i) => v !== other.data[i]), "comparison can tell origins apart");

  const warning = await page.evaluate(`document.body.innerText.includes("Test card: this QR code points to")`);
  assert.equal(warning, !EXPECT_CANONICAL, "non-canonical origins show the test-card warning");
  assert.deepEqual(page.consoleErrors, []);

  // The encoded path resolves to a valid card (checked on this local build,
  // which serves the same /verify route as the canonical origin).
  const verify = await fetch(`${APP_URL}/verify/${token}`);
  const html = await verify.text();
  assert.equal(verify.status, 200);
  assert.ok(html.includes(memberName) && html.includes("Valid"));
});
