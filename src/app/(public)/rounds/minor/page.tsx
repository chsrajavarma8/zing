import { EventNotConfigured } from "@/components/site/event-not-configured";
import { getPublicEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { RoundDetail } from "@/components/site/round-detail";
import { RoundNavTabs } from "@/components/site/round-nav-tabs";
import { pageMetadata } from "@/lib/page-metadata";
import type { Round } from "@/types/database";

export const metadata = pageMetadata({
  title: "Minor Round",
  description: "Talent Round details, judging criteria, schedule, and submission for Zing Hackathon.",
  path: "/rounds/minor",
});

export default async function MinorRoundPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: round } = await supabase.from("rounds").select("*").eq("event_id", event.id).eq("key", "minor").maybeSingle();

  if (!round) {
    return <p className="px-4 py-16 text-center text-muted-foreground">This round hasn&apos;t been configured yet.</p>;
  }

  return (
    <div>
      <RoundNavTabs active="minor" />
      <RoundDetail round={round as unknown as Round} />
    </div>
  );
}
