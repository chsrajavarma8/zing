"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/admin-guards";
import { revalidatePath } from "next/cache";
import type { RequestStatus } from "@/types/database";

const STATUSES: RequestStatus[] = ["open", "in_progress", "awaiting_response", "resolved", "rejected"];

// Staff-only (BUG-011/BUG-018). The organizer flag on the message is set by
// the database from the sender's role, never from this payload.
export async function replyToRequest(requestId: string, eventId: string, message: string, newStatus?: RequestStatus) {
  const guard = await requireStaff(eventId);
  if (!guard.ok) return guard;

  const text = typeof message === "string" ? message.trim() : "";
  if (text.length > 5000) return { ok: false, error: "Reply is too long." };
  if (newStatus && !STATUSES.includes(newStatus)) return { ok: false, error: "Invalid status." };
  if (!text && !newStatus) return { ok: false, error: "Nothing to send." };

  const supabase = await createClient();
  const { data: request } = await supabase.from("requests").select("id").eq("id", requestId).eq("event_id", eventId).maybeSingle();
  if (!request) return { ok: false, error: "Request not found." };

  if (text) {
    const { data: inserted, error } = await supabase
      .from("request_messages")
      .insert({ request_id: requestId, sender_profile_id: guard.ctx.user.userId, message: text })
      .select("id, is_admin");
    if (error || !inserted || inserted.length !== 1) return { ok: false, error: "Could not send reply." };
  }

  if (newStatus) {
    const { data, error } = await supabase.from("requests").update({ status: newStatus }).eq("id", requestId).eq("event_id", eventId).select("id");
    if (error || !data || data.length !== 1) return { ok: false, error: "Could not update status." };
  }

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "reply_to_request", entityType: "requests", entityId: requestId, after: { replied: Boolean(text), newStatus } });
  revalidatePath("/admin/requests");
  revalidatePath("/portal/requests");
  return { ok: true };
}

// Req: resolving a request removes it entirely (list + database). Deletion
// only counts when exactly one row in this event was deleted.
export async function resolveRequest(requestId: string, eventId: string) {
  const guard = await requireStaff(eventId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { error, count } = await supabase.from("requests").delete({ count: "exact" }).eq("id", requestId).eq("event_id", eventId);
  if (error) return { ok: false, error: "Could not resolve this request. Please try again." };
  if (!count) return { ok: false, error: "This request could not be found or you're not authorized to resolve it." };

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "resolve_request", entityType: "requests", entityId: requestId });
  revalidatePath("/admin/requests");
  revalidatePath("/portal/requests");
  return { ok: true };
}
