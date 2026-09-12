import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Next.js shallow-merges metadata per segment: a page that sets `openGraph`
// replaces the parent's entire openGraph object (title/description/url
// specifically - not `images`, which come from the opengraph-image.tsx file
// convention and are merged in separately). So every page needs its own
// title/description/siteName/url restated here rather than relying on
// inheriting the root layout's.
export function pageMetadata(params: { title: string; description: string; path: string }): Metadata {
  const url = `${getSiteUrl()}${params.path}`;
  // The root layout's title.template ("%s | Zing Hackathon") only applies
  // to the <title> tag, not to openGraph/twitter title fields - those need
  // the full string spelled out here to match.
  const fullTitle = `${params.title} | Zing Hackathon`;
  return {
    title: params.title,
    description: params.description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description: params.description,
      url,
      siteName: "Zing Hackathon by Skillglider",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: params.description,
    },
  };
}
