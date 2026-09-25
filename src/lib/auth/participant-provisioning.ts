import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

// Participant account provisioning (BUG-002, BUG-010, RISK-002, RISK-003).
//
// New participants receive a Supabase Auth invitation email and set their own
// password from that link (completed at /auth/set-password). The server never
// confirms an address on a registrant's behalf and never derives a password
// from registration details, so typing someone else's email into the
// registration form grants no access to anything: only the mailbox owner can
// use the link.
//
// Accounts are looked up by their verified Auth email (auth_user_id_by_email,
// service-role only) - never by profiles.email, which older migrations let
// users rewrite.
//
// REQUIREMENT: the Supabase project must have a working SMTP provider. The
// hosted default sender only delivers to organization members, so without
// custom SMTP every invitation fails and is reported as "failed" (never as
// success) - see docs/SECURITY-FIXES-2026-09.md.

export type InviteOutcome =
  | { status: "invited"; profileId: string }
  | { status: "existing_account" }
  | { status: "failed"; error: string };

export function participantSetupRedirect(): string {
  return `${getSiteUrl()}/auth/set-password?flow=participant`;
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("auth_user_id_by_email", { p_email: email.toLowerCase().trim() });
  if (error) throw new Error(`auth user lookup failed: ${error.message}`);
  return (data as string | null) ?? null;
}

async function isStaffAccount(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ data: platformRole, error: e1 }, { data: eventAdminRows, error: e2 }] = await Promise.all([
    admin.from("platform_roles").select("user_id").eq("user_id", userId).maybeSingle(),
    admin.from("event_admins").select("id").eq("user_id", userId).limit(1),
  ]);
  if (e1 || e2) throw new Error("could not verify account roles");
  return Boolean(platformRole) || Boolean(eventAdminRows && eventAdminRows.length > 0);
}

// Sends a Supabase invitation for a brand-new participant account and links
// it to `teamMemberId`. Linking the invited account immediately is safe: the
// server created it just now, it has no password, and the only way to sign in
// is the link delivered to that mailbox.
//
// If an account already exists for the email, nothing is linked or changed
// here - the row is linked when that account's owner signs in with a
// confirmed email (linkConfirmedParticipantRows).
export async function inviteParticipant(params: {
  email: string;
  fullName: string;
  teamMemberId?: string;
}): Promise<InviteOutcome> {
  const email = params.email.toLowerCase().trim();
  const admin = createAdminClient();

  try {
    if (await findAuthUserIdByEmail(email)) return { status: "existing_account" };
  } catch (err) {
    console.error("[provisioning] lookup failed:", err);
    return { status: "failed", error: "Could not check for an existing account." };
  }

  const { data: pendingInvite } = await admin
    .from("admin_invites")
    .select("id")
    .eq("email", email)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (pendingInvite) {
    return { status: "failed", error: "This email can't be used for participant registration right now." };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: participantSetupRedirect(),
    data: { full_name: params.fullName },
  });

  if (error || !data.user) {
    if (error && (error.code === "email_exists" || /already (been )?registered/i.test(error.message))) {
      return { status: "existing_account" };
    }
    console.error("[provisioning] invitation failed:", error?.code, error?.message);
    return { status: "failed", error: "The invitation email could not be sent." };
  }

  if (params.teamMemberId) {
    const { data: linked, error: linkError } = await admin
      .from("team_members")
      .update({ profile_id: data.user.id })
      .eq("id", params.teamMemberId)
      .is("profile_id", null)
      .select("id");
    if (linkError || !linked || linked.length === 0) {
      console.error("[provisioning] could not link invited account:", linkError?.message);
      return { status: "failed", error: "The invitation was sent, but the account could not be linked. Contact support." };
    }
  }

  return { status: "invited", profileId: data.user.id };
}

// Links unlinked team_members rows to an account whose Auth email is
// CONFIRMED. Called after a successful sign-in and after completing an
// invitation/recovery link - both are proof of mailbox ownership for the
// confirmed address. Also marks the linked rows verified (service role,
// since participants can't write verification_status - BUG-005).
export async function linkConfirmedParticipantRows(user: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}): Promise<{ ok: boolean }> {
  if (!user.email || !user.email_confirmed_at) return { ok: true };
  const admin = createAdminClient();
  const { error } = await admin
    .from("team_members")
    .update({ profile_id: user.id })
    .eq("email", user.email.toLowerCase())
    .is("profile_id", null);
  if (error) {
    console.error("[provisioning] link sweep failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

// Marks this account's team memberships verified once the participant has
// set their own private password. Service role: the column is protected from
// participant writes by protect_team_member_fields.
export async function markParticipantVerified(userId: string): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("team_members")
    .update({ verification_status: "verified", verified_at: new Date().toISOString() })
    .eq("profile_id", userId)
    .eq("verification_status", "pending");
  if (error) console.error("[provisioning] could not mark verified:", error.message);
  return { ok: !error };
}

// Revokes every session/refresh token of a user (RISK-003). Supabase does not
// do this when a password is changed through the Admin API.
export async function revokeAllSessions(userId: string): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_user_sessions", { p_user_id: userId });
  if (error) console.error("[provisioning] session revocation failed:", error.message);
  return { ok: !error };
}

export type ResetOutcome = { ok: true; mode: "recovery_sent" | "invited" | "existing_unlinked_recovery_sent" } | { ok: false; error: string };

// Organizer-assisted recovery, only after the organizer verified the
// participant's identity out of band. Emails a recovery link to the address
// on file (only the mailbox owner can use it), THEN replaces the current
// password with a random one and revokes all sessions, so whoever held the
// old credentials - or an old session - is locked out. Staff accounts are
// refused here, not just by callers.
export async function sendParticipantAccessLink(params: {
  profileId: string | null;
  email: string;
  fullName: string;
  teamMemberId: string;
}): Promise<ResetOutcome> {
  const email = params.email.toLowerCase().trim();
  const admin = createAdminClient();

  let accountId: string | null;
  try {
    accountId = params.profileId ?? (await findAuthUserIdByEmail(email));
  } catch {
    return { ok: false, error: "Could not look up this participant's account." };
  }

  if (!accountId) {
    const outcome = await inviteParticipant({ email, fullName: params.fullName, teamMemberId: params.teamMemberId });
    if (outcome.status === "invited") return { ok: true, mode: "invited" };
    if (outcome.status === "failed") return { ok: false, error: outcome.error };
    accountId = await findAuthUserIdByEmail(email);
    if (!accountId) return { ok: false, error: "Could not look up this participant's account." };
  }

  try {
    if (await isStaffAccount(accountId)) {
      return { ok: false, error: "This account also has admin access — reset it through Supabase Auth directly, not this tool." };
    }
  } catch {
    return { ok: false, error: "Could not verify this account's roles. Nothing was changed." };
  }

  const { error: recoverError } = await admin.auth.resetPasswordForEmail(email, { redirectTo: participantSetupRedirect() });
  if (recoverError) {
    console.error("[provisioning] recovery email failed:", recoverError.code, recoverError.message);
    return { ok: false, error: "The recovery email could not be sent. Nothing was changed." };
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(accountId, {
    password: randomBytes(32).toString("base64url"),
  });
  if (pwError) {
    return { ok: false, error: "The recovery email was sent, but the old password could not be invalidated. Try again." };
  }
  const revoked = await revokeAllSessions(accountId);
  if (!revoked.ok) {
    return { ok: false, error: "The recovery email was sent and the password replaced, but existing sessions could not be revoked. Try again." };
  }

  return { ok: true, mode: params.profileId ? "recovery_sent" : "existing_unlinked_recovery_sent" };
}
