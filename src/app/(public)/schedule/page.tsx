import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/site/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Reveal } from "@/components/motion/reveal";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, nowMs } from "@/lib/date";
import { roundPhaseLabel } from "@/lib/rounds";
import { SCHEDULE_EXTRAS_KEY, type ScheduleExtraItem } from "@/lib/schedule-extras";
import type { Round } from "@/types/database";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Schedule",
  description: "Track key dates and round timing for Zing Hackathon by Skillglider.",
  path: "/schedule",
});

function fmt(v: string | null | undefined) {
  return v ? formatDateTime(v) : null;
}

function range(start: string | null | undefined, end: string | null | undefined) {
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `From ${s}`;
  if (e) return `Until ${e}`;
  return "To be announced";
}

export default async function SchedulePage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const [{ data: rounds }, { data: extrasBlock }] = await Promise.all([
    supabase.from("rounds").select("*").eq("event_id", event.id).order("order_index"),
    supabase.from("content_blocks").select("content").eq("event_id", event.id).eq("key", SCHEDULE_EXTRAS_KEY).maybeSingle(),
  ]);
  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const extraItems = ((extrasBlock as unknown as { content: { items?: ScheduleExtraItem[] } } | null)?.content.items ?? []) as ScheduleExtraItem[];
  const minor = roundList.find((r) => r.key === "minor");
  const intermediate = roundList.find((r) => r.key === "intermediate");
  const major = roundList.find((r) => r.key === "major");

  const now = nowMs();
  const categories: { label: string; value: string; at: string | null | undefined; status?: string }[] = [
    { label: "Registration", value: range(event.registration_open_at, event.registration_close_at), at: event.registration_close_at },
    { label: "Talent round submission", value: range(minor?.starts_at, minor?.ends_at), at: minor?.ends_at, status: minor && roundPhaseLabel(minor) },
    {
      label: "Intermediate round submission",
      value: fmt(intermediate?.ends_at) ?? "To be announced",
      at: intermediate?.ends_at,
      status: intermediate && roundPhaseLabel(intermediate),
    },
    { label: "Major round presentation", value: range(major?.starts_at, major?.ends_at), at: major?.ends_at, status: major && roundPhaseLabel(major) },
    { label: "Final results", value: "To be announced", at: null },
    ...extraItems.map((item) => ({ label: item.label, value: item.value || "To be announced", at: item.at })),
  ];

  // "Next" = the earliest configured item that hasn't passed yet.
  const nextIndex = categories.findIndex((c) => c.at && Date.parse(c.at) >= now);

  return (
    <main>
      <PageHeader eyebrow="Plan ahead" title="Know what happens next." description="Track registration, submissions, presentations, and results." />

      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="mb-10 text-center text-sm text-muted-foreground">All times shown in Indian Standard Time (IST).</p>

        <div className="relative">
          {/* Connecting rail */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-primary/15" aria-hidden />

          <div className="space-y-8">
            {categories.map((item, i) => {
              const past = item.at ? Date.parse(item.at) < now : false;
              const isNext = i === nextIndex;
              return (
                <Reveal key={`${item.label}-${i}`} delay={Math.min(i * 0.06, 0.3)} className="relative flex gap-5 pl-0">
                  <span
                    className={cn(
                      "relative z-10 mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                      isNext
                        ? "border-primary bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--rose)_25%,transparent)]"
                        : past
                          ? "border-primary/25 bg-cream"
                          : "border-primary/40 bg-ivory",
                    )}
                  />
                  <div className={cn("flex-1 pb-1", past && !isNext && "opacity-55")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("font-heading text-lg font-semibold", isNext && "text-primary")}>{item.label}</p>
                      {item.status && <Badge variant="outline">{item.status}</Badge>}
                      {isNext && <Badge>Next up</Badge>}
                      {past && !isNext && <Badge variant="secondary">Past</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.value}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        <Alert className="mt-10">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Schedules may be updated. Check this page and your dashboard for the latest published information.
          </AlertDescription>
        </Alert>
      </div>
    </main>
  );
}
