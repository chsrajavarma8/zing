"use client";

// The visitor's cookie choice, stored in a first-party cookie so it survives
// across visits and sub-pages. "essential" = only the cookies the site cannot
// work without (the Supabase sign-in session); "all" additionally allows
// optional analytics (see src/lib/analytics.ts).
export type CookieConsent = "all" | "essential";

const COOKIE = "zing_cookie_consent";
const MAX_AGE = 60 * 60 * 24 * 180; // ask again after ~6 months
export const CONSENT_EVENT = "zing:cookie-consent";
export const OPEN_SETTINGS_EVENT = "zing:cookie-settings";

export function getCookieConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(all|essential)(?:;|$)`));
  return (match?.[1] as CookieConsent | undefined) ?? null;
}

export function setCookieConsent(value: CookieConsent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${value}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<CookieConsent>(CONSENT_EVENT, { detail: value }));
}

// Re-open the banner, e.g. from a "Cookie settings" link in the footer.
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
