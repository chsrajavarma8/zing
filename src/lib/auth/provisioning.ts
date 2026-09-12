import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type SetupLinkMode = "invite" | "reset" | "failed";

// Admin/reviewer provisioning only. Sends a secure link (Supabase's own
// email delivery) that lets the invited person set their own password.
// `inviteToken`, when given, is embedded in the redirect URL so that
// acceptAdminInvite() can later bind role-granting to this exact,
// unguessable, single-use token - never to the email address alone (see
// 0018_admin_invite_tokens.sql for why email-only matching is unsafe).
//
// First tries to create-and-invite (the common case for a brand new admin).
// If the account already exists, Supabase's inviteUserByEmail errors, and we
// fall back to a password-reset link, which works for any existing account
// and still carries the same invite token through to acceptance.
export async function sendAccountSetupLink(
  email: string,
  inviteToken?: string,
): Promise<{ sent: boolean; mode: SetupLinkMode }> {
  const admin = createAdminClient();
  const base = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`;
  const redirectTo = inviteToken ? `${base}?invite=${encodeURIComponent(inviteToken)}` : base;

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!inviteError) return { sent: true, mode: "invite" };

  const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (!resetError) return { sent: true, mode: "reset" };

  console.error(`[auth] could not send setup link to ${email}:`, inviteError.message, "/", resetError.message);
  return { sent: false, mode: "failed" };
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export type AcceptInviteResult =
  | { ok: true; role: "super_admin" | "event_admin" | "reviewer"; scope: "platform" | "event"; eventId: string | null }
  | { ok: false; error: string };

// The ONLY place that grants admin/reviewer privileges. Requires the exact,
// unguessable token from the invite link AND a currently-authenticated
// session whose verified email matches the invite - not merely "a profile
// exists with this email" (that's exactly the trust-boundary bug this
// module used to have: profile creation alone used to be enough). The
// UPDATE ... WHERE consumed_at IS NULL is a single atomic statement, so
// concurrent accept attempts for the same token cannot both succeed.
export async function acceptAdminInvite(token: string, userId: string, userEmail: string): Promise<AcceptInviteResult> {
  const admin = createAdminClient();

  const { data: invite, error: fetchError } = await admin
    .from("admin_invites")
    .select("id, email, scope, event_id, role, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();

  if (fetchError || !invite) return { ok: false, error: "This invitation link is invalid." };

  const inv = invite as unknown as {
    id: string;
    email: string;
    scope: "platform" | "event";
    event_id: string | null;
    role: "super_admin" | "event_admin" | "reviewer";
    expires_at: string;
    consumed_at: string | null;
  };

  if (inv.consumed_at) return { ok: false, error: "This invitation has already been used." };
  if (Date.parse(inv.expires_at) < Date.now()) return { ok: false, error: "This invitation has expired." };
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, error: "This invitation was issued for a different email address." };
  }

  // Atomic single-use consumption: succeeds only if no one else has already
  // consumed this token (rowcount 0 => already-raced; treated as failure).
  const { data: consumed, error: consumeError } = await admin
    .from("admin_invites")
    .update({ consumed_at: new Date().toISOString(), consumed_by: userId })
    .eq("id", inv.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError || !consumed) return { ok: false, error: "This invitation has already been used." };

  if (inv.scope === "platform") {
    const { error } = await admin
      .from("platform_roles")
      .upsert({ user_id: userId, role: inv.role, granted_by: null }, { onConflict: "user_id" });
    if (error) return { ok: false, error: "Could not grant access. Contact support." };
  } else {
    if (!inv.event_id) return { ok: false, error: "Invitation is missing its event." };
    const { error } = await admin
      .from("event_admins")
      .upsert(
        { event_id: inv.event_id, user_id: userId, role: inv.role, created_by: null },
        { onConflict: "event_id,user_id,role" },
      );
    if (error) return { ok: false, error: "Could not grant access. Contact support." };
  }

  return { ok: true, role: inv.role, scope: inv.scope, eventId: inv.event_id };
}
