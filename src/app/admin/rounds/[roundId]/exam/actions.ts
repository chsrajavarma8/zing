"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export interface QuestionInput {
  questionText: string;
  questionType: "mcq_single" | "mcq_multi" | "short_text";
  options: { id: string; label: string }[];
  correctAnswer: { selected: string | string[] } | null;
  marks: number;
  orderIndex: number;
}

export async function upsertQuestion(examId: string, roundId: string, input: QuestionInput, questionId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const payload = {
    exam_id: examId,
    question_text: input.questionText,
    question_type: input.questionType,
    options: input.questionType === "short_text" ? [] : input.options,
    correct_answer: input.questionType === "short_text" ? null : input.correctAnswer,
    marks: input.marks,
    order_index: input.orderIndex,
  };

  const { error } = questionId
    ? await supabase.from("exam_questions").update(payload).eq("id", questionId)
    : await supabase.from("exam_questions").insert(payload);

  if (error) return { ok: false, error: "Could not save question." };
  await logAudit({
    actorProfileId: user.id,
    action: questionId ? "update_exam_question" : "create_exam_question",
    entityType: "exam_questions",
    entityId: questionId ?? examId,
    after: payload,
  });
  revalidatePath(`/admin/rounds/${roundId}/exam`);
  return { ok: true };
}

export async function deleteQuestion(questionId: string, roundId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("exam_questions").delete().eq("id", questionId);
  if (error) return { ok: false, error: "Could not delete question." };
  await logAudit({ actorProfileId: user.id, action: "delete_exam_question", entityType: "exam_questions", entityId: questionId });
  revalidatePath(`/admin/rounds/${roundId}/exam`);
  return { ok: true };
}
