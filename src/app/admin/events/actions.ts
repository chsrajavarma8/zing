"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { Event } from "@/types/database";

export type EventUpdateInput = Partial<
  Pick<
    Event,
    | "name"
    | "organizer_name"
    | "tagline"
    | "description"
    | "prize_pool_label"
    | "start_date"
    | "end_date"
    | "registration_open_at"
    | "registration_close_at"
    | "timezone"
    | "team_size_min"
    | "team_size_max"
    | "support_email"
    | "support_phone"
    | "support_website"
    | "community_base_count"
    | "problem_statement_mode"
    | "problem_statement_text"
    | "allow_gender_field"
    | "gender_field_required"
    | "status"
  >
>;

export async function updateEvent(eventId: string, input: EventUpdateInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // RLS events_update requires event_admin or super_admin.
  const { error } = await supabase.from("events").update(input).eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorProfileId: user.id, eventId, action: "update_event", entityType: "events", entityId: eventId, after: input });

  revalidatePath("/admin/events");
  revalidatePath("/");
  return { ok: true };
}
