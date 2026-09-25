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
      const [{ data: criteria }, { data: roundScores }, { data: qualifications }, { data: teamNames }] = await Promise.all([
        supabase.from("judging_criteria").select("*").eq("round_id", round.id).order("order_index"),
        // Aggregated, publication-gated view (0043): never exposes individual
        // judge rows or comments, and excludes disqualified teams (BUG-007,
        // BUG-014). Team names come from the equally narrow
        // public_scoreboard_teams view.
        supabase.from("public_round_scores").select("team_id, average_score, judge_count").eq("round_id", round.id),
        supabase.from("qualification_status").select("team_id, status, rank").eq("round_id", round.id),
        supabase.from("public_scoreboard_teams").select("id, team_name, reference_id"),
      ]);

      const criteriaList = (criteria as unknown as JudgingCriterion[] | null) ?? [];
      const qualByTeam = new Map(
        (qualifications as unknown as { team_id: string; status: string; rank: number | null }[] | null)?.map((q) => [
          q.team_id,
          q,
        ]) ?? [],
      );
      const nameByTeam = new Map(
        (teamNames as unknown as { id: string; team_name: string; reference_id: string }[] | null)?.map((t) => [t.id, t]) ?? [],
      );

      // Average across judges (computed in the view), not a raw sum - so a
      // team's published total doesn't inflate just because more judges scored it.
      const list: TeamTotal[] = ((roundScores as unknown as { team_id: string; average_score: number | string; judge_count: number }[] | null) ?? [])
        .filter((row) => nameByTeam.has(row.team_id))
        .map((row) => {
          const name = nameByTeam.get(row.team_id)!;
          const q = qualByTeam.get(row.team_id);
          return {
            teamId: row.team_id,
            teamName: name.team_name,
            referenceId: name.reference_id,
            total: Number(row.average_score),
            judgeCount: row.judge_count,
            qualification: q?.status,
            rank: q?.rank ?? undefined,
          };
        });

      // Admin-assigned rank (qualification_status) wins first when set - an
      // organizer decision, not purely computed. Below that: total score
      // descending, then team name ascending as a final deterministic
      // fallback so a genuine tie never reorders itself on refresh (row
      // order from the database is not otherwise guaranteed stable).
      list.sort(
        (a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.total - a.total || a.teamName.localeCompare(b.teamName),
      );

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
