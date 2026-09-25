// RISK-006: which origin ID-card QR codes encode, per deployment configuration.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { idCardVerificationBase, getSiteUrl } from "@/lib/site-url";

const saved = { site: process.env.NEXT_PUBLIC_SITE_URL, vercel: process.env.VERCEL_ENV };
afterEach(() => {
  for (const [k, v] of [["NEXT_PUBLIC_SITE_URL", saved.site], ["VERCEL_ENV", saved.vercel]]) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
const set = (site, vercel) => {
  if (site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = site;
  if (vercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercel;
};

test("production on Vercel: canonical https origin, trailing slash removed", () => {
  set("https://skillglider.in/", "production");
  assert.deepEqual(idCardVerificationBase(), { baseUrl: "https://skillglider.in", isCanonical: true });
});

test("self-hosted production (no VERCEL_ENV) with an https origin is canonical", () => {
  set("https://skillglider.in", undefined);
  assert.equal(idCardVerificationBase().isCanonical, true);
});

test("preview deployments are flagged even with the production URL configured", () => {
  set("https://skillglider.in", "preview");
  assert.deepEqual(idCardVerificationBase(), { baseUrl: "https://skillglider.in", isCanonical: false });
});

test("missing NEXT_PUBLIC_SITE_URL falls back to localhost and is flagged", () => {
  set(undefined, "production");
  const originalError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(" "));
  try {
    assert.deepEqual(idCardVerificationBase(), { baseUrl: "http://localhost:3000", isCanonical: false });
  } finally {
    console.error = originalError;
  }
  assert.ok(logged.some((l) => l.includes("NEXT_PUBLIC_SITE_URL is not set in production")));
});

test("plain-http origins (local dev) are flagged", () => {
  set("http://localhost:3000", undefined);
  assert.equal(idCardVerificationBase().isCanonical, false);
  assert.equal(getSiteUrl(), "http://localhost:3000");
});
