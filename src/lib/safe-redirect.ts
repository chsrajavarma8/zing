// Post-login destination validation (BUG-008). Only same-origin, in-app
// paths are accepted; anything else falls back to the caller's default.
// Rejects absolute and protocol-relative URLs, backslash tricks that some
// browsers normalize into "//", control characters, and auth pages that
// would just bounce the user back to sign-in.
const INTERNAL_BASE = "http://internal.invalid";
const BLOCKED_PREFIXES = ["/login", "/auth/", "/api/"];

export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value === "" || value.length > 2048) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, INTERNAL_BASE);
  } catch {
    return null;
  }
  if (url.origin !== INTERNAL_BASE) return null;

  const path = url.pathname;
  if (BLOCKED_PREFIXES.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p))) return null;

  return `${path}${url.search}${url.hash}`;
}
