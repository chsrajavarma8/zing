import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy, Clock } from "lucide-react";
import type { Round, JudgingCriterion } from "@/types/database";

export default async function MyResultsPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", portal.event.id).order("order_index");
  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const roundIds = roundList.map((r) => r.id);

  const [{ data: publications }, { data: criteria }, { data: scores }, { data: qualifications }] = await Promise.all([
    supabase.from("publications").select("round_id, scope, is_published, reviewer_feedback_visible").in("round_id", roundIds.length ? roundIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("judging_criteria").select("*").in("round_id", roundIds.length ? roundIds : ["00000000-0000-0000-0000-000000000000"]).order("order_index"),
    // The comments column is masked server-side by this view unless the
    // round's participant publication explicitly marked reviewer feedback
    // visible - RLS on the base `scores` table is row-level only and can't
    // hide just that column (see 0017_security_hardening.sql).
    supabase.from("scores_participant_visible").select("*").eq("team_id", portal.team.id),
    supabase.from("qualification_status").select("*").eq("team_id", portal.team.id),
  ]);

  const pubByRound = new Map<string, { published: boolean; feedbackVisible: boolean }>();
  for (const p of (publications as unknown as { round_id: string; scope: string; is_published: boolean; reviewer_feedback_visible: boolean }[] | null) ?? []) {
    if (p.scope !== "participant") continue;
    pubByRound.set(p.round_id, { published: p.is_published, feedbackVisible: p.reviewer_feedback_visible });
  }

  const criteriaByRound = new Map<string, JudgingCriterion[]>();
  for (const c of (criteria as unknown as JudgingCriterion[] | null) ?? []) {
    const list = criteriaByRound.get(c.round_id) ?? [];
    list.push(c);
    criteriaByRound.set(c.round_id, list);
  }

  const scoresByRound = new Map<string, { criterion_id: string; marks: number; comments: string | null }[]>();
  for (const s of (scores as unknown as { round_id: string; criterion_id: string; marks: number; comments: string | null }[] | null) ?? []) {
    const list = scoresByRound.get(s.round_id) ?? [];
    list.push(s);
    scoresByRound.set(s.round_id, list);
  }

  const qualByRound = new Map((qualifications as unknown as { round_id: string; status: string; rank: number | null }[] | null)?.map((q) => [q.round_id, q]) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Your scores and feedback</h1>
        <p className="text-muted-foreground">Review released marks and your team&apos;s progress.</p>
      </div>

      <div className="space-y-4">
        {roundList.map((round) => {
          const pub = pubByRound.get(round.id);
          const roundCriteria = criteriaByRound.get(round.id) ?? [];
          const roundScores = scoresByRound.get(round.id) ?? [];
          const qual = qualByRound.get(round.id);

          if (!pub?.published) {
            return (
              <Card key={round.id}>
                <CardHeader>
                  <CardTitle className="text-base">{round.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2 py-6 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Your results have not been released yet.
                </CardContent>
              </Card>
            );
          }

          // Multiple judges may score the same criterion - sum per criterion, same as the scoreboard.
          const marksByCriterion = new Map<string, number>();
          for (const s of roundScores) {
            marksByCriterion.set(s.criterion_id, (marksByCriterion.get(s.criterion_id) ?? 0) + s.marks);
          }
          const total = Array.from(marksByCriterion.values()).reduce((a, b) => a + b, 0);
          const feedbackComments = pub.feedbackVisible ? roundScores.map((s) => s.comments).filter(Boolean) : [];

          return (
            <Card key={round.id} className="card-glow">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="font-heading">{round.name}</CardTitle>
                  {qual?.status && (
                    <Badge variant={qual.status === "qualified" ? "default" : "secondary"}>{qual.status.replace("_", " ")}</Badge>
                  )}
                </div>
                {qual?.rank && <CardDescription>Rank: {qual.rank}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-4">
                {roundCriteria.length > 0 ? (
                  <div className="space-y-2">
                    {roundCriteria.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{c.name}</span>
                        <span className="font-mono">
                          {marksByCriterion.get(c.id)?.toFixed(1) ?? "N/A"} / {c.max_marks}
                        </span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-primary" /> Total
                      </span>
                      <span className="font-mono">{total.toFixed(1)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No criterion-level scores recorded for this round.</p>
                )}

                {feedbackComments.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Published feedback</p>
                    {feedbackComments.map((c, i) => (
                      <p key={i} className="text-sm">{c}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {roundList.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">No rounds configured yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
