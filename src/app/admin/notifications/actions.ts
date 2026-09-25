"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

// In-website notifications only (req. #14): WhatsApp/email delivery were
// removed from the sending interface, so "channel" is really just a marker
// today, always "in_app". Kept as an array (rather than dropped) so
// notifications/notification_recipients.channel - and any historical rows
// still carrying "email"/"whatsapp" - don't need a destructive migration.
export interface NotificationInput {
  title: string;
  message: string;
  audienceType: "all" | "team_leads" | "team_members" | "selected_teams" | "individual" | "round_based";
  teamIds?: string[];
  emails?: string[];
  roundId?: string;
  priority: "low" | "normal" | "high" | "urgent";
  actionLink?: string;
  scheduledAt?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveAudience(admin: SupabaseClient<any>, eventId: string, input: Pick<NotificationInput, "audienceType" | "teamIds" | "emails" | "roundId">) {
  let membersQuery = admin.from("team_members").select("profile_id, email, full_name").eq("event_id", eventId).not("profile_id", "is", null);

  if (input.audienceType === "team_leads") membersQuery = membersQuery.eq("role", "lead");
  if (input.audienceType === "team_members") membersQuery = membersQuery.eq("role", "member");
  if (input.audienceType === "selected_teams" && input.teamIds?.length) membersQuery = membersQuery.in("team_id", input.teamIds);
  if (input.audienceType === "individual" && input.emails?.length) {
    membersQuery = membersQuery.in(
      "email",
      input.emails.map((e) => e.toLowerCase()),
    );
  }
  if (input.audienceType === "round_based" && input.roundId) {
    const [{ data: subs }, { data: quals }] = await Promise.all([
      admin.from("submissions").select("team_id").eq("round_id", input.roundId),
      admin.from("qualification_status").select("team_id").eq("round_id", input.roundId),
    ]);
    const teamIds = new Set([
      ...((subs as unknown as { team_id: string }[] | null) ?? []).map((s) => s.team_id),
      ...((quals as unknown as { team_id: string }[] | null) ?? []).map((q) => q.team_id),
    ]);
    // Falls back to every registered team when a round has no submissions/qualification rows
    // yet (e.g. announcing the Talent round before anyone has submitted).
    if (teamIds.size > 0) membersQuery = membersQuery.in("team_id", Array.from(teamIds));
  }

  const { data: recipients } = await membersQuery;
  const recipientList = (recipients as unknown as { profile_id: string; email: string; full_name: string }[] | null) ?? [];
  return Array.from(new Map(recipientList.map((r) => [r.profile_id, r])).values());
}

// Read-only preview, but still gated: without this check any signed-in user
// (not just admins) could probe audience sizes for an event they don't manage.
export async function previewAudienceCount(eventId: string, input: Pick<NotificationInput, "audienceType" | "teamIds" | "emails" | "roundId">) {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx) || ctx.event.id !== eventId) return { count: 0 };

  const admin = createAdminClient();
  const recipients = await resolveAudience(admin, eventId, input);
  return { count: recipients.length };
}

export async function sendNotification(eventId: string, input: NotificationInput) {
  // resolveAudience/the inserts below use the service-role client, which
  // bypasses RLS entirely - this authorization check is the only thing
  // standing between "any signed-in user" and "send a notification to any
  // audience", so it must run before anything else here.
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx)) return { ok: false, error: "Not authorized." };
  if (ctx.event.id !== eventId) return { ok: false, error: "Not authorized." };

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!title || title.length > 200 || !message || message.length > 5000) {
    return { ok: false, error: "Enter a title (up to 200 characters) and a message (up to 5000)." };
  }

  // A schedule time must be a real future instant; anything at or before now
  // is simply sent now (it would be released immediately anyway).
  let scheduledAt: string | null = null;
  if (input.scheduledAt) {
    const ms = Date.parse(input.scheduledAt);
    if (Number.isNaN(ms)) return { ok: false, error: "Enter a valid schedule time." };
    if (ms > Date.now()) scheduledAt = new Date(ms).toISOString();
  }

  // Links are either in-app paths or https URLs.
  const actionLink = typeof input.actionLink === "string" ? input.actionLink.trim() : "";
  if (actionLink && !(actionLink.startsWith("/") && !actionLink.startsWith("//")) && !/^https:\/\//i.test(actionLink)) {
    return { ok: false, error: "The link must be an in-app path (starting with /) or an https:// URL." };
  }

  const admin = createAdminClient();
  const uniqueRecipients = await resolveAudience(admin, eventId, input);

  if (uniqueRecipients.length === 0) return { ok: false, error: "No recipients matched this audience." };

  const { data: notification, error } = await admin
    .from("notifications")
    .insert({
      event_id: eventId,
      title,
      message,
      audience_type: input.audienceType,
      audience_filter: { teamIds: input.teamIds ?? null, emails: input.emails ?? null, roundId: input.roundId ?? null },
      priority: input.priority,
      related_round_id: input.roundId ?? null,
      channels: ["in_app"],
      action_link: actionLink || null,
      // Scheduled notifications are hidden from recipients by the database
      // until scheduled_at (notification_released, 0043) - BUG-006.
      scheduled_at: scheduledAt,
      sent_at: scheduledAt ? null : new Date().toISOString(),
      created_by: ctx.user.userId,
    })
    .select("id")
    .single();

  if (error || !notification) return { ok: false, error: "Could not create notification." };
  const notificationId = (notification as unknown as { id: string }).id;

  const rows = uniqueRecipients.map((r) => ({
    notification_id: notificationId,
    profile_id: r.profile_id,
    channel: "in_app" as const,
    delivery_status: "delivered" as const,
    delivered_at: new Date().toISOString(),
  }));

  const { error: recipientsError } = await admin.from("notification_recipients").insert(rows);
  if (recipientsError) {
    // The notification row exists but nobody can see it without a recipient
    // row - report this as a failure rather than the misleading "sent"
    // toast the caller would otherwise show (req. #14: no false successes).
    await admin.from("notifications").delete().eq("id", notificationId);
    return { ok: false, error: "Could not deliver to recipients. Nothing was sent." };
  }

  await logAudit({
    actorProfileId: ctx.user.userId,
    eventId,
    action: "send_notification",
    entityType: "notifications",
    entityId: notificationId,
    after: { title: input.title, audienceType: input.audienceType, recipientCount: uniqueRecipients.length },
  });

  revalidatePath("/admin/notifications");
  return { ok: true, recipientCount: uniqueRecipients.length };
}

// Only ever cancels a notification that hasn't gone out yet (scheduled_at
// in the future, sent_at still null) - a notification people have already
// received is part of the record and shouldn't disappear for them, so this
// deliberately refuses to delete anything already sent.
export async function cancelScheduledNotification(notificationId: string, eventId: string) {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx) || ctx.event.id !== eventId) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { data: notification } = await supabase
    .from("notifications")
    .select("id, title, sent_at, scheduled_at")
    .eq("id", notificationId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!notification) return { ok: false, error: "Notification not found." };
  const n = notification as unknown as { id: string; title: string; sent_at: string | null; scheduled_at: string | null };
  // Recipients can read a scheduled notification from scheduled_at onwards
  // (notification_released, 0043), whether or not the dispatcher has run yet.
  const released = Boolean(n.sent_at) || (n.scheduled_at !== null && Date.parse(n.scheduled_at) <= Date.now());
  if (released) return { ok: false, error: "Already delivered — can't cancel a notification people have already received." };

  // The time condition is repeated in the DELETE itself so a notification
  // that becomes due between the check above and this statement is kept.
  const { data: deleted, error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("event_id", eventId)
    .is("sent_at", null)
    .gt("scheduled_at", new Date().toISOString())
    .select("id");
  if (error || !deleted || deleted.length !== 1) return { ok: false, error: "Could not cancel notification." };

  await logAudit({
    actorProfileId: ctx.user.userId,
    eventId,
    action: "cancel_scheduled_notification",
    entityType: "notifications",
    entityId: notificationId,
    before: { title: n.title },
  });

  revalidatePath("/admin/notifications");
  return { ok: true };
}
