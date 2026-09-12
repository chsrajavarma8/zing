import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PolicyPage } from "@/components/site/policy-page";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Terms and Conditions",
  description: "The terms and conditions for registering for and participating in Zing Hackathon by Skillglider.",
  path: "/terms",
});

export default async function TermsPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: policy } = await supabase
    .from("policy_versions")
    .select("version, content_markdown, published_at")
    .eq("event_id", event.id)
    .eq("type", "terms")
    .eq("is_current", true)
    .maybeSingle();

  return <PolicyPage eyebrow="Play by the rules" title="Terms and Conditions" policy={policy as { version: string; content_markdown: string; published_at: string | null } | null} />;
}
