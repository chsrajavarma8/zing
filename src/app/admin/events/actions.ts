"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/admin-guards";
import { isValidWhatsappGroupUrl } from "@/lib/whatsapp";
import type { Event } from "@/types/database";

const EDITABLE_FIELDS = [
  "name",
  "organizer_name",
  "tagline",
  "description",
  "prize_pool_label",
  "start_date",
  "end_date",
  "registration_open_at",
  "registration_close_at",
  "timezone",
  "team_size_min",
  "team_size_max",
  "support_email",
  "support_phone",
  "support_website",
  "community_base_count",
  "problem_statement_mode",
  "problem_statement_text",
  "allow_gender_field",
  "gender_field_required",
  "status",
  "team_lock_at",
  "whatsapp_group_url",
  "whatsapp_group_enabled",
] as const;

export type EventUpdateInput = Partial<Pick<Event, (typeof EDITABLE_FIELDS)[number]>>;

export async function updateEvent(eventId: string, input: EventUpdateInput) {
  // BUG-011: explicit role + event-scope check (server actions are public
  // endpoints), and only the allow-listed columns are ever written.
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (input && Object.prototype.hasOwnProperty.call(input, key)) patch[key] = input[key];
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };

  if (patch.whatsapp_group_enabled && !isValidWhatsappGroupUrl((patch.whatsapp_group_url as string | null | undefined) ?? undefined)) {
    return { ok: false, error: "Enter a valid https://chat.whatsapp.com/... link before enabling the group button." };
  }
  if (
    typeof patch.team_size_min === "number" &&
    typeof patch.team_size_max === "number" &&
    (patch.team_size_min < 1 || patch.team_size_max < patch.team_size_min)
  ) {
    return { ok: false, error: "Team size limits are invalid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update(patch).eq("id", eventId).select("id");
  if (error) return { ok: false, error: "Could not save event settings." };
  if (!data || data.length !== 1) return { ok: false, error: "You do not have permission to do this." };

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "update_event", entityType: "events", entityId: eventId, after: patch });

  revalidatePath("/", "layout");
  return { ok: true };
}
