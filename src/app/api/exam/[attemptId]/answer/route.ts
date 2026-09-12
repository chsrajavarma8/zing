import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedAttempt } from "@/lib/exam/attempt";

export async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { questionId, answer } = await req.json().catch(() => ({ questionId: null, answer: null }));
  if (!questionId) return NextResponse.json({ error: "Missing questionId." }, { status: 400 });

  const admin = createAdminClient();
  const result = await getOwnedAttempt(admin, attemptId, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  if (result.attempt.status !== "in_progress") {
    return NextResponse.json({ error: "This attempt is no longer active.", status: result.attempt.status }, { status: 409 });
  }

  const { error } = await admin
    .from("exam_answers")
    .upsert(
      { attempt_id: attemptId, question_id: questionId, answer, autosaved_at: new Date().toISOString() },
      { onConflict: "attempt_id,question_id" },
    );

  if (error) return NextResponse.json({ error: "Could not save answer." }, { status: 500 });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
