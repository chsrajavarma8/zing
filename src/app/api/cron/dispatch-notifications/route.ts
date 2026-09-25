import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { plainTextToEmailHtml } from "@/lib/html";
import { cleanupOrphanedUploads } from "@/lib/storage-cleanup";

// Triggered by Vercel Cron (see vercel.json). In-app delivery does NOT depend
// on this job: recipients can read a scheduled notification from its
// scheduled_at onwards (notification_released, 0043). This job records
// sent_at and dispatches any email-channel recipients for notifications that
// have become due.
// Protected by CRON_SECRET so this can't be triggered by anyone who finds
// the URL - Vercel Cron sends it automatically as a Bearer token.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: an unset CRON_SECRET must never mean "no auth required" -
  // that would make this endpoint publicly triggerable by anyone who finds
  // the URL. Vercel sets CRON_SECRET automatically once configured; if it's
  // genuinely missing, refuse every request rather than silently allow.
  if (!secret) {
    console.error("[cron] CRON_SECRET is not configured - refusing all requests.");
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: due } = await admin
    .from("notifications")
    .select("id, title, message, channels")
    .is("sent_at", null)
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  const dueList = (due as unknown as { id: string; title: string; message: string; channels: string[] }[] | null) ?? [];
  let dispatched = 0;

  for (const notification of dueList) {
    // Atomically claim this notification before doing any work: a single
    // UPDATE ... WHERE sent_at IS NULL can only succeed once. If two
    // overlapping cron invocations (retry, or Vercel firing twice) both
    // fetched the same "due" list above, only one of them wins the claim
    // here - the other skips it instead of sending duplicate emails.
    const { data: claimed } = await admin
      .from("notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", notification.id)
      .is("sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    if (notification.channels.includes("email")) {
      const { data: recipients } = await admin
        .from("notification_recipients")
        .select("id, profile_id, profiles(email)")
        .eq("notification_id", notification.id)
        .eq("channel", "email")
        .eq("delivery_status", "pending");

      for (const r of (recipients as unknown as { id: string; profiles: { email: string } | null }[] | null) ?? []) {
        if (!r.profiles?.email) continue;
        // Plain-text content is escaped before it becomes HTML (RISK-007).
        const result = await sendEmail({
          to: r.profiles.email,
          subject: notification.title.replace(/[\r\n]+/g, " "),
          html: plainTextToEmailHtml(notification.message),
        });
        await admin
          .from("notification_recipients")
          .update({
            delivery_status: result.sent ? "sent" : result.reason === "not_configured" ? "not_configured" : "failed",
            delivered_at: result.sent ? new Date().toISOString() : null,
          })
          .eq("id", r.id);
      }
    }

    // in_app "delivery" is just the row existing, already inserted at
    // schedule time. sent_at was already set atomically by the claim above.
    dispatched++;
  }

  // Housekeeping on the same secured schedule: delete uploads that no row
  // references (abandoned, rejected, or failed finalization - RISK-001).
  const cleanup = await cleanupOrphanedUploads();

  return NextResponse.json({ ok: true, dispatched, orphanedUploadsRemoved: cleanup.removed, orphanedUploadsFailed: cleanup.failed });
}
