"use server";

import { createClient } from "@/lib/supabase/server";
import { defaultLandingPath, getUserContext } from "@/lib/auth/session";
import { acceptAdminInvite } from "@/lib/auth/provisioning";

export interface CompleteResult {
  ok: boolean;
  error?: string;
  redirectTo?: string;
}

// This page is admin/reviewer-only (participants set their password via the
// mandatory /change-password flow instead - see 0016). Called right after
// the client calls supabase.auth.updateUser({ password }) within the
// session established by the invite/recovery link.
//
// `inviteToken`, when present, is the exact single-use token from the
// invite link's `?invite=` query param. The role is granted ONLY by
// acceptAdminInvite() verifying that token against admin_invites and the
// caller's own authenticated, matching email - never by profile creation
// or email matching alone (see 0018_admin_invite_tokens.sql). Completing a
// plain password reset with no invite token changes nothing about roles.
export async function completePasswordSetup(inviteToken?: string): Promise<CompleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { ok: false, error: "Your session has expired. Request a new link and try again." };
  }

  if (inviteToken) {
    const result = await acceptAdminInvite(inviteToken, user.id, user.email);
    if (!result.ok) return { ok: false, error: result.error };
  }

  const ctx = await getUserContext();
  return { ok: true, redirectTo: defaultLandingPath(ctx) };
}
