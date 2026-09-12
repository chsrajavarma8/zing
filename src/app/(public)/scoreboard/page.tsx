import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/site/page-header";
import { PublicScoreboard } from "@/components/site/public-scoreboard";
import { Trophy } from "lucide-react";
import type { Round, JudgingCriterion } from "@/types/database";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Scoreboard",
  description: "See published team scores and qualification status for Zing Hackathon.",
  path: "/scoreboard",
});

interface TeamTotal {
  teamId: string;
  teamName: string;
  referenceId: string;
  total: number;
  judgeCount: number;
  qualification?: string;
  rank?: number;
}

export default async function ScoreboardPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", event.id).order("order_index");
  const roundList = (rounds as unknown as Round[] | null) ?? [];

  const { data: publications } = await supabase
    .from("publications")
    .select("round_id, scope, is_published")
    .eq("scope", "public");

  const publishedRoundIds = new Set(
    (publications as unknown as { round_id: string; is_published: boolean }[] | null)
      ?.filter((p) => p.is_published)
      .map((p) => p.round_id) ?? [],
  );

  const publishedRounds = roundList.filter((r) => publishedRoundIds.has(r.id));

  const boards = await Promise.all(
    publishedRounds.map(async (round) => {
      const [{ data: criteria }, { data: finalScores }, { data: qualifications }] = await Promise.all([
        supabase.from("judging_criteria").select("*").eq("round_id", round.id).order("order_index"),
        // Base table, not the *_participant_visible view: PostgREST's
        // relationship embedding (teams(...)) is only reliably resolved
        // through real foreign keys on a table, and this query never
        // selects `comments` anyway, so the view's masking has nothing to
        // protect here - RLS (is_scope_published('public')) is identical
        // either way.
        supabase
          .from("final_scores")
          .select("team_id, score, teams(team_name, reference_id)")
          .eq("round_id", round.id),
        supabase.from("qualification_status").select("team_id, status, rank").eq("round_id", round.id),
      ]);

      const criteriaList = (criteria as unknown as JudgingCriterion[] | null) ?? [];
      const qualByTeam = new Map(
        (qualifications as unknown as { team_id: string; status: string; rank: number | null }[] | null)?.map((q) => [
          q.team_id,
          q,
        ]) ?? [],
      );

      const teams = new Map<string, TeamTotal>();
      for (const row of (finalScores as unknown as
        | { team_id: string; score: number; teams: { team_name: string; reference_id: string } | null }[]
        | null) ?? []) {
        const existing = teams.get(row.team_id) ?? {
          teamId: row.team_id,
          teamName: row.teams?.team_name ?? "Unknown",
          referenceId: row.teams?.reference_id ?? "",
          total: 0,
          judgeCount: 0,
        };
        existing.total += row.score;
        existing.judgeCount += 1;
        teams.set(row.team_id, existing);
      }

      // Average across judges, not a raw sum - so a team's published total
      // doesn't mechanically inflate just because more judges scored it.
      const list = Array.from(teams.values()).map((t) => {
        const total = t.judgeCount > 0 ? t.total / t.judgeCount : 0;
        const q = qualByTeam.get(t.teamId);
        return { ...t, total, qualification: q?.status, rank: q?.rank ?? undefined };
      });

      list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.total - a.total);

      return { round, criteria: criteriaList, teams: list };
    }),
  );

  return (
    <main>
      <PageHeader eyebrow="Live results" title={`${event.name} Scoreboard`} description="Explore published scores and qualification results." />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        {boards.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Trophy className="mx-auto mb-3 h-8 w-8" />
            <p>Results have not been published yet.</p>
          </div>
        ) : (
          <PublicScoreboard boards={boards} />
        )}
      </div>
    </main>
  );
}
