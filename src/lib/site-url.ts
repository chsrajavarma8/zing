// Single source of truth for the canonical public origin used in metadata
// (canonical URLs, Open Graph, sitemap, robots), emailed auth links, and
// ID-card QR codes. Deliberately never derived from the incoming request's
// Host header - that's attacker-controllable. Always comes from the
// deployment's own environment configuration.
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  // No safe production fallback - localhost must never leak into deployed
  // metadata. This only happens if NEXT_PUBLIC_SITE_URL was left unset.
  if (process.env.VERCEL_ENV === "production") {
    console.error("[site-url] NEXT_PUBLIC_SITE_URL is not set in production - links and QR codes will be wrong.");
  }
  return "http://localhost:3000";
}

export function isProductionDeployment(): boolean {
  return getSiteUrl() === "https://skillglider.in";
}

// ID-card QR codes are printed and kept, so they must point at the permanent
// production origin (RISK-006). Anything else - a preview deployment, local
// development, or a missing/unexpected NEXT_PUBLIC_SITE_URL - still works but
// is flagged so a test card is never mistaken for a real one.
export function idCardVerificationBase(): { baseUrl: string; isCanonical: boolean } {
  const baseUrl = getSiteUrl();
  const onPreview = process.env.VERCEL_ENV !== undefined && process.env.VERCEL_ENV !== "production";
  let httpsOrigin = false;
  try {
    httpsOrigin = new URL(baseUrl).protocol === "https:";
  } catch {
    httpsOrigin = false;
  }
  return { baseUrl, isCanonical: httpsOrigin && !onPreview && Boolean(process.env.NEXT_PUBLIC_SITE_URL) };
}
