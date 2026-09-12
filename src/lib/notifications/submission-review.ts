// Req. #20: when an admin changes a submission's review decision, the team
// lead, the member who actually submitted, and any delegated submitter must
// all be notified in-website - even when one person plays more than one of
// those roles (dedup by profile id).

import { createAdminClient } from "@/lib/supabase/admin";

const DECISION_LABEL: Record<string, string> = {
  pending_review: "marked pending review",
  accepted: "accepted",
  rejected: "rejected",
};

export async function notifySubmissionReviewDecision(params: {
  eventId: string;
  teamId: string;
  roundId: string;
  roundName: string;
  reviewStatus: "pending_review" | "accepted" | "rejected";
  reviewerNotes: string | null;
  reviewedBy: string;
}) {
  const admin = createAdminClient();

  const [{ data: team }, { data: members }] = await Promise.all([
    admin.from("teams").select("submission_delegate_member_id").eq("id", params.teamId).maybeSingle(),
    admin.from("team_members").select("id, profile_id, role").eq("team_id", params.teamId).not("profile_id", "is", null),
  ]);

  const { data: submission } = await admin
    .from("submissions")
    .select("submitted_by")
    .eq("team_id", params.teamId)
    .eq("round_id", params.roundId)
    .maybeSingle();

  const memberRows = (members as unknown as { id: string; profile_id: string; role: string }[] | null) ?? [];
  const delegateMemberId = (team as unknown as { submission_delegate_member_id: string | null } | null)?.submission_delegate_member_id ?? null;
  const submittedByProfileId = (submission as unknown as { submitted_by: string | null } | null)?.submitted_by ?? null;

  const recipientProfileIds = new Set<string>();
  const lead = memberRows.find((m) => m.role === "lead");
  if (lead) recipientProfileIds.add(lead.profile_id);
  if (delegateMemberId) {
    const delegate = memberRows.find((m) => m.id === delegateMemberId);
    if (delegate) recipientProfileIds.add(delegate.profile_id);
  }
  if (submittedByProfileId) recipientProfileIds.add(submittedByProfileId);

  if (recipientProfileIds.size === 0) return;

  const decisionLabel = DECISION_LABEL[params.reviewStatus] ?? params.reviewStatus;
  const title = `Submission ${decisionLabel}: ${params.roundName}`;
  const message = params.reviewerNotes
    ? `Your team's ${params.roundName} submission was ${decisionLabel}. Reviewer feedback: ${params.reviewerNotes}`
    : `Your team's ${params.roundName} submission was ${decisionLabel}.`;

  const { data: notification, error } = await admin
    .from("notifications")
    .insert({
      event_id: params.eventId,
      title,
      message,
      audience_type: "individual",
      audience_filter: { reason: "submission_review", teamId: params.teamId, roundId: params.roundId },
      priority: params.reviewStatus === "rejected" ? "high" : "normal",
      related_round_id: params.roundId,
      channels: ["in_app"],
      action_link: "/portal/submission",
      sent_at: new Date().toISOString(),
      created_by: params.reviewedBy,
    })
    .select("id")
    .single();

  if (error || !notification) return;
  const notificationId = (notification as unknown as { id: string }).id;

  await admin.from("notification_recipients").insert(
    Array.from(recipientProfileIds).map((profileId) => ({
      notification_id: notificationId,
      profile_id: profileId,
      channel: "in_app" as const,
      delivery_status: "delivered" as const,
      delivered_at: new Date().toISOString(),
    })),
  );
}
