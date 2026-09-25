"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit";
import { notifySubmissionReviewDecision } from "@/lib/notifications/submission-review";
import { revalidatePath } from "next/cache";

// Req. #20: exactly three review decisions. Rejecting always requires a
// reason (also enforced at the database boundary - see
// submissions_rejected_requires_reason, 0030_...sql).
export async function reviewSubmission(
  submissionId: string,
  eventId: string,
  reviewStatus: "pending_review" | "accepted" | "rejected",
  notes: string,
) {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx) || ctx.event.id !== eventId) return { ok: false, error: "Not authorized." };

  const trimmedNotes = notes.trim();
  if (reviewStatus === "rejected" && !trimmedNotes) {
    return { ok: false, error: "A reason is required when rejecting a submission." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("submissions")
    .select("team_id, round_id, rounds(name)")
    .eq("id", submissionId)
    .maybeSingle();
  const submission = existing as unknown as { team_id: string; round_id: string; rounds: { name: string } | null } | null;
  if (!submission) return { ok: false, error: "Submission not found." };

  if (!["pending_review", "accepted", "rejected"].includes(reviewStatus)) return { ok: false, error: "Invalid decision." };

  const { data: updated, error } = await supabase
    .from("submissions")
    .update({ review_status: reviewStatus, reviewer_notes: trimmedNotes || null, reviewed_by: ctx.user.userId, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId)
    .select("id");

  if (error || !updated || updated.length !== 1) return { ok: false, error: "Could not save review." };

  await logAudit({
    actorProfileId: ctx.user.userId,
    eventId,
    action: "review_submission",
    entityType: "submissions",
    entityId: submissionId,
    after: { reviewStatus, notes: trimmedNotes },
  });

  await notifySubmissionReviewDecision({
    eventId,
    teamId: submission.team_id,
    roundId: submission.round_id,
    roundName: submission.rounds?.name ?? "your round",
    reviewStatus,
    reviewerNotes: trimmedNotes || null,
    reviewedBy: ctx.user.userId,
  });

  revalidatePath("/admin/submissions");
  revalidatePath("/portal/submission");
  revalidatePath("/portal");
  return { ok: true };
}
