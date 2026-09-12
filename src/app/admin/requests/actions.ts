"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { RequestStatus } from "@/types/database";

export async function replyToRequest(requestId: string, eventId: string, message: string, newStatus?: RequestStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (message.trim()) {
    const { error } = await supabase.from("request_messages").insert({ request_id: requestId, sender_profile_id: user.id, message: message.trim(), is_admin: true });
    if (error) return { ok: false, error: "Could not send reply." };
  }

  if (newStatus) {
    await supabase.from("requests").update({ status: newStatus }).eq("id", requestId);
  }

  await logAudit({ actorProfileId: user.id, eventId, action: "reply_to_request", entityType: "requests", entityId: requestId, after: { message, newStatus } });
  revalidatePath("/admin/requests");
  return { ok: true };
}
