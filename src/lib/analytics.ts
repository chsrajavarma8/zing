"use client";

// Privacy-conscious analytics scaffold. DISABLED BY DEFAULT - no external
// account has been created, no provider is wired up, and no visitor data
// is transmitted anywhere until an organizer explicitly configures a
// provider (see README "Analytics" section for the exact steps).
//
// Deliberately typed as a closed set of named events with a narrow,
// allowlisted property shape per event - NOT a generic
// `track(name, props: Record<string, unknown>)` - so it is structurally
// impossible to accidentally pass a participant's name, email, DOB, phone
// number, password, recovery token, Drive URL, or other free-text form
// content through this function. If you need a new event, add it to
// AnalyticsEvent below with an explicit, reviewed property shape - don't
// widen the existing ones to `unknown`.
import { getCookieConsent } from "@/lib/cookie-consent";

export type FormFailureCategory = "validation" | "network" | "server_error" | "permission" | "rate_limited" | "deadline_passed";

export type AnalyticsEvent =
  | { name: "page_view"; props: { path: string } }
  | { name: "registration_started"; props?: Record<string, never> }
  | { name: "registration_completed"; props: { teamSize: number } }
  | { name: "submission_saved"; props: { roundKey: string } }
  | { name: "form_failed"; props: { form: string; reason: FormFailureCategory } };

// Analytics cookies are optional: nothing is sent unless the visitor chose
// "Accept all" in the cookie banner (src/components/site/cookie-consent-banner.tsx).
function isEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" && getCookieConsent() === "all";
}

// Extension point for a real provider (Plausible, PostHog, etc). Left
// unimplemented on purpose - wiring this up is an organizer decision
// requiring an external account and a privacy-policy/cookie-consent update
// first (see README). Until then this always resolves to a no-op even if
// NEXT_PUBLIC_ANALYTICS_ENABLED is accidentally set to true, so flipping
// that flag alone can never start sending real visitor data anywhere.
function send(_event: AnalyticsEvent): void {
  // e.g. navigator.sendBeacon(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, JSON.stringify(_event))
}

export function track(event: AnalyticsEvent): void {
  if (!isEnabled()) return;
  try {
    send(event);
  } catch {
    // Analytics must never break the app it's measuring.
  }
}
