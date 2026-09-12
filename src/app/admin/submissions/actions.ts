"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function reviewSubmission(
  submissionId: string,
  eventId: string,
  reviewStatus: "pending" | "accessible" | "access_issue" | "accepted",
  notes: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("submissions")
    .update({ review_status: reviewStatus, reviewer_notes: notes || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  if (error) return { ok: false, error: "Could not save review." };
  await logAudit({
    actorProfileId: user.id,
    eventId,
    action: "review_submission",
    entityType: "submissions",
    entityId: submissionId,
    after: { reviewStatus, notes },
  });
  revalidatePath("/admin/submissions");
  return { ok: true };
}
