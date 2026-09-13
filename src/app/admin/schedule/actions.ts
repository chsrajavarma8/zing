"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { SCHEDULE_EXTRAS_KEY, type ScheduleExtraItem } from "@/lib/schedule-extras";

// Custom one-off schedule milestones (e.g. "Talent round results",
// "Opening ceremony") beyond the fixed Registration + three round rows.
// Stored as a single content_blocks row (key: schedule_extra_items) rather
// than a new table - content_blocks already exists exactly for admin-edited,
// publicly-readable JSON content (see src/app/(public)/{about,page,prizes}.tsx),
// and a handful of milestones doesn't need its own table.
export async function saveScheduleExtras(eventId: string, items: ScheduleExtraItem[]) {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx) || ctx.event.id !== eventId) {
    return { ok: false, error: "You do not have permission to update the schedule." };
  }

  const cleaned = items
    .map((item) => ({ id: item.id, label: item.label.trim(), value: item.value.trim(), at: item.at || null }))
    .filter((item) => item.label);

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_blocks")
    .upsert(
      { event_id: eventId, key: SCHEDULE_EXTRAS_KEY, content: { items: cleaned }, updated_by: ctx.user.userId, updated_at: new Date().toISOString() },
      { onConflict: "event_id,key" },
    );

  if (error) return { ok: false, error: "Could not save the schedule. Please try again." };

  await logAudit({
    actorProfileId: ctx.user.userId,
    eventId,
    action: "update_schedule_extras",
    entityType: "content_blocks",
    entityId: eventId,
    after: { items: cleaned },
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/schedule");
  return { ok: true };
}
