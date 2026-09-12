import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PolicyPage } from "@/components/site/policy-page";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Skillglider collects, uses, and protects your information for Zing Hackathon registration and participation.",
  path: "/privacy",
});

export default async function PrivacyPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: policy } = await supabase
    .from("policy_versions")
    .select("version, content_markdown, published_at")
    .eq("event_id", event.id)
    .eq("type", "privacy")
    .eq("is_current", true)
    .maybeSingle();

  return <PolicyPage eyebrow="Your data" title="Privacy Policy" policy={policy as { version: string; content_markdown: string; published_at: string | null } | null} />;
}
