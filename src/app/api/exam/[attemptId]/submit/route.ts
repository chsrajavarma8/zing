import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedAttempt } from "@/lib/exam/attempt";
import { gradeAnswer } from "@/lib/exam/grading";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const result = await getOwnedAttempt(admin, attemptId, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  if (result.attempt.status !== "in_progress") {
    // Already submitted/auto-submitted (e.g. by the expiry check above) - idempotent success.
    return NextResponse.json({ ok: true, status: result.attempt.status });
  }

  const { data: answers } = await admin
    .from("exam_answers")
    .select("id, answer, exam_questions(id, question_type, correct_answer, marks)")
    .eq("attempt_id", attemptId);

  let total = 0;
  for (const a of (answers as unknown as
    | { id: string; answer: unknown; exam_questions: { id: string; question_type: "mcq_single" | "mcq_multi" | "short_text"; correct_answer: unknown; marks: number } | null }[]
    | null) ?? []) {
    if (!a.exam_questions) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { isCorrect, marksAwarded } = gradeAnswer(a.exam_questions as any, a.answer as any);
    await admin.from("exam_answers").update({ is_correct: isCorrect, marks_awarded: marksAwarded }).eq("id", a.id);
    total += marksAwarded ?? 0;
  }

  const { error } = await admin
    .from("exam_attempts")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), score: total })
    .eq("id", attemptId)
    .eq("status", "in_progress");

  if (error) return NextResponse.json({ error: "Could not submit exam." }, { status: 500 });
  return NextResponse.json({ ok: true, status: "submitted" });
}
