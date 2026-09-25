"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultLandingPath, getUserContext } from "@/lib/auth/session";
import { generateTemporaryPassword } from "@/lib/auth/temp-password";
import { markParticipantVerified, revokeAllSessions } from "@/lib/auth/participant-provisioning";

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
  redirectTo?: string;
}

// Mandatory first password change for LEGACY participant accounts that were
// provisioned with a formula-derived temporary password (before invitation
// emails replaced that scheme - BUG-010/RISK-002).
export async function completeMandatoryPasswordChange(newPassword: string): Promise<ChangePasswordResult> {
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 72) {
    return { ok: false, error: "Password must be between 8 and 72 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  // Reject re-submitting the same temporary password as the "new" one.
  const { data: member } = await supabase
    .from("team_members")
    .select("team_id, full_name, date_of_birth, teams!team_members_team_id_fkey(team_name)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();

  const memberRow = member as unknown as { full_name: string; date_of_birth: string; teams: { team_name: string } | null } | null;
  if (memberRow?.teams?.team_name) {
    try {
      const tempPassword = generateTemporaryPassword({
        teamName: memberRow.teams.team_name,
        fullName: memberRow.full_name,
        dateOfBirth: memberRow.date_of_birth,
      });
      if (newPassword === tempPassword) {
        return { ok: false, error: "Choose a different password from your temporary one." };
      }
    } catch {
      // Invalid DOB on file shouldn't block a legitimate password change.
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { ok: false, error: updateError.message || "Could not change your password. Please try again." };
  }

  // must_change_password is only writable by the service role (see
  // protect_must_change_password). If this fails, say so: the password WAS
  // changed, and retrying with the new password completes the setup.
  const admin = createAdminClient();
  const { error: flagError } = await admin.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  if (flagError) {
    return {
      ok: false,
      error: "Your password was changed, but we couldn't finish setting up your account. Sign in with your new password and try again.",
    };
  }

  // Service-role write: participants can't set verification_status themselves
  // (protect_team_member_fields), which is why the old client-side update
  // silently did nothing (BUG-005).
  const verified = await markParticipantVerified(user.id);

  // A temporary password may have been known to others: end every existing
  // session (RISK-003), then re-establish only this one with the new password.
  await revokeAllSessions(user.id);
  const { error: reSignInError } = await supabase.auth.signInWithPassword({ email: user.email, password: newPassword });
  if (reSignInError) {
    return { ok: true, redirectTo: "/login?next=/portal" };
  }

  if (!verified.ok) {
    console.error("[change-password] verification flag not updated for", user.id);
  }

  const ctx = await getUserContext();
  return { ok: true, redirectTo: defaultLandingPath(ctx) };
}
