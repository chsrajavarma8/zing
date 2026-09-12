import type { MetadataRoute } from "next";
import { getPublicEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

// Only canonical, published, public, indexable pages - no admin/portal
// pages, no auth/recovery flows, no tokenized verification links, no draft
// content. lastModified uses real content timestamps (event.updated_at, or
// a policy's own published_at) rather than the current request time, so
// this doesn't claim a fresh modification on every crawl.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const event = await getPublicEvent();

  // getPublicEvent() runs unauthenticated here (crawlers have no session),
  // and events_select_public RLS only returns a row when status='published'
  // for an unauthenticated caller - so a null event already means "nothing
  // published yet", no separate draft-status check needed.
  if (!event) {
    return [{ url: site, changeFrequency: "daily", priority: 1 }];
  }

  const eventModified = new Date(event.updated_at);

  const supabase = await createClient();
  const { data: policies } = await supabase
    .from("policy_versions")
    .select("type, published_at, created_at")
    .eq("event_id", event.id)
    .eq("is_current", true);

  const policyDate = (type: "privacy" | "terms") => {
    const p = (policies as { type: string; published_at: string | null; created_at: string }[] | null)?.find(
      (row) => row.type === type,
    );
    return p ? new Date(p.published_at ?? p.created_at) : eventModified;
  };

  const pages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number; lastModified?: Date }[] = [
    { path: "/", changeFrequency: "daily", priority: 1, lastModified: eventModified },
    { path: "/about", changeFrequency: "weekly", priority: 0.7, lastModified: eventModified },
    { path: "/rounds", changeFrequency: "weekly", priority: 0.7, lastModified: eventModified },
    { path: "/schedule", changeFrequency: "weekly", priority: 0.7, lastModified: eventModified },
    { path: "/prizes", changeFrequency: "monthly", priority: 0.6, lastModified: eventModified },
    { path: "/faq", changeFrequency: "weekly", priority: 0.6, lastModified: eventModified },
    { path: "/rules", changeFrequency: "monthly", priority: 0.5, lastModified: policyDate("terms") },
    { path: "/submission-guidelines", changeFrequency: "monthly", priority: 0.5, lastModified: eventModified },
    { path: "/announcements", changeFrequency: "daily", priority: 0.6, lastModified: eventModified },
    { path: "/scoreboard", changeFrequency: "daily", priority: 0.6, lastModified: eventModified },
    { path: "/contact", changeFrequency: "monthly", priority: 0.4, lastModified: eventModified },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3, lastModified: policyDate("privacy") },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3, lastModified: policyDate("terms") },
    { path: "/register", changeFrequency: "weekly", priority: 0.9, lastModified: eventModified },
  ];

  return pages.map((p) => ({
    url: `${site}${p.path}`,
    lastModified: p.lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
