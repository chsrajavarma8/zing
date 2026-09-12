"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email/send";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface NotificationInput {
  title: string;
  message: string;
  audienceType: "all" | "team_leads" | "team_members" | "selected_teams" | "individual" | "round_based";
  teamIds?: string[];
  emails?: string[];
  roundId?: string;
  priority: "low" | "normal" | "high" | "urgent";
  channels: ("in_app" | "email" | "whatsapp")[];
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
    // yet (e.g. announcing the Minor round exam before anyone has attempted it).
    if (teamIds.size > 0) membersQuery = membersQuery.in("team_id", Array.from(teamIds));
  }

  const { data: recipients } = await membersQuery;
  const recipientList = (recipients as unknown as { profile_id: string; email: string; full_name: string }[] | null) ?? [];
  return Array.from(new Map(recipientList.map((r) => [r.profile_id, r])).values());
}

export async function previewAudienceCount(eventId: string, input: Pick<NotificationInput, "audienceType" | "teamIds" | "emails" | "roundId">) {
  const admin = createAdminClient();
  const recipients = await resolveAudience(admin, eventId, input);
  return { count: recipients.length };
}

export async function sendNotification(eventId: string, input: NotificationInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const uniqueRecipients = await resolveAudience(admin, eventId, input);

  if (uniqueRecipients.length === 0) return { ok: false, error: "No recipients matched this audience." };

  const { data: notification, error } = await admin
    .from("notifications")
    .insert({
      event_id: eventId,
      title: input.title,
      message: input.message,
      audience_type: input.audienceType,
      audience_filter: { teamIds: input.teamIds ?? null, emails: input.emails ?? null, roundId: input.roundId ?? null },
      priority: input.priority,
      related_round_id: input.roundId ?? null,
      channels: input.channels,
      action_link: input.actionLink || null,
      scheduled_at: input.scheduledAt || null,
      sent_at: input.scheduledAt ? null : new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !notification) return { ok: false, error: "Could not create notification." };
  const notificationId = (notification as unknown as { id: string }).id;

  const rows: { notification_id: string; profile_id: string; channel: string; delivery_status: string }[] = [];
  for (const r of uniqueRecipients) {
    if (input.channels.includes("in_app")) rows.push({ notification_id: notificationId, profile_id: r.profile_id, channel: "in_app", delivery_status: "delivered" });
    if (input.channels.includes("email")) rows.push({ notification_id: notificationId, profile_id: r.profile_id, channel: "email", delivery_status: "pending" });
    if (input.channels.includes("whatsapp")) {
      rows.push({
        notification_id: notificationId,
        profile_id: r.profile_id,
        channel: "whatsapp",
        delivery_status: process.env.WHATSAPP_PROVIDER ? "pending" : "not_configured",
      });
    }
  }

  await admin.from("notification_recipients").insert(rows);

  if (input.channels.includes("email") && !input.scheduledAt) {
    for (const r of uniqueRecipients) {
      const result = await sendEmail({ to: r.email, subject: input.title, html: `<p>${input.message.replace(/\n/g, "<br/>")}</p>` });
      await admin
        .from("notification_recipients")
        .update({ delivery_status: result.sent ? "sent" : result.reason === "not_configured" ? "not_configured" : "failed", delivered_at: result.sent ? new Date().toISOString() : null })
        .eq("notification_id", notificationId)
        .eq("profile_id", r.profile_id)
        .eq("channel", "email");
    }
  }

  await logAudit({
    actorProfileId: user.id,
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
  if (!ctx || !canManage(ctx)) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { data: notification } = await supabase
    .from("notifications")
    .select("id, title, sent_at")
    .eq("id", notificationId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!notification) return { ok: false, error: "Notification not found." };
  const n = notification as unknown as { id: string; title: string; sent_at: string | null };
  if (n.sent_at) return { ok: false, error: "Already sent — can't cancel a notification people have already received." };

  const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
  if (error) return { ok: false, error: "Could not cancel notification." };

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
