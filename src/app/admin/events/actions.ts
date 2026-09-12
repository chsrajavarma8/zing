"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { isValidWhatsappGroupUrl } from "@/lib/whatsapp";
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
    | "team_lock_at"
    | "whatsapp_group_url"
    | "whatsapp_group_enabled"
  >
>;

export async function updateEvent(eventId: string, input: EventUpdateInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Never trust the client's switch-disabled state alone (req. #15): reject
  // enabling the WhatsApp group button server-side too if the link isn't a
  // real chat.whatsapp.com invite.
  if (input.whatsapp_group_enabled && !isValidWhatsappGroupUrl(input.whatsapp_group_url ?? undefined)) {
    return { ok: false, error: "Enter a valid https://chat.whatsapp.com/... link before enabling the group button." };
  }

  // RLS events_update requires event_admin or super_admin.
  const { error } = await supabase.from("events").update(input).eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorProfileId: user.id, eventId, action: "update_event", entityType: "events", entityId: eventId, after: input });

  // Every public/portal page reads events dynamically (the cookie-scoped
  // Supabase client opts routes out of static caching), so this isn't
  // masking a caching bug - it's defense in depth in case that ever changes.
  revalidatePath("/", "layout");
  return { ok: true };
}
