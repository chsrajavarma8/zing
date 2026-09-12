import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Disallow all crawling on anything that isn't the real production
// deployment (Vercel preview/dev environments, or a misconfigured deploy
// where NEXT_PUBLIC_SITE_URL wasn't set to the production origin) - a
// preview URL showing up in search results would leak an unfinished/staging
// version of the site under a throwaway domain. Vercel sets VERCEL_ENV
// automatically; this does not depend on anything request-supplied.
const isProduction = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === "production"
  : process.env.NODE_ENV === "production" && getSiteUrl() === "https://skillglider.in";

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated/private surfaces, auth flows, and API routes - robots.txt
      // is a courtesy to well-behaved crawlers, not access control (RLS and
      // server-side auth checks are the actual enforcement).
      disallow: [
        "/admin",
        "/admin/",
        "/portal",
        "/portal/",
        "/login",
        "/forgot-password",
        "/auth/",
        "/change-password",
        "/api/",
        "/verify/", // tokenized ID-card verification links
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
