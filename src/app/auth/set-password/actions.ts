"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultLandingPath, getUserContext } from "@/lib/auth/session";
import { acceptAdminInvite } from "@/lib/auth/provisioning";
import {
  linkConfirmedParticipantRows,
  markParticipantVerified,
  revokeAllSessions,
} from "@/lib/auth/participant-provisioning";

export interface CompleteResult {
  ok: boolean;
  error?: string;
  redirectTo?: string;
}

// Completes an invitation or recovery link (admins, reviewers, and - since
// invitation emails replaced formula passwords - participants). The page has
// already exchanged THE LINK'S OWN credentials for a session (never an
// unrelated pre-existing session - BUG-015), so the account changed here is
// the one the email was sent to.
//
// `expectedUserId` is the account id the page showed the user; if the
// session changed in between (another tab signed in as someone else), refuse.
export async function completePasswordSetup(password: string, expectedUserId: string, inviteToken?: string): Promise<CompleteResult> {
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    return { ok: false, error: "Password must be between 8 and 72 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { ok: false, error: "Your link has expired. Request a new one and try again." };
  }
  if (user.id !== expectedUserId) {
    return { ok: false, error: "You're signed in as a different account than this link was sent to. Open the link again." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { ok: false, error: updateError.message || "Could not set your password. Please try again." };
  }

  // Invalidate every other session for this account (RISK-003), then
  // re-establish just this one with the new password.
  await revokeAllSessions(user.id);
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password });

  const admin = createAdminClient();
  const { error: flagError } = await admin.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  if (flagError) console.error("[set-password] could not clear must_change_password for", user.id);

  if (inviteToken) {
    const result = await acceptAdminInvite(inviteToken, user.id, user.email);
    if (!result.ok) return { ok: false, error: `Your password was set, but: ${result.error}` };
  }

  // Following an emailed link proves ownership of the (now confirmed) address.
  await linkConfirmedParticipantRows(user);
  await markParticipantVerified(user.id);

  if (signInError) return { ok: true, redirectTo: "/login" };
  const ctx = await getUserContext();
  return { ok: true, redirectTo: defaultLandingPath(ctx) };
}
