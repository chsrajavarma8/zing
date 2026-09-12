"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(recipientId: string) {
  const supabase = await createClient();
  // RLS notification_recipients_update_self restricts this to the caller's own row.
  await supabase.from("notification_recipients").update({ read_at: new Date().toISOString() }).eq("id", recipientId);
  revalidatePath("/portal/notifications");
  revalidatePath("/portal");
}

export async function markAllNotificationsRead(recipientIds: string[]) {
  if (recipientIds.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from("notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .in("id", recipientIds)
    .is("read_at", null);
  revalidatePath("/portal/notifications");
  revalidatePath("/portal");
}
