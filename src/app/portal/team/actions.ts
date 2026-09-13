"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { participantSchema, validateWhatsapp } from "@/lib/validations/registration";
import { normalizePhoneInput } from "@/lib/phone";
import { provisionParticipantAccount, resyncTempPasswordsForTeam } from "@/lib/auth/participant-provisioning";
import { requirePasswordChanged } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Gates every team-mutating action (add/remove member, rename, transfer
// lead, delegate access) behind BOTH locks: registration_close_at (no new
// registrations/changes after registration closes) and the later,
// independent team_lock_at (team changes freeze once the hackathon starts,
// per req. #5 - distinct from registration closing, since organizers may
// want a gap between the two). Submissions are NOT gated by this - an open
// round submission window must keep working after either lock (see
// src/app/portal/submission/actions.ts, which only checks the round window).
async function assertTeamMutable(eventId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("registration_close_at, team_lock_at")
    .eq("id", eventId)
    .maybeSingle();
  const e = event as unknown as { registration_close_at: string | null; team_lock_at: string | null } | null;
  const now = Date.now();
  if (e?.team_lock_at && now > Date.parse(e.team_lock_at)) {
    return "Team changes are locked — the hackathon has started.";
  }
  if (e?.registration_close_at && now > Date.parse(e.registration_close_at)) {
    return "Team changes are locked — the registration deadline has passed.";
  }
  return null;
}

const newMemberSchema = participantSchema.omit({ role: true }).superRefine((m, ctx) => {
  if (!validateWhatsapp(m)) {
    ctx.addIssue({ code: "custom", message: "Enter a valid WhatsApp number", path: ["whatsapp"] });
  }
});

export async function addTeamMember(teamId: string, eventId: string, input: z.infer<typeof newMemberSchema>) {
  const deadlineError = await assertTeamMutable(eventId);
  if (deadlineError) return { ok: false, error: deadlineError };

  const parsed = newMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields." };

  const supabase = await createClient();

  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const { count } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);
  const { data: event } = await supabase.from("events").select("team_size_max").eq("id", eventId).maybeSingle();
  const max = (event as unknown as { team_size_max: number } | null)?.team_size_max ?? 4;
  if ((count ?? 0) >= max) return { ok: false, error: `Your team already has the maximum of ${max} members.` };

  const { data: teamRow } = await supabase.from("teams").select("team_name").eq("id", teamId).maybeSingle();
  const teamName = (teamRow as unknown as { team_name: string } | null)?.team_name;
  if (!teamName) return { ok: false, error: "Could not find your team." };

  const m = parsed.data;

  // Friendly pre-check ahead of the DB's own unique constraint (source of
  // truth under concurrent submissions - see 0034_team_members_mobile_uniqueness.sql).
  // Uses the admin client deliberately: team_members_select RLS would hide a
  // duplicate belonging to a different team from the caller's own session,
  // silently defeating this check for exactly the cross-team case it exists
  // to catch. Only a boolean existence result is derived from it - nothing
  // about the other row is returned to the caller.
  const mobileCheckClient = createAdminClient();
  const { count: mobileTaken } = await mobileCheckClient
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("mobile", m.mobile);
  if ((mobileTaken ?? 0) > 0) {
    return { ok: false, error: "This mobile number is already registered with another participant." };
  }

  // RLS team_members_insert requires the caller to be the team's lead.
  const { data: inserted, error } = await supabase
    .from("team_members")
    .insert({
      event_id: eventId,
      team_id: teamId,
      role: "member",
      full_name: m.fullName,
      date_of_birth: m.dateOfBirth,
      college: m.college,
      roll_number: m.rollNumber,
      email: m.email.toLowerCase(),
      mobile: m.mobile,
      whatsapp: m.whatsappSameAsMobile ? m.mobile : normalizePhoneInput(m.whatsapp),
      whatsapp_same_as_mobile: m.whatsappSameAsMobile,
      gender: m.gender || null,
      consent_accepted: true,
      communication_consent_essential: true,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    const msg = error?.message.includes("team_members_mobile_normalized_idx")
      ? "This mobile number is already registered with another participant."
      : error?.message.includes("duplicate")
        ? "That email or roll number is already registered for this event."
        : "Could not add member.";
    return { ok: false, error: msg };
  }

  // The new member's account is created here with a temporary password they
  // compute themselves (team name + their own name + DOB) - no email is
  // sent, and the team lead never sees or sets a password on their behalf.
  const outcome = await provisionParticipantAccount({
    email: m.email.toLowerCase(),
    teamName,
    fullName: m.fullName,
    dateOfBirth: m.dateOfBirth,
  });
  // Only link immediately if this created a brand-new account. If the email
  // already belongs to someone else's existing account, it's linked later,
  // only once that account's real owner proves ownership by signing in with
  // their own password (see the link-sweep in src/app/login/actions.ts).
  if (outcome.status === "created") {
    const admin = createAdminClient();
    await admin.from("team_members").update({ profile_id: outcome.profileId }).eq("id", (inserted as { id: string }).id);
  }

  revalidatePath("/portal/team");
  return { ok: true };
}

export async function removeTeamMember(memberId: string, eventId: string) {
  const deadlineError = await assertTeamMutable(eventId);
  if (deadlineError) return { ok: false, error: deadlineError };

  const supabase = await createClient();

  const { data: member } = await supabase.from("team_members").select("team_id").eq("id", memberId).maybeSingle();
  const teamId = (member as { team_id: string } | null)?.team_id;
  if (!teamId) return { ok: false, error: "Could not find this member." };

  const [{ count }, { data: event }] = await Promise.all([
    supabase.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    supabase.from("events").select("team_size_min").eq("id", eventId).maybeSingle(),
  ]);
  const teamSizeMin = (event as { team_size_min: number } | null)?.team_size_min ?? 1;
  if ((count ?? 0) <= teamSizeMin) {
    return { ok: false, error: `Your team must have at least ${teamSizeMin} members - remove someone else after adding a replacement, or contact support.` };
  }

  // RLS team_members_delete requires the caller to be the team's lead (or staff).
  const { error } = await supabase.from("team_members").delete().eq("id", memberId).neq("role", "lead");

  if (error) return { ok: false, error: "Could not remove member." };
  revalidatePath("/portal/team");
  return { ok: true };
}

export async function renameTeam(teamId: string, eventId: string, teamName: string) {
  const deadlineError = await assertTeamMutable(eventId);
  if (deadlineError) return { ok: false, error: deadlineError };

  const trimmed = teamName.trim();
  if (trimmed.length < 2 || trimmed.length > 120) {
    return { ok: false, error: "Enter a team name between 2 and 120 characters." };
  }

  const supabase = await createClient();
  // RLS teams_update requires the caller to be the team's lead (or staff).
  const { error } = await supabase.from("teams").update({ team_name: trimmed }).eq("id", teamId);
  if (error) return { ok: false, error: "Could not rename team." };

  await resyncTempPasswordsForTeam(teamId, trimmed);

  revalidatePath("/portal/team");
  revalidatePath("/portal");
  return { ok: true };
}

// Runs the security-definer transfer_team_lead() RPC (0022_team_lead_transfer_and_delegate.sql),
// which re-verifies server-side that the caller is the current lead and
// that the target is an actual member of this team before flipping roles -
// this app-layer check is only for a clean early error message, not the
// real authorization boundary.
export async function transferTeamLead(teamId: string, eventId: string, newLeadMemberId: string) {
  const deadlineError = await assertTeamMutable(eventId);
  if (deadlineError) return { ok: false, error: deadlineError };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_team_lead", {
    p_team_id: teamId,
    p_new_lead_member_id: newLeadMemberId,
  });
  if (error) return { ok: false, error: error.message || "Could not transfer leadership." };

  revalidatePath("/portal/team");
  revalidatePath("/portal");
  return { ok: true };
}

export async function setSubmissionDelegate(teamId: string, eventId: string, memberId: string | null) {
  const deadlineError = await assertTeamMutable(eventId);
  if (deadlineError) return { ok: false, error: deadlineError };

  const supabase = await createClient();

  if (memberId) {
    const { data: member } = await supabase
      .from("team_members")
      .select("id, team_id, role")
      .eq("id", memberId)
      .maybeSingle();
    const m = member as unknown as { id: string; team_id: string; role: string } | null;
    if (!m || m.team_id !== teamId) return { ok: false, error: "That person is not a member of this team." };
    if (m.role === "lead") return { ok: false, error: "The lead already has full submission access." };
  }

  // RLS teams_update requires the caller to be the team's lead (or staff).
  const { error } = await supabase.from("teams").update({ submission_delegate_member_id: memberId }).eq("id", teamId);
  if (error) return { ok: false, error: "Could not update delegate access." };

  revalidatePath("/portal/team");
  return { ok: true };
}
