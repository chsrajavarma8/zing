// Single source of truth for the canonical public origin used in metadata
// (canonical URLs, Open Graph, sitemap, robots). Deliberately never derived
// from the incoming request's Host header - that's attacker-controllable
// and must never influence what search engines/crawlers are told the
// canonical URL is. Always comes from the deployment's own environment
// configuration.
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  // No safe production fallback - localhost must never leak into deployed
  // metadata. This only happens if NEXT_PUBLIC_SITE_URL was left unset.
  return "http://localhost:3000";
}

export function isProductionDeployment(): boolean {
  return getSiteUrl() === "https://skillglider.in";
}
