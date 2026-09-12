"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { Round } from "@/types/database";

export type RoundUpdateInput = Partial<
  Pick<Round, "name" | "description" | "deliverables" | "evaluation_criteria" | "advancement_rules" | "starts_at" | "ends_at" | "is_active">
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
  revalidatePath("/portal");
  revalidatePath("/portal/submission");
  return { ok: true };
}
