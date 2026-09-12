"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultLandingPath, getUserContext } from "@/lib/auth/session";
import { generateTemporaryPassword } from "@/lib/auth/temp-password";

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
  redirectTo?: string;
}

export async function completeMandatoryPasswordChange(newPassword: string): Promise<ChangePasswordResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  // Reject re-submitting the same temporary password as the "new" one - the
  // participant must actually set a private password, not just confirm the
  // one derived from the public formula.
  const { data: member } = await supabase
    .from("team_members")
    .select("team_id, full_name, date_of_birth, teams(team_name)")
    .eq("profile_id", user.id)
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

  // must_change_password is only client-writable via this path: the
  // service-role client is required (see protect_must_change_password
  // trigger in 0016_temp_password_auth.sql), and we only reach here after
  // Supabase Auth has already confirmed the password change succeeded.
  const admin = createAdminClient();
  await admin.from("profiles").update({ must_change_password: false }).eq("id", user.id);

  await supabase
    .from("team_members")
    .update({ verification_status: "verified", verified_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .eq("verification_status", "pending");

  const ctx = await getUserContext();
  return { ok: true, redirectTo: defaultLandingPath(ctx) };
}
