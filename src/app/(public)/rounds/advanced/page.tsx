import { EventNotConfigured } from "@/components/site/event-not-configured";
import { getPublicEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { RoundDetail } from "@/components/site/round-detail";
import { RoundNavTabs } from "@/components/site/round-nav-tabs";
import { pageMetadata } from "@/lib/page-metadata";
import type { Round } from "@/types/database";

export const metadata = pageMetadata({
  title: "Advanced Rounds",
  description: "Intermediate and Major Round details, judging criteria, schedule, and submission for Zing Hackathon.",
  path: "/rounds/advanced",
});

// The selected round is a real query param, not client-only tab state - a
// refresh, a shared link, and browser back/forward must all land on the
// same round without any client-side hydration guesswork.
export default async function AdvancedRoundsPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const sp = await searchParams;
  const selectedKey = sp.round === "major" ? "major" : "intermediate";

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", event.id).in("key", ["intermediate", "major"]).order("order_index");
  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const selected = roundList.find((r) => r.key === selectedKey) ?? roundList[0];

  if (!selected) {
    return <p className="px-4 py-16 text-center text-muted-foreground">These rounds haven&apos;t been configured yet.</p>;
  }

  return (
    <div>
      <RoundNavTabs active={selectedKey} />
      <RoundDetail round={selected} />
    </div>
  );
}
