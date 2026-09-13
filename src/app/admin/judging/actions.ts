"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function upsertCriterion(roundId: string, input: { id?: string; name: string; maxMarks: number; weight: number; orderIndex: number }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const payload = { round_id: roundId, name: input.name, max_marks: input.maxMarks, weight: input.weight, order_index: input.orderIndex };
  const { error } = input.id
    ? await supabase.from("judging_criteria").update(payload).eq("id", input.id)
    : await supabase.from("judging_criteria").insert(payload);

  if (error) return { ok: false, error: "Could not save criterion." };
  await logAudit({ actorProfileId: user.id, action: "upsert_judging_criterion", entityType: "judging_criteria", entityId: input.id ?? roundId, after: payload });
  revalidatePath("/admin/judging");
  return { ok: true };
}

export async function deleteCriterion(criterionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("judging_criteria").delete().eq("id", criterionId);
  if (error) return { ok: false, error: "Could not delete." };
  revalidatePath("/admin/judging");
  return { ok: true };
}

// Req. #9: each judge enters exactly one final score per team per round,
// 1-100 inclusive - validated here (frontend also validates in
// FinalScoreInput) and again at the database boundary by the
// final_scores.score check constraint (0026_final_scores.sql), so a direct
// PostgREST/Supabase-JS call can't bypass the range either.
export async function saveFinalScore(roundId: string, teamId: string, score: number, comments?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!Number.isFinite(score) || score < 1 || score > 100) {
    return { ok: false, error: "Score must be between 1 and 100." };
  }

  const { error } = await supabase
    .from("final_scores")
    .upsert(
      { round_id: roundId, team_id: teamId, judge_id: user.id, score, comments: comments?.trim() || null },
      { onConflict: "round_id,team_id,judge_id" },
    );

  if (error) return { ok: false, error: "Could not save score." };
  revalidatePath("/admin/judging");
  revalidatePath("/scoreboard");
  return { ok: true };
}

// Admin-only (never trusts a client-supplied permission check): removes one
// judge's final score for one team in one round. RLS (final_scores_delete,
// 0038_final_scores_delete.sql) is the real boundary underneath - this check
// only turns a denial into a clear message instead of a generic RLS error.
// Deletes exactly the selected row: never the team, its members, its
// submissions, or any other round/judge's score. final_score_audit rows for
// this score cascade automatically (its own FK); nothing else does.
export async function deleteFinalScore(scoreId: string, eventId: string) {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx) || ctx.event.id !== eventId) {
    return { ok: false, error: "You do not have permission to delete results." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("final_scores")
    .select("id, round_id, team_id, judge_id, score")
    .eq("id", scoreId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "This result could not be found." };

  const { error } = await supabase.from("final_scores").delete().eq("id", scoreId);
  if (error) return { ok: false, error: "Could not delete this result. Please try again." };

  await logAudit({
    actorProfileId: ctx.user.userId,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("publications").upsert(
    {
      round_id: roundId,
      scope,
      is_published: isPublished,
      published_by: user.id,
      published_at: isPublished ? new Date().toISOString() : null,
      reviewer_feedback_visible: reviewerFeedbackVisible,
    },
    { onConflict: "round_id,scope" },
  );

  if (error) return { ok: false, error: "Could not update publication." };
  await logAudit({
    actorProfileId: user.id,
    eventId,
    action: isPublished ? "publish_results" : "unpublish_results",
    entityType: "publications",
    entityId: roundId,
    after: { scope, isPublished },
  });
  revalidatePath("/admin/judging");
  revalidatePath("/scoreboard");
  return { ok: true };
}

export async function setQualification(roundId: string, teamId: string, eventId: string, status: "qualified" | "not_qualified" | "pending", rank: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("qualification_status")
    .upsert({ round_id: roundId, team_id: teamId, status, rank, decided_by: user.id, decided_at: new Date().toISOString() }, { onConflict: "team_id,round_id" });

  if (error) return { ok: false, error: "Could not update qualification." };
  await logAudit({ actorProfileId: user.id, eventId, action: "set_qualification", entityType: "qualification_status", entityId: teamId, after: { roundId, status, rank } });
  revalidatePath("/admin/judging");
  return { ok: true };
}
