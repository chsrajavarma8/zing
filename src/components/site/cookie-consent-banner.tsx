"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import {
  getCookieConsent,
  setCookieConsent,
  CONSENT_EVENT,
  OPEN_SETTINGS_EVENT,
  type CookieConsent,
} from "@/lib/cookie-consent";

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

export function CookieConsentBanner() {
  // "pending" on the server and during hydration, so the banner never flashes
  // for visitors who already chose; the real cookie value is read on the client.
  const consent = useSyncExternalStore<CookieConsent | null | "pending">(subscribe, getCookieConsent, () => "pending");
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, reopen);
  }, []);

  const open = consent === null || (reopened && consent !== "pending");
  if (!open) return null;

  function choose(value: CookieConsent) {
    setCookieConsent(value);
    setReopened(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:p-0"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="rounded-2xl border border-primary/15 bg-cream p-4 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-heading text-sm font-semibold text-burgundy">We use cookies</p>
            <p className="text-xs leading-relaxed text-burgundy/70">
              Essential cookies keep you signed in and the site secure. With your OK, we&apos;d also use analytics
              cookies to understand how the site is used and improve it. See our{" "}
              <Link href="/privacy" className="font-medium text-primary underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" className="h-9" onClick={() => choose("essential")}>
            Essential only
          </Button>
          <Button size="sm" className="h-9" onClick={() => choose("all")}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
