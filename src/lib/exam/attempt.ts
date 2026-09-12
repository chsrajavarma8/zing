import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gradeAnswer } from "./grading";

export interface OwnedAttempt {
  id: string;
  exam_id: string;
  team_member_id: string;
  expires_at: string;
  status: "in_progress" | "submitted" | "auto_submitted" | "disqualified";
}

// Loads an attempt and verifies it belongs to the signed-in user, then
// applies server-authoritative expiry: if the clock has passed expires_at
// and the attempt is still "in_progress", it is auto-submitted and graded
// right here, before returning - the client's countdown is cosmetic only.
export type OwnedAttemptResult =
  | { ok: true; attempt: OwnedAttempt }
  | { ok: false; error: string; status: number };

export async function getOwnedAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  attemptId: string,
  userId: string,
): Promise<OwnedAttemptResult> {
  const { data: attempt } = await admin
    .from("exam_attempts")
    .select("id, exam_id, team_member_id, expires_at, status, team_members(profile_id)")
    .eq("id", attemptId)
    .maybeSingle();

  const row = attempt as unknown as (OwnedAttempt & { team_members: { profile_id: string | null } | null }) | null;
  if (!row) return { ok: false, error: "Attempt not found.", status: 404 };
  if (row.team_members?.profile_id !== userId) return { ok: false, error: "Not your attempt.", status: 403 };

  if (row.status === "in_progress" && Date.now() > Date.parse(row.expires_at)) {
    await autoSubmit(admin, row.id);
    return { ok: true, attempt: { ...row, status: "auto_submitted" } };
  }

  return { ok: true, attempt: row };
}

export async function autoSubmit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  attemptId: string,
) {
  const { data: answers } = await admin.from("exam_answers").select("*, exam_questions(*)").eq("attempt_id", attemptId);

  let total = 0;
  for (const a of (answers as unknown as { id: string; answer: unknown; exam_questions: { id: string; question_type: string; correct_answer: unknown; marks: number } }[] | null) ?? []) {
    const q = a.exam_questions;
    if (!q) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { isCorrect, marksAwarded } = gradeAnswer(q as any, a.answer as any);
    await admin.from("exam_answers").update({ is_correct: isCorrect, marks_awarded: marksAwarded }).eq("id", a.id);
    total += marksAwarded ?? 0;
  }

  await admin
    .from("exam_attempts")
    .update({ status: "auto_submitted", submitted_at: new Date().toISOString(), score: total })
    .eq("id", attemptId)
    .eq("status", "in_progress");
}
