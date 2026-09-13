import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { roundPhaseLabel } from "@/lib/rounds";
import { formatDateTime } from "@/lib/date";
import type { Round } from "@/types/database";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 font-heading text-lg font-semibold">{title}</h2>
      <div className="text-sm text-muted-foreground whitespace-pre-line">{children}</div>
    </div>
  );
}

// Shared by /rounds/minor and /rounds/advanced - one round's full public
// content (introduction, criteria, guidelines, categories, rules, schedule).
// Actual submission only ever happens in the portal (/portal/submission) -
// this page is informational only, no submission status/CTA here.
export function RoundDetail({ round }: { round: Round }) {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-16 sm:px-6">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold">{round.name}</h1>
          <Badge>{roundPhaseLabel(round)}</Badge>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Section title="Introduction">
          {round.description || "Details for this round will be published by the organizers."}
        </Section>
      </Reveal>

      {round.evaluation_criteria && (
        <Reveal delay={0.08}>
          <Section title="Judging Criteria">{round.evaluation_criteria}</Section>
        </Reveal>
      )}

      {round.evaluation_guidelines && (
        <Reveal delay={0.1}>
          <Section title="Evaluation Guidelines">{round.evaluation_guidelines}</Section>
        </Reveal>
      )}

      {round.categories && (
        <Reveal delay={0.12}>
          <Section title="Categories">{round.categories}</Section>
        </Reveal>
      )}

      {round.advancement_rules && (
        <Reveal delay={0.14}>
          <Section title="Rules & Instructions">{round.advancement_rules}</Section>
        </Reveal>
      )}

      {round.deliverables && (
        <Reveal delay={0.16}>
          <Section title="Submission Requirements">{round.deliverables}</Section>
        </Reveal>
      )}

      <Reveal delay={0.18}>
        <Section title="Schedule">
          {round.starts_at || round.ends_at
            ? `${round.starts_at ? formatDateTime(round.starts_at) : "TBA"} – ${round.ends_at ? formatDateTime(round.ends_at) : "TBA"}`
            : "To be announced."}
        </Section>
      </Reveal>
    </div>
  );
}
