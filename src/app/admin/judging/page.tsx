import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { JudgingPanel } from "@/components/admin/judging-panel";
import type { Round, JudgingCriterion, Team } from "@/types/database";

export default async function AdminJudgingPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", ctx.event.id).order("order_index");
  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const activeRound = roundList.find((r) => r.id === sp.round) ?? roundList[0];

  if (!activeRound) {
    return <p className="text-muted-foreground">No rounds configured yet.</p>;
  }

  const [{ data: criteria }, { data: teams }, { data: finalScores }, { data: publications }, { data: qualifications }] = await Promise.all([
    supabase.from("judging_criteria").select("*").eq("round_id", activeRound.id).order("order_index"),
    supabase.from("teams").select("*").eq("event_id", ctx.event.id).neq("status", "disqualified").order("team_name"),
    supabase.from("final_scores").select("*, profiles(full_name, email)").eq("round_id", activeRound.id),
    supabase.from("publications").select("*").eq("round_id", activeRound.id),
    supabase.from("qualification_status").select("*").eq("round_id", activeRound.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Judging & Scores</h1>
        <p className="text-muted-foreground">Enter marks, control publication, and set qualification per round.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {roundList.map((r) => (
          <a
            key={r.id}
            href={`/admin/judging?round=${r.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${r.id === activeRound.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            {r.name}
          </a>
        ))}
      </div>

      <JudgingPanel
        round={activeRound}
        eventId={ctx.event.id}
        currentUserId={ctx.user.userId}
        canManage={canManage(ctx)}
        criteria={(criteria as unknown as JudgingCriterion[] | null) ?? []}
        teams={(teams as unknown as Team[] | null) ?? []}
        finalScores={
          (finalScores as unknown as
            | { id: string; team_id: string; judge_id: string; score: number; comments: string | null; profiles: { full_name: string | null; email: string } | null }[]
            | null) ?? []
        }
        publications={(publications as unknown as { scope: string; is_published: boolean; reviewer_feedback_visible: boolean }[] | null) ?? []}
        qualifications={(qualifications as unknown as { team_id: string; status: string; rank: number | null }[] | null) ?? []}
      />
    </div>
  );
}
