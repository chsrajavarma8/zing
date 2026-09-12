"use server";

import { createClient } from "@/lib/supabase/server";
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

export async function saveScore(roundId: string, teamId: string, criterionId: string, marks: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("scores")
    .upsert(
      { round_id: roundId, team_id: teamId, criterion_id: criterionId, judge_id: user.id, marks },
      { onConflict: "round_id,team_id,criterion_id,judge_id" },
    );

  if (error) return { ok: false, error: "Could not save score." };
  revalidatePath("/admin/judging");
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
