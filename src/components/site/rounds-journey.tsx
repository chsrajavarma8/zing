"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "@/components/motion/reveal";
import { useActiveSection } from "@/lib/use-active-section";
import { cn } from "@/lib/utils";
import { Clock, ArrowRight, ShieldCheck, Layers, Trophy } from "lucide-react";
import type { Round, Exam } from "@/types/database";

const ROUND_META: Record<string, { title: string; body: string; icon: React.ComponentType<{ className?: string }>; button: string }> = {
  minor: {
    title: "Minor Round: Talent Evaluation",
    body: "Complete the online screening assessment during your assigned exam window. Review the instructions carefully before starting.",
    icon: ShieldCheck,
    button: "View exam instructions",
  },
  intermediate: {
    title: "Intermediate Round: Develop Your Solution",
    body: "Build on your selected problem statement and prepare the project materials required for this stage.",
    icon: Layers,
    button: "View round requirements",
  },
  major: {
    title: "Major Round: Present and Demonstrate",
    body: "Present your final project, demonstrate the solution, and explain its implementation and impact.",
    icon: Trophy,
    button: "View final-round guidelines",
  },
};

function fmt(v: string | null) {
  return v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "To be announced";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function RoundsJourney({ rounds, exams }: { rounds: Round[]; exams: Exam[] }) {
  const ids = rounds.map((r) => `round-${r.id}`);
  const active = useActiveSection(ids);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-16">
      {/* Desktop: sticky index. Ends naturally at the bottom of its own
          column (no artificial pin/trap) since it's just `sticky` within a
          grid cell the same height as the content column. */}
      <div className="hidden lg:block">
        <div className="sticky top-28 space-y-1">
          {rounds.map((r, i) => {
            const isActive = active === `round-${r.id}`;
            return (
              <a
                key={r.id}
                href={`#round-${r.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("font-heading text-xs font-bold", isActive ? "text-rose" : "text-muted-foreground/60")}>
                  0{i + 1}
                </span>
                {r.name}
              </a>
            );
          })}
        </div>
      </div>

      {/* Content: natural vertical flow on every breakpoint - never
          horizontal scroll, never pinned on mobile. */}
      <div className="space-y-16">
        {rounds.map((round, i) => {
          const exam = exams.find((e) => e.round_id === round.id);
          const meta = ROUND_META[round.key];
          const Icon = meta?.icon ?? Trophy;
          const hasConfiguredDetails = Boolean(round.deliverables || round.evaluation_criteria || round.advancement_rules || exam);

          return (
            <Reveal key={round.id} id={`round-${round.id}`} y={24}>
              <div className="flex items-center gap-3 lg:hidden">
                <span className="font-heading text-sm font-bold text-rose">0{i + 1}</span>
                <div className="h-px flex-1 bg-primary/15" />
              </div>
              <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-cream text-primary lg:mt-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge>{`Round ${i + 1}`}</Badge>
                <Badge variant="outline" className="capitalize">{round.status}</Badge>
              </div>
              <h2 className="mt-3 font-heading text-3xl font-bold">{meta?.title ?? round.name}</h2>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground">{meta?.body ?? round.description}</p>

              <div className="mt-6 space-y-4">
                {round.key === "minor" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Exam window" value={exam ? `${fmt(exam.starts_at)} – ${fmt(exam.ends_at)}` : "To be announced"} />
                    <Field label="Duration" value={exam ? `${exam.duration_minutes} minutes` : "To be announced"} />
                    <Field label="Format" value={exam ? "Online screening assessment" : "To be announced"} />
                    <Field label="Qualification criteria" value={round.advancement_rules || "To be announced"} />
                  </div>
                ) : round.key === "intermediate" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Required deliverables" value={round.deliverables || "To be announced"} />
                    <Field label="Evaluation criteria" value={round.evaluation_criteria || "To be announced"} />
                    <Field label="Deadline" value={fmt(round.ends_at)} />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Presentation format" value={round.deliverables || "To be announced"} />
                    <Field label="Demo requirements" value={round.evaluation_criteria || "To be announced"} />
                    <Field label="Schedule" value={round.starts_at ? `${fmt(round.starts_at)} – ${fmt(round.ends_at)}` : "To be announced"} />
                    <Field label="Evaluation criteria" value={round.advancement_rules || "To be announced"} />
                  </div>
                )}

                {!hasConfiguredDetails && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> Detailed requirements will be published by the organizers.
                  </p>
                )}

                <Separator className="bg-primary/12" />
                <Button variant="outline" asChild>
                  <Link href="/rules">
                    {meta?.button ?? "View round requirements"} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
