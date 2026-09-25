"use server";

import { createClient } from "@/lib/supabase/server";
import { requireManager, requireStaff } from "@/lib/auth/admin-guards";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// Every action authorizes role + event scope up front and confirms the row
// it changed (BUG-011). Reviewers may enter their own scores; everything
// else here is event_admin/super_admin only.

async function roundInEvent(roundId: string, eventId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("rounds").select("id").eq("id", roundId).eq("event_id", eventId).maybeSingle();
  return Boolean(data);
}

async function teamInEvent(teamId: string, eventId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("id").eq("id", teamId).eq("event_id", eventId).maybeSingle();
  return Boolean(data);
}

export async function upsertCriterion(roundId: string, input: { id?: string; name: string; maxMarks: number; weight: number; orderIndex: number }) {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const eventId = guard.ctx.event.id;
  if (!(await roundInEvent(roundId, eventId))) return { ok: false, error: "Round not found." };

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 200) return { ok: false, error: "Enter a criterion name." };
  if (!Number.isFinite(input.maxMarks) || input.maxMarks <= 0 || !Number.isFinite(input.weight) || input.weight < 0) {
    return { ok: false, error: "Max marks must be positive and weight must not be negative." };
  }

  const supabase = await createClient();
  const payload = { round_id: roundId, name, max_marks: input.maxMarks, weight: input.weight, order_index: Math.trunc(input.orderIndex) || 0 };
  const { data, error } = input.id
    ? await supabase.from("judging_criteria").update(payload).eq("id", input.id).eq("round_id", roundId).select("id")
    : await supabase.from("judging_criteria").insert(payload).select("id");

  if (error || !data || data.length !== 1) return { ok: false, error: "Could not save criterion." };
  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "upsert_judging_criterion", entityType: "judging_criteria", entityId: data[0].id as string, after: payload });
  revalidatePath("/admin/judging");
  return { ok: true };
}

export async function deleteCriterion(criterionId: string) {
  const guard = await requireManager();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data: criterion } = await supabase.from("judging_criteria").select("id, round_id").eq("id", criterionId).maybeSingle();
  const c = criterion as { id: string; round_id: string } | null;
  if (!c || !(await roundInEvent(c.round_id, guard.ctx.event.id))) return { ok: false, error: "Criterion not found." };

  const { data, error } = await supabase.from("judging_criteria").delete().eq("id", criterionId).select("id");
  if (error || !data || data.length !== 1) return { ok: false, error: "Could not delete." };
  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId: guard.ctx.event.id, action: "delete_judging_criterion", entityType: "judging_criteria", entityId: criterionId });
  revalidatePath("/admin/judging");
  return { ok: true };
}

// Req. #9: each judge enters exactly one final score per team per round,
// 1-100 inclusive - validated here and by the final_scores check constraint.
export async function saveFinalScore(roundId: string, teamId: string, score: number, comments?: string) {
  const guard = await requireStaff();
  if (!guard.ok) return guard;
  const eventId = guard.ctx.event.id;

  if (!Number.isFinite(score) || score < 1 || score > 100) {
    return { ok: false, error: "Score must be between 1 and 100." };
  }
  if (typeof comments === "string" && comments.length > 5000) return { ok: false, error: "Comments are too long." };
  if (!(await roundInEvent(roundId, eventId)) || !(await teamInEvent(teamId, eventId))) {
    return { ok: false, error: "Team or round not found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("final_scores")
    .upsert(
      { round_id: roundId, team_id: teamId, judge_id: guard.ctx.user.userId, score, comments: comments?.trim() || null },
      { onConflict: "round_id,team_id,judge_id" },
    )
    .select("id");

  if (error || !data || data.length !== 1) return { ok: false, error: "Could not save score." };
  revalidatePath("/admin/judging");
  revalidatePath("/scoreboard");
  return { ok: true };
}

// Admin-only: removes one judge's final score for one team in one round.
export async function deleteFinalScore(scoreId: string, eventId: string) {
  const guard = await requireManager(eventId);
  if (!guard.ok) return { ok: false, error: "You do not have permission to delete results." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("final_scores")
    .select("id, round_id, team_id, judge_id, score")
    .eq("id", scoreId)
    .maybeSingle();
  const row = existing as { id: string; round_id: string } | null;
  if (!row || !(await roundInEvent(row.round_id, eventId))) return { ok: false, error: "This result could not be found." };

  const { data, error } = await supabase.from("final_scores").delete().eq("id", scoreId).select("id");
  if (error || !data || data.length !== 1) return { ok: false, error: "Could not delete this result. Please try again." };

  await logAudit({
    actorProfileId: guard.ctx.user.userId,
    eventId,
    action: "delete_final_score",
    entityType: "final_scores",
    entityId: scoreId,
    before: existing,
  });

  revalidatePath("/admin/judging");
  revalidatePath("/scoreboard");
  return { ok: true };
}

export async function setPublication(roundId: string, eventId: string, scope: "participant" | "public", isPublished: boolean, reviewerFeedbackVisible: boolean) {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;
  if (scope !== "participant" && scope !== "public") return { ok: false, error: "Invalid scope." };
  if (!(await roundInEvent(roundId, eventId))) return { ok: false, error: "Round not found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .upsert(
      {
        round_id: roundId,
        scope,
        is_published: Boolean(isPublished),
        published_by: guard.ctx.user.userId,
        published_at: isPublished ? new Date().toISOString() : null,
        reviewer_feedback_visible: Boolean(reviewerFeedbackVisible),
      },
      { onConflict: "round_id,scope" },
    )
    .select("id");

  if (error || !data || data.length !== 1) return { ok: false, error: "Could not update publication." };
  await logAudit({
    actorProfileId: guard.ctx.user.userId,
    eventId,
    action: isPublished ? "publish_results" : "unpublish_results",
    entityType: "publications",
    entityId: roundId,
    after: { scope, isPublished, reviewerFeedbackVisible },
  });
  revalidatePath("/admin/judging");
  revalidatePath("/scoreboard");
  revalidatePath("/portal/results");
  return { ok: true };
}

export async function setQualification(roundId: string, teamId: string, eventId: string, status: "qualified" | "not_qualified" | "pending", rank: number | null) {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;
  if (!["qualified", "not_qualified", "pending"].includes(status)) return { ok: false, error: "Invalid status." };
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 100000)) return { ok: false, error: "Rank must be a positive whole number." };
  if (!(await roundInEvent(roundId, eventId)) || !(await teamInEvent(teamId, eventId))) return { ok: false, error: "Team or round not found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qualification_status")
    .upsert(
      { round_id: roundId, team_id: teamId, status, rank, decided_by: guard.ctx.user.userId, decided_at: new Date().toISOString() },
      { onConflict: "team_id,round_id" },
    )
    .select("id");

  if (error || !data || data.length !== 1) return { ok: false, error: "Could not update qualification." };
  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "set_qualification", entityType: "qualification_status", entityId: teamId, after: { roundId, status, rank } });
  revalidatePath("/admin/judging");
  return { ok: true };
}
