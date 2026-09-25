"use server";

import { createClient } from "@/lib/supabase/server";
import { participantSchema, validateWhatsapp, validateEducationFields } from "@/lib/validations/registration";
import { normalizePhoneInput } from "@/lib/phone";
import { inviteParticipant } from "@/lib/auth/participant-provisioning";
import { requirePasswordChanged } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Every team mutation here is authorized server-side (server actions are
// public POST endpoints). Membership changes run through SECURITY DEFINER
// RPCs (0043_security_integrity_fixes.sql) that verify the caller is the
// team's lead, lock the team row, and apply the registration/team locks;
// direct table updates confirm they actually changed a row. A denied or
// missing target is reported as an error, never as success (BUG-019).

type TeamActionResult = { ok: true; warning?: string } | { ok: false; error: string };

// Maps database errors raised by the RPCs/triggers to user-facing text. The
// RPCs raise deliberately worded messages; anything else is generic.
function rpcError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "23505" && error.message?.includes("team_members_mobile_normalized_idx")) {
    return "This mobile number is already registered with another participant.";
  }
  if (error.code === "23505") return "That email or roll number is already registered for this event.";
  if (["42501", "22023", "P0002"].includes(error.code ?? "") && error.message) return error.message;
  return fallback;
}

interface CallerTeam {
  teamId: string;
  eventId: string;
  isLead: boolean;
}

// The caller's own membership in `teamId`, read through RLS (self rows only).
async function callerTeam(teamId: string): Promise<CallerTeam | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("team_members")
    .select("team_id, event_id, role")
    .eq("profile_id", user.id)
    .eq("team_id", teamId)
    .maybeSingle();
  const row = data as { team_id: string; event_id: string; role: string } | null;
  return row ? { teamId: row.team_id, eventId: row.event_id, isLead: row.role === "lead" } : null;
}

const newMemberSchema = participantSchema.omit({ role: true }).superRefine((m, ctx) => {
  if (!validateWhatsapp(m)) {
    ctx.addIssue({ code: "custom", message: "Enter a valid WhatsApp number", path: ["whatsapp"] });
  }
  const educationIssue = validateEducationFields(m);
  if (educationIssue) {
    ctx.addIssue({ code: "custom", message: educationIssue.message, path: [educationIssue.field] });
  }
});

export async function addTeamMember(teamId: string, input: z.infer<typeof newMemberSchema>): Promise<TeamActionResult> {
  const parsed = newMemberSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ? `Check the member details: ${first.message}` : "Check the member details." };
  }

  const supabase = await createClient();
  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const m = parsed.data;
  const { data: memberId, error } = await supabase.rpc("lead_add_team_member", {
    p_team_id: teamId,
    p_member: {
      full_name: m.fullName,
      date_of_birth: m.dateOfBirth,
      education_level: m.educationLevel,
      college: m.college,
      roll_number: m.rollNumber,
      class_grade: m.classGrade,
      email: m.email,
      mobile: m.mobile,
      whatsapp: m.whatsappSameAsMobile ? m.mobile : normalizePhoneInput(m.whatsapp),
      whatsapp_same_as_mobile: m.whatsappSameAsMobile,
      gender: m.gender || "",
    },
  });
  if (error || !memberId) return { ok: false, error: rpcError(error, "Could not add member.") };

  revalidatePath("/portal/team");

  // The new member gets their own invitation email (BUG-010).
  const outcome = await inviteParticipant({ email: m.email, fullName: m.fullName, teamMemberId: memberId as string });
  if (outcome.status === "failed") {
    return { ok: true, warning: `Member added, but ${outcome.error.toLowerCase()} Ask an organizer to resend it.` };
  }
  if (outcome.status === "existing_account") {
    return { ok: true, warning: "Member added. They already have an account and should sign in with their existing password." };
  }
  return { ok: true };
}

export async function removeTeamMember(memberId: string): Promise<TeamActionResult> {
  const supabase = await createClient();
  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const { data, error } = await supabase.rpc("lead_remove_team_member", { p_member_id: memberId });
  if (error || data !== memberId) return { ok: false, error: rpcError(error, "Could not remove member.") };

  revalidatePath("/portal/team");
  revalidatePath("/portal");
  return { ok: true };
}

// BUG-001: renaming is lead-only, confirmed by the returned row, and has no
// side effects on anyone's credentials (the formula-based password resync
// that used to run here is gone along with formula passwords).
export async function renameTeam(teamId: string, teamName: string): Promise<TeamActionResult> {
  const trimmed = typeof teamName === "string" ? teamName.trim() : "";
  if (trimmed.length < 2 || trimmed.length > 120) {
    return { ok: false, error: "Enter a team name between 2 and 120 characters." };
  }

  const supabase = await createClient();
  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const caller = await callerTeam(teamId);
  if (!caller?.isLead) return { ok: false, error: "Only the team lead can rename the team." };

  // RLS (teams_update) + the protect_team_fields_lock trigger remain the
  // boundary; .select() proves a row was actually updated.
  const { data, error } = await supabase.from("teams").update({ team_name: trimmed }).eq("id", teamId).select("id");
  if (error) return { ok: false, error: rpcError(error, "Could not rename team.") };
  if (!data || data.length !== 1) return { ok: false, error: "Only the team lead can rename the team." };

  revalidatePath("/portal/team");
  revalidatePath("/portal");
  return { ok: true };
}

// Runs the security-definer transfer_team_lead() RPC, which re-verifies the
// caller is the current lead and the target is a member, under a team lock.
export async function transferTeamLead(teamId: string, newLeadMemberId: string): Promise<TeamActionResult> {
  const supabase = await createClient();
  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const { error } = await supabase.rpc("transfer_team_lead", {
    p_team_id: teamId,
    p_new_lead_member_id: newLeadMemberId,
  });
  if (error) return { ok: false, error: rpcError(error, "Could not transfer leadership.") };

  revalidatePath("/portal/team");
  revalidatePath("/portal");
  return { ok: true };
}

export async function setSubmissionDelegate(teamId: string, memberId: string | null): Promise<TeamActionResult> {
  const supabase = await createClient();
  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const caller = await callerTeam(teamId);
  if (!caller?.isLead) return { ok: false, error: "Only the team lead can change submission access." };

  if (memberId) {
    const { data: member } = await supabase.from("team_roster").select("id, team_id, role").eq("id", memberId).maybeSingle();
    const m = member as { id: string; team_id: string; role: string } | null;
    if (!m || m.team_id !== teamId) return { ok: false, error: "That person is not a member of this team." };
    if (m.role === "lead") return { ok: false, error: "The lead already has full submission access." };
  }

  const { data, error } = await supabase
    .from("teams")
    .update({ submission_delegate_member_id: memberId })
    .eq("id", teamId)
    .select("id");
  if (error) return { ok: false, error: rpcError(error, "Could not update delegate access.") };
  if (!data || data.length !== 1) return { ok: false, error: "Only the team lead can change submission access." };

  revalidatePath("/portal/team");
  revalidatePath("/portal/submission");
  return { ok: true };
}
