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
    const { error } = await supabase.from("requests").update({ status: newStatus }).eq("id", requestId);
    if (error) return { ok: false, error: "Could not update status." };
  }

  await logAudit({ actorProfileId: user.id, eventId, action: "reply_to_request", entityType: "requests", entityId: requestId, after: { message, newStatus } });
  revalidatePath("/admin/requests");
  return { ok: true };
}

// Req: resolving a request removes it entirely (list + database) rather
// than leaving a "resolved" row around. Deletion only happens after the
// resolution itself is confirmed to have gone through - if the delete call
// fails (e.g. an RLS/permission problem), nothing is removed and the caller
// surfaces the error, leaving the request exactly as it was.
export async function resolveRequest(requestId: string, eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error, count } = await supabase.from("requests").delete({ count: "exact" }).eq("id", requestId).eq("event_id", eventId);
  if (error) return { ok: false, error: "Could not resolve this request. Please try again." };
  if (!count) return { ok: false, error: "This request could not be found or you're not authorized to resolve it." };

  await logAudit({ actorProfileId: user.id, eventId, action: "resolve_request", entityType: "requests", entityId: requestId });
  revalidatePath("/admin/requests");
  revalidatePath("/portal/requests");
  return { ok: true };
}
