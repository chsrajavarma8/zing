"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireManager } from "@/lib/auth/admin-guards";
import { sendParticipantAccessLink } from "@/lib/auth/participant-provisioning";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function setTeamStatus(teamId: string, eventId: string, status: "pending" | "verified" | "disqualified") {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;
  if (!["pending", "verified", "disqualified"].includes(status)) return { ok: false, error: "Invalid status." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("teams").select("status").eq("id", teamId).eq("event_id", eventId).maybeSingle();
  if (!before) return { ok: false, error: "Team not found." };

  const { data, error } = await supabase.from("teams").update({ status }).eq("id", teamId).eq("event_id", eventId).select("id");
  if (error || !data || data.length !== 1) return { ok: false, error: "Could not update status." };

  await logAudit({
    actorProfileId: guard.ctx.user.userId,
    eventId,
    action: "set_team_status",
    entityType: "teams",
    entityId: teamId,
    before,
    after: { status },
  });

  revalidatePath(`/admin/registrations/${teamId}`);
  revalidatePath("/admin/registrations");
  return { ok: true };
}

// Organizer-assisted account recovery: only used after an organizer has
// verified the participant's identity out of band (support email/phone).
// Emails a recovery (or first-time invitation) link to the address on file,
// replaces the current password with a random one, and revokes all sessions
// (RISK-003). Staff accounts are refused by sendParticipantAccessLink itself.
export async function resetParticipantAccess(teamMemberId: string, eventId: string) {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("team_members")
    .select("id, profile_id, email, full_name, team_id")
    .eq("id", teamMemberId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!member) return { ok: false, error: "Participant not found." };

  const m = member as unknown as { id: string; profile_id: string | null; email: string; full_name: string; team_id: string };

  const outcome = await sendParticipantAccessLink({
    profileId: m.profile_id,
    email: m.email,
    fullName: m.full_name,
    teamMemberId: m.id,
  });
  if (!outcome.ok) return { ok: false, error: outcome.error };

  await logAudit({
    actorProfileId: guard.ctx.user.userId,
    eventId,
    action: "reset_participant_access",
    entityType: "team_members",
    entityId: teamMemberId,
    after: { mode: outcome.mode },
  });

  revalidatePath(`/admin/registrations/${m.team_id}`);
  return { ok: true, mode: outcome.mode };
}

// Permanently deletes a team and everything tied to it (members,
// submissions, scores, qualification status, requests - all FK-cascade;
// feedback rows are detached via SET NULL instead of deleted, see
// 0020_team_delete_support.sql). Irreversible - the confirmation dialog on
// the client side is the only thing standing between a click and permanent
// data loss, so this is deliberately not exposed as a one-click action.
//
// Uses the service-role client for the delete itself (authorization is
// fully re-verified above via requireManager - not delegated to RLS): the
// cascade reaches several audit/log-style tables (consents, score_audit,
// final_score_audit, submission_history, id_cards, exam_attempts, ...)
// that deliberately have no client-facing delete RLS policy, since no
// participant or reviewer session should ever be able to delete an audit
// row directly. Running this as the ordinary authenticated admin session
// (as before) hit exactly that: RLS silently blocked the cascade into
// those tables, the whole statement rolled back, and the only symptom was
// a generic "Could not delete team" error. Same pattern already used for
// the registration-rollback team delete in src/app/api/register/route.ts.
// A single DELETE statement (cascades included) is one atomic transaction,
// so a failure here can never leave a partially-deleted team behind.
export async function deleteTeam(teamId: string, eventId: string) {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;
  const { ctx } = guard;

  const admin = createAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("team_name, reference_id")
    .eq("id", teamId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!team) return { ok: false, error: "Team not found." };

  const { error, count } = await admin.from("teams").delete({ count: "exact" }).eq("id", teamId).eq("event_id", eventId);
  if (error) {
    console.error("[deleteTeam]", error);
    return { ok: false, error: "Could not delete team. Please try again or contact support if this keeps happening." };
  }
  if (!count) return { ok: false, error: "Team not found." };

  // Submission files are not covered by the FK cascade - remove the team's
  // storage folder too so no orphaned participant files remain.
  const { data: roundFolders } = await admin.storage.from("team-submissions").list(teamId, { limit: 100 });
  for (const folder of roundFolders ?? []) {
    const { data: files } = await admin.storage.from("team-submissions").list(`${teamId}/${folder.name}`, { limit: 100 });
    const paths = (files ?? []).map((f) => `${teamId}/${folder.name}/${f.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from("team-submissions").remove(paths);
      if (removeError) console.error("[deleteTeam] could not remove submission files for", teamId, removeError.message);
    }
  }

  await logAudit({
    actorProfileId: ctx.user.userId,
    eventId,
    action: "delete_team",
    entityType: "teams",
    entityId: teamId,
    before: team,
  });

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
  return { ok: true };
}

// Admin-side member removal (portal team leads already have their own
// version, deadline-gated). Never removes the team lead - that would leave
// the team without one; delete the whole team instead if that's the goal.
export async function removeTeamMemberByAdmin(teamMemberId: string, eventId: string) {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;
  const { ctx } = guard;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("team_members")
    .select("id, full_name, role, team_id")
    .eq("id", teamMemberId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!member) return { ok: false, error: "Participant not found." };

  const m = member as unknown as { id: string; full_name: string; role: string; team_id: string };
  if (m.role === "lead") {
    return { ok: false, error: "Can't remove a team lead this way — delete the whole team instead if that's the goal." };
  }

  const { data: removed, error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", teamMemberId)
    .eq("event_id", eventId)
    .select("id");
  if (error || !removed || removed.length !== 1) return { ok: false, error: "Could not remove member." };

  await logAudit({
    actorProfileId: ctx.user.userId,
    eventId,
    action: "remove_team_member",
    entityType: "team_members",
    entityId: teamMemberId,
    before: { fullName: m.full_name },
  });

  revalidatePath(`/admin/registrations/${m.team_id}`);
  return { ok: true };
}
