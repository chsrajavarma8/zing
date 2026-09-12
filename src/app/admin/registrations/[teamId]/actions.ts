"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { resetParticipantAccount } from "@/lib/auth/participant-provisioning";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function setTeamStatus(teamId: string, eventId: string, status: "pending" | "verified" | "disqualified") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: before } = await supabase.from("teams").select("status").eq("id", teamId).maybeSingle();

  const { error } = await supabase.from("teams").update({ status }).eq("id", teamId);
  if (error) return { ok: false, error: "Could not update status." };

  await logAudit({
    actorProfileId: user.id,
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

// Organizer-assisted account recovery (item 11 of the auth spec): only used
// after an organizer has verified the participant's identity out of band
// (support email/phone) - this is not a self-serve reset. Regenerates the
// same temporary-password formula the participant already knows from the
// sign-in page and forces a mandatory private-password change again.
export async function resetParticipantAccess(teamMemberId: string, eventId: string) {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx)) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("team_members")
    .select("id, profile_id, email, full_name, date_of_birth, team_id, teams(team_name)")
    .eq("id", teamMemberId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!member) return { ok: false, error: "Participant not found." };

  const m = member as unknown as {
    id: string;
    profile_id: string | null;
    email: string;
    full_name: string;
    date_of_birth: string;
    team_id: string;
    teams: { team_name: string } | null;
  };

  if (!m.teams?.team_name) return { ok: false, error: "Could not find this participant's team." };

  // Never reset an account that also holds admin/reviewer access to the
  // predictable participant formula - that would weaken an admin's own
  // credential. Preserve secure admin provisioning untouched.
  if (m.profile_id) {
    const admin = createAdminClient();
    const [{ data: platformRole }, { data: eventAdminRoles }] = await Promise.all([
      admin.from("platform_roles").select("user_id").eq("user_id", m.profile_id).maybeSingle(),
      admin.from("event_admins").select("id").eq("user_id", m.profile_id),
    ]);
    if (platformRole || (eventAdminRoles && eventAdminRoles.length > 0)) {
      return {
        ok: false,
        error: "This account also has admin access — reset it through Supabase Auth directly, not this tool.",
      };
    }
  }

  const outcome = await resetParticipantAccount({
    profileId: m.profile_id,
    email: m.email,
    teamName: m.teams.team_name,
    fullName: m.full_name,
    dateOfBirth: m.date_of_birth,
  });
  if (!outcome.ok) return { ok: false, error: outcome.error };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await logAudit({
      actorProfileId: user.id,
      eventId,
      action: "reset_participant_access",
      entityType: "team_members",
      entityId: teamMemberId,
    });
  }

  revalidatePath(`/admin/registrations/${m.team_id}`);
  return { ok: true };
}

// Permanently deletes a team and everything tied to it (members,
// submissions, scores, qualification status, requests - all FK-cascade;
// feedback rows are detached via SET NULL instead of deleted, see
// 0020_team_delete_support.sql). Irreversible - the confirmation dialog on
// the client side is the only thing standing between a click and permanent
// data loss, so this is deliberately not exposed as a one-click action.
//
// Uses the service-role client for the delete itself (authorization is
// fully re-verified above via canManage - not delegated to RLS): the
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
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx)) return { ok: false, error: "Not authorized." };

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
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx)) return { ok: false, error: "Not authorized." };

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

  const { error } = await supabase.from("team_members").delete().eq("id", teamMemberId);
  if (error) return { ok: false, error: "Could not remove member." };

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
