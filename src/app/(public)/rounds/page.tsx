import { EventNotConfigured } from "@/components/site/event-not-configured";
import { getPublicEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/site/page-header";
import { RoundsJourney } from "@/components/site/rounds-journey";
import type { Round, Exam } from "@/types/database";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Rounds",
  description: "Zing Hackathon runs across three rounds: Minor, Intermediate, and Major. See what each round involves.",
  path: "/rounds",
});

export default async function RoundsPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", event.id).order("order_index");

  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const roundIds = roundList.map((r) => r.id);
  const { data: exams } = roundIds.length > 0 ? await supabase.from("exams").select("*").in("round_id", roundIds) : { data: [] as Exam[] };

  return (
    <main>
      <PageHeader
        eyebrow="Competition structure"
        title="Three rounds. One project journey."
        description="Review each round's instructions, schedule, and deliverables before participating."
      />

      {roundList.length > 0 ? (
        <RoundsJourney rounds={roundList} exams={(exams as unknown as Exam[] | null) ?? []} />
      ) : (
        <p className="px-4 py-16 text-center text-muted-foreground">Round details haven&apos;t been published yet.</p>
      )}
    </main>
  );
}
