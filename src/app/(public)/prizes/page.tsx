import Link from "next/link";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { getPublicEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/site/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Reveal, StaggerReveal } from "@/components/motion/reveal";
import { Trophy, Award, Medal, ArrowRight, Target } from "lucide-react";
import type { Round, JudgingCriterion } from "@/types/database";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Prizes",
  description: "Zing Hackathon by Skillglider offers a ₹4,00,000 total prize pool across three award tiers. See prize details.",
  path: "/prizes",
});

const TIER_ICONS = [Trophy, Award, Medal];

export default async function PrizesPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const [{ data: block }, { data: rounds }] = await Promise.all([
    supabase.from("content_blocks").select("content").eq("event_id", event.id).eq("key", "prizes").maybeSingle(),
    supabase.from("rounds").select("*").eq("event_id", event.id).order("order_index"),
  ]);

  const roundIds = (rounds as unknown as Round[] | null)?.map((r) => r.id) ?? [];
  const { data: criteria } =
    roundIds.length > 0
      ? await supabase.from("judging_criteria").select("*").in("round_id", roundIds).order("order_index")
      : { data: [] as JudgingCriterion[] };

  const blockContent = (block?.content as Record<string, string> | null) ?? {};
  const body = blockContent.body;
  const tiers = [
    { label: blockContent.tier1_label || "1st Place", amount: blockContent.tier1_amount || "₹2,00,000" },
    { label: blockContent.tier2_label || "2nd Place", amount: blockContent.tier2_amount || "₹1,50,000" },
    { label: blockContent.tier3_label || "3rd Place", amount: blockContent.tier3_amount || "₹50,000" },
  ];
  const hasCriteria = (criteria as unknown as JudgingCriterion[] | null)?.length ?? 0;

  return (
    <main>
      <PageHeader eyebrow="What's at stake" title="One prize pool. Everything to build for." />

      {/* Large typography, layered light surfaces - the amount stays the
          single largest, most legible element on the page. */}
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="relative">
            <div
              className="pointer-events-none absolute inset-0 -z-10 translate-x-3 translate-y-3 rounded-[2.5rem] bg-primary/6"
              aria-hidden
            />
            <Card className="rounded-[2.5rem] border-primary/25 bg-cream text-center shadow-[0_24px_60px_-24px_rgba(128,0,32,0.35)]">
              <CardContent className="px-6 py-16 sm:py-20">
                <Trophy className="mx-auto mb-6 h-9 w-9 text-primary" />
                <p className="font-heading text-[clamp(3.5rem,14vw,7.5rem)] font-bold leading-none tracking-tight text-primary">
                  {event.prize_pool_label}
                </p>
                <p className="mt-5 text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  Total prize pool
                </p>
                <p className="mx-auto mt-6 max-w-lg text-lg text-foreground/75">
                  {body || `${event.name} features a total prize pool of ${event.prize_pool_label}.`}
                </p>
              </CardContent>
            </Card>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StaggerReveal step={0.08}>
            {tiers.map((tier, i) => {
              const Icon = TIER_ICONS[i];
              return (
                <Card key={tier.label} className={i === 0 ? "border-primary/35 bg-cream text-center" : "text-center"}>
                  <CardContent className="py-8">
                    <Icon className={i === 0 ? "mx-auto mb-3 h-8 w-8 text-primary" : "mx-auto mb-3 h-8 w-8 text-muted-foreground"} />
                    <p className="text-sm font-medium text-muted-foreground">{tier.label}</p>
                    <p className="mt-1 font-heading text-2xl font-bold">{tier.amount}</p>
                  </CardContent>
                </Card>
              );
            })}
          </StaggerReveal>
        </div>

        <Reveal delay={0.1}>
          <Card className="mt-8 border-primary/15">
            <CardHeader>
              <CardTitle className="font-heading text-base">Additional categories</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Additional award categories, if any, will be announced by {event.organizer_name}.
            </CardContent>
          </Card>
        </Reveal>

        <div className="mt-8 space-y-4">
          {roundIds.length > 0 && hasCriteria > 0 ? (
            (rounds as unknown as Round[] | null)?.map((round, i) => {
              const roundCriteria = (criteria as unknown as JudgingCriterion[] | null)?.filter((c) => c.round_id === round.id);
              if (!roundCriteria || roundCriteria.length === 0) return null;
              const totalMarks = roundCriteria.reduce((sum, c) => sum + c.max_marks, 0);
              return (
                <Reveal key={round.id} delay={0.1 + i * 0.06}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{round.name}: evaluation criteria</CardTitle>
                      <CardDescription>Total: {totalMarks} marks</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="divide-y divide-border">
                        {roundCriteria.map((c) => (
                          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                            <span>{c.name}</span>
                            <span className="font-mono text-muted-foreground">{c.max_marks} pts</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </Reveal>
              );
            })
          ) : (
            <Reveal delay={0.1}>
              <Card>
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <Target className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading">Understand how projects are evaluated.</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-muted-foreground">
                  <p>Review the published judging criteria and round requirements to understand how your work will be assessed.</p>
                  <Button variant="outline" asChild>
                    <Link href="/rounds">
                      View evaluation criteria <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </Reveal>
          )}
        </div>
      </div>
    </main>
  );
}
