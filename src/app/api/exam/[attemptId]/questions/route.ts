import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedAttempt } from "@/lib/exam/attempt";
import { seededShuffle } from "@/lib/exam/shuffle";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const result = await getOwnedAttempt(admin, attemptId, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const { data: exam } = await admin.from("exams").select("shuffle_questions").eq("id", result.attempt.exam_id).maybeSingle();
  const shuffle = (exam as unknown as { shuffle_questions: boolean } | null)?.shuffle_questions ?? true;

  const { data: questions } = await admin
    .from("exam_questions")
    .select("id, question_text, question_type, options, marks, order_index")
    .eq("exam_id", result.attempt.exam_id)
    .order("order_index");

  const { data: answers } = await admin
    .from("exam_answers")
    .select("question_id, answer")
    .eq("attempt_id", attemptId);

  const list = (questions as unknown as { id: string; question_text: string; question_type: string; options: unknown; marks: number }[] | null) ?? [];
  const ordered = shuffle ? seededShuffle(list, attemptId) : list;

  return NextResponse.json({
    status: result.attempt.status,
    expiresAt: result.attempt.expires_at,
    questions: ordered,
    answers: (answers as unknown as { question_id: string; answer: unknown }[] | null) ?? [],
  });
}
