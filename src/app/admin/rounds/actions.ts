"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { Round } from "@/types/database";

export type RoundUpdateInput = Partial<
  Pick<
    Round,
    | "name"
    | "description"
    | "deliverables"
    | "evaluation_criteria"
    | "evaluation_guidelines"
    | "categories"
    | "advancement_rules"
    | "starts_at"
    | "ends_at"
    | "is_active"
  >
>;

export type UpdateRoundResult = { ok: true; round: Round } | { ok: false; error: string };

export async function updateRound(roundId: string, eventId: string, input: RoundUpdateInput): Promise<UpdateRoundResult> {
  // Never trust a client-supplied "isAdmin" flag - re-derive authorization
  // server-side. RLS (rounds_write: is_event_admin) is still the real
  // boundary underneath, but checking here first turns an RLS denial into a
  // clear message instead of a generic "Could not save round."
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx) || ctx.event.id !== eventId) {
    return { ok: false, error: "You do not have permission to update rounds." };
  }

  // Only these columns may be changed through this action (BUG-011): the
  // payload arrives from a public server-action endpoint.
  const ALLOWED: (keyof RoundUpdateInput)[] = [
    "name",
    "description",
    "deliverables",
    "evaluation_criteria",
    "evaluation_guidelines",
    "categories",
    "advancement_rules",
    "starts_at",
    "ends_at",
    "is_active",
  ];
  const patch: RoundUpdateInput = {};
  for (const key of ALLOWED) {
    if (input && Object.prototype.hasOwnProperty.call(input, key)) (patch as Record<string, unknown>)[key] = input[key];
  }
  input = patch;

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", roundId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (fetchError || !existing) {
    return { ok: false, error: "The round could not be found." };
  }
  const before = existing as unknown as Round;

  const effectiveStarts = input.starts_at !== undefined ? input.starts_at : before.starts_at;
  const effectiveEnds = input.ends_at !== undefined ? input.ends_at : before.ends_at;
  if (effectiveStarts && effectiveEnds && Date.parse(effectiveEnds) <= Date.parse(effectiveStarts)) {
    return { ok: false, error: "Submission end time must be after the start time." };
  }

  const { data: updated, error } = await supabase.from("rounds").update(input).eq("id", roundId).select("*").maybeSingle();

  if (error || !updated) {
    // Full detail server-side only - never forwarded to the browser (no SQL,
    // constraint names, or credentials in the returned message).
    console.error("[updateRound] failed to save round", roundId, error);
    const message =
      error?.code === "42501"
        ? "You do not have permission to update rounds."
        : error?.code === "PGRST204" || error?.code === "PGRST205"
          ? "A required field is missing from the database. Contact support."
          : "Could not save round. Please try again, or contact support if this keeps happening.";
    return { ok: false, error: message };
  }

  await logAudit({ actorProfileId: ctx.user.userId, eventId, action: "update_round", entityType: "rounds", entityId: roundId, before, after: updated });
  revalidatePath("/admin/rounds");
  revalidatePath("/admin/schedule");
  revalidatePath("/rounds");
  revalidatePath("/rounds/minor");
  revalidatePath("/rounds/advanced");
  revalidatePath("/schedule");
  revalidatePath("/portal");
  revalidatePath("/portal/submission");
  return { ok: true, round: updated as unknown as Round };
}
