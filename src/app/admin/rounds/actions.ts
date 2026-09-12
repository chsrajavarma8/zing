"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { Round } from "@/types/database";

export type RoundUpdateInput = Partial<
  Pick<Round, "name" | "description" | "deliverables" | "evaluation_criteria" | "advancement_rules" | "starts_at" | "ends_at" | "status">
>;

export async function updateRound(roundId: string, eventId: string, input: RoundUpdateInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("rounds").update(input).eq("id", roundId);
  if (error) return { ok: false, error: "Could not save round." };

  await logAudit({ actorProfileId: user.id, eventId, action: "update_round", entityType: "rounds", entityId: roundId, after: input });
  revalidatePath("/admin/rounds");
  revalidatePath("/rounds");
  return { ok: true };
}

export async function upsertExam(
  roundId: string,
  eventId: string,
  input: {
    title: string;
    instructions: string;
    durationMinutes: number;
    startsAt: string;
    endsAt: string;
    shuffleQuestions: boolean;
    qualificationRule: { type: "top_n" | "min_score"; n?: number; value?: number };
    answerKeyReleaseAt: string | null;
    status: "draft" | "scheduled" | "live" | "closed";
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase.from("exams").select("id").eq("round_id", roundId).maybeSingle();
  const existingRow = existing as unknown as { id: string } | null;

  const payload = {
    round_id: roundId,
    title: input.title,
    instructions: input.instructions,
    duration_minutes: input.durationMinutes,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    shuffle_questions: input.shuffleQuestions,
    qualification_rule: input.qualificationRule,
    answer_key_release_at: input.answerKeyReleaseAt,
    status: input.status,
  };

  const { error } = existingRow
    ? await supabase.from("exams").update(payload).eq("id", existingRow.id)
    : await supabase.from("exams").insert(payload);

  if (error) return { ok: false, error: "Could not save exam." };
  await logAudit({ actorProfileId: user.id, eventId, action: "upsert_exam", entityType: "exams", entityId: roundId, after: payload });
  revalidatePath(`/admin/rounds/${roundId}/exam`);
  return { ok: true };
}
