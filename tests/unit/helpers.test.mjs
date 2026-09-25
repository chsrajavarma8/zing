// Unit tests for pure helpers introduced by the 2026-09 audit fixes.
// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "@/lib/safe-redirect";
import { escapeHtml, plainTextToEmailHtml } from "@/lib/html";
import { parsePageParam, MAX_PAGE } from "@/lib/pagination";
import { detectKind, matchAllowedType, isPathUnder, sanitizeFileName, SUBMISSION_TYPES, BRANDING_TYPES } from "@/lib/uploads";
import { validateExtraFields } from "@/lib/registration-fields";
import { memberCrossFieldIssues, isValidBirthDate, registrationSchema } from "@/lib/validations/registration";

test("BUG-008: safeNextPath accepts only same-origin in-app paths", () => {
  assert.equal(safeNextPath("/portal/team"), "/portal/team");
  assert.equal(safeNextPath("/admin/registrations?page=2#top"), "/admin/registrations?page=2#top");
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "  //evil.example",
    "http:/evil.example",
    "/login?next=/admin",
    "/auth/set-password",
    "/api/register",
    "/portal\u0000",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeNextPath(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
  // Normalization can't escape the origin.
  assert.equal(safeNextPath("/portal/../admin"), "/admin");
  assert.equal(safeNextPath("/%2F%2Fevil.example"), "/%2F%2Fevil.example");
});

test("RISK-007: email HTML escapes content and keeps line breaks", () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">&'`), "&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
  assert.equal(plainTextToEmailHtml("Hi <b>team</b>\nline 2\n\nNext para"), "<p>Hi &lt;b&gt;team&lt;/b&gt;<br/>line 2</p><p>Next para</p>");
});

test("BUG-029: parsePageParam falls back to 1 and clamps", () => {
  assert.equal(parsePageParam(undefined), 1);
  assert.equal(parsePageParam("abc"), 1);
  assert.equal(parsePageParam("0"), 1);
  assert.equal(parsePageParam("-3"), 1);
  assert.equal(parsePageParam("1.5"), 1);
  assert.equal(parsePageParam("1e3"), 1);
  assert.equal(parsePageParam("7"), 7);
  assert.equal(parsePageParam(["4", "9"]), 4);
  assert.equal(parsePageParam("999999"), MAX_PAGE);
});

test("RISK-008: file signatures must match the declared type", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 ...");
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const html = new TextEncoder().encode("<html><script>");
  assert.equal(detectKind(pdf), "pdf");
  assert.equal(detectKind(png), "png");
  assert.equal(detectKind(html), null);
  assert.equal(detectKind(Uint8Array.from([0x50, 0x4b, 0x03, 0x04])), "zip");
  assert.ok(matchAllowedType(SUBMISSION_TYPES, "deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"));
  assert.equal(matchAllowedType(SUBMISSION_TYPES, "deck.exe", "application/pdf"), null, "extension must agree with MIME");
  assert.equal(matchAllowedType(BRANDING_TYPES, "logo.svg", "image/svg+xml"), null, "SVG branding is rejected");
});

test("RISK-001: signed upload paths stay inside the issued folder", () => {
  assert.ok(isPathUnder("team/round/abc-file.pdf", "team/round"));
  assert.ok(!isPathUnder("team/round/../other/file.pdf", "team/round"));
  assert.ok(!isPathUnder("team/round/sub/file.pdf", "team/round"));
  assert.ok(!isPathUnder("other/round/file.pdf", "team/round"));
  assert.equal(sanitizeFileName("../../My Résumé (final).pdf"), ".._.._My_R_sum_final_.pdf");
});

test("BUG-026: custom registration fields are validated against configuration", () => {
  const fields = [
    { key: "github", label: "GitHub", field_type: "text", required: true },
    { key: "years", label: "Years", field_type: "number", required: false },
    { key: "track", label: "Track", field_type: "select", required: false, options: ["AI", "Web"] },
    { key: "agree", label: "Agreement", field_type: "checkbox", required: true },
  ];
  assert.deepEqual(validateExtraFields(fields, { github: " octo ", years: "3", track: "AI", agree: true, injected: "x" }), {
    ok: true,
    values: { github: "octo", years: 3, track: "AI", agree: true },
  });
  assert.equal(validateExtraFields(fields, { agree: true }).ok, false, "required text missing");
  assert.equal(validateExtraFields(fields, { github: "x", agree: false }).ok, false, "required checkbox unchecked");
  assert.equal(validateExtraFields(fields, { github: "x", agree: true, years: "many" }).ok, false, "number type");
  assert.equal(validateExtraFields(fields, { github: "x", agree: true, track: "Other" }).ok, false, "select options");
  assert.equal(validateExtraFields(fields, { github: "x".repeat(501), agree: true }).ok, false, "size limit");
  assert.equal(validateExtraFields(fields, "not-an-object").ok, false);
});

const member = (overrides = {}) => ({
  fullName: "Asha Rao",
  dateOfBirth: "2004-05-06",
  educationLevel: "college",
  college: "Demo Institute",
  rollNumber: "R1",
  classGrade: "",
  email: "a@example.test",
  mobile: "9876543210",
  whatsapp: "",
  whatsappSameAsMobile: true,
  gender: "",
  role: "lead",
  ...overrides,
});

test("BUG-004: cross-field member rules run per step, independent of consent state", () => {
  const issues = memberCrossFieldIssues([member({ rollNumber: "" })], [0]);
  assert.deepEqual(issues.map((i) => i.path.join(".")), ["members.0.rollNumber"]);

  const dupes = memberCrossFieldIssues([member(), member({ role: "member", email: "A@example.test", mobile: "+91 98765-43210" })]);
  assert.deepEqual(dupes.map((i) => i.path.join(".")).sort(), ["members.1.email", "members.1.mobile", "members.1.rollNumber"].sort());

  const wa = memberCrossFieldIssues([member({ whatsappSameAsMobile: false, whatsapp: "12" })], [0]);
  assert.deepEqual(wa.map((i) => i.path.join(".")), ["members.0.whatsapp"]);

  // The full schema still enforces the same rules on the server.
  const parsed = registrationSchema.safeParse({
    eventId: "00000000-0000-4000-8000-000000000000",
    teamName: "Team",
    members: [member({ rollNumber: "" })],
    privacyAccepted: true,
    termsAccepted: true,
    promotionalConsent: false,
    extraFields: {},
  });
  assert.equal(parsed.success, false);
  assert.ok(parsed.error.issues.some((i) => i.path.join(".") === "members.0.rollNumber"));
});

test("birth dates must be real, ISO-formatted, and not in the future", () => {
  assert.ok(isValidBirthDate("2004-02-29"));
  assert.ok(!isValidBirthDate("2003-02-29"));
  assert.ok(!isValidBirthDate("March 5 2004"));
  assert.ok(!isValidBirthDate("2004/03/05"));
  assert.ok(!isValidBirthDate("2999-01-01"));
  assert.ok(!isValidBirthDate("1850-01-01"));
});
