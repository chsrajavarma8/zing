import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword, InvalidDateOfBirthError } from "@/lib/auth/temp-password";

// Every participant Supabase Auth account is created or reset from here, and
// only ever with the service-role client - never expose that key or this
// module to client components. No email is ever sent as part of this: the
// temporary password is deterministic and the participant computes it
// themselves from details only they (and whoever entered the registration
// form) already know.

export type ProvisionOutcome =
  | { status: "created"; profileId: string }
  | { status: "linked_existing"; profileId: string }
  | { status: "failed"; error: string };

async function findExistingProfileId(email: string): Promise<string | null> {
  const admin = createAdminClient();
  // Exact match only. `ilike` treats attacker-supplied `%`/`_` as wildcards -
  // a registration email of e.g. "a%" would pattern-match and silently
  // adopt an unrelated existing account. `email` is already normalized
  // (lowercased/trimmed) by the caller, and profiles.email is always stored
  // lowercased by provisioning, so a plain equality match is correct.
  const { data } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// Called once per participant at registration time (or when a team lead adds
// a member later).
//
// If the email belongs to a brand-new account, it's created fresh here and
// immediately linked - nobody else was using it, so there's no consent
// concern.
//
// If the email already has an EXISTING account, we deliberately do NOT link
// it here and never touch its password - attacker-submitted registration
// data alone is not "account-owner acceptance". The existing account gets
// linked automatically, but only at the moment its real owner successfully
// signs in with their own password (see the link-sweep in
// src/app/login/actions.ts) - that authentication event is the actual proof
// of ownership this requires.
export async function provisionParticipantAccount(params: {
  email: string;
  teamName: string;
  fullName: string;
  dateOfBirth: string;
}): Promise<ProvisionOutcome> {
  const email = params.email.toLowerCase().trim();

  const existingProfileId = await findExistingProfileId(email);
  if (existingProfileId) {
    return { status: "linked_existing", profileId: existingProfileId };
  }

  let tempPassword: string;
  try {
    tempPassword = generateTemporaryPassword(params);
  } catch (err) {
    if (err instanceof InvalidDateOfBirthError) {
      return { status: "failed", error: "Invalid date of birth - could not create an account." };
    }
    throw err;
  }

  const admin = createAdminClient();

  // Refuse to create a participant account for an email that has a pending,
  // unconsumed admin invitation - otherwise a participant registration could
  // "squat" that email before the real admin completes their invite. The
  // real admin still recovers cleanly (Supabase's invite/reset flow proves
  // mailbox ownership regardless), but this closes the nuisance proactively.
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

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: params.fullName },
  });

  if (error || !data.user) {
    return { status: "failed", error: error?.message ?? "Could not create account." };
  }

  await admin.from("profiles").update({ must_change_password: true }).eq("id", data.user.id);

  return { status: "created", profileId: data.user.id };
}

export type ResetOutcome = { ok: true } | { ok: false; error: string };

// Organizer-assisted recovery: regenerates the same deterministic temporary
// password (participants already know the formula from the sign-in page)
// and forces another mandatory password change.
//
// `teamMemberId`, when given, is linked to the account (team_members.profile_id)
// once the account is confirmed - see the `!params.profileId` branch below for
// why that matters.
//
// The staff-account exclusion is enforced HERE, not only by callers - any
// future caller of this shared function automatically gets the same
// protection, rather than depending on every call site remembering to
// re-implement the check itself.
//
// Known limitation, documented rather than silently assumed fixed: this
// changes the account's password (which invalidates future refresh-token
// use), but the Supabase Admin SDK has no "revoke sessions by user id" call
// - only signOut(jwt), which needs a live token we don't have here. An
// access token issued before this reset remains valid until its own natural
// expiry (~1 hour) even after the reset completes.
export async function resetParticipantAccount(params: {
  profileId: string | null;
  email: string;
  teamName: string;
  fullName: string;
  dateOfBirth: string;
  teamMemberId?: string;
}): Promise<ResetOutcome> {
  const admin = createAdminClient();

  // A never-linked team_members row (profile_id null) doesn't mean "no
  // account exists" - provisionParticipantAccount deliberately leaves
  // profile_id unlinked whenever the email already belonged to an account it
  // didn't create (see that function's comment). Look that account up here
  // too, or this whole reset silently no-ops: it used to fall through to
  // provisionParticipantAccount() below, which finds that same existing
  // account, reports "linked_existing", and returns success - without ever
  // touching that account's actual password. This tool is only reachable
  // after an organizer has already verified the participant's identity out
  // of band (see callers), which is exactly the ownership proof
  // provisionParticipantAccount() can't assume on its own - so resetting and
  // linking it here, unlike there, is safe.
  const profileId = params.profileId ?? (await findExistingProfileId(params.email.toLowerCase().trim()));

  if (profileId) {
    // Resolve and check the actual target account - never trust a caller
    // simply not to pass a staff account in; verify it here.
    const [{ data: platformRole }, { data: eventAdminRows }] = await Promise.all([
      admin.from("platform_roles").select("user_id").eq("user_id", profileId).maybeSingle(),
      admin.from("event_admins").select("id").eq("user_id", profileId).limit(1),
    ]);
    if (platformRole || (eventAdminRows && eventAdminRows.length > 0)) {
      return {
        ok: false,
        error: "This account also has admin access — it cannot be reset with the predictable participant formula.",
      };
    }

    let tempPassword: string;
    try {
      tempPassword = generateTemporaryPassword(params);
    } catch (err) {
      if (err instanceof InvalidDateOfBirthError) {
        return { ok: false, error: "Invalid date of birth on file - could not reset access." };
      }
      throw err;
    }

    const { error: pwError } = await admin.auth.admin.updateUserById(profileId, { password: tempPassword });
    if (pwError) return { ok: false, error: pwError.message || "Could not reset access." };

    // Never leave an account with a reset password but without the mandatory
    // change-password restriction - if this write fails, surface it as a
    // failure rather than silently leaving the account in that state.
    const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", profileId);
    if (flagError) {
      return {
        ok: false,
        error: "Password was reset but the mandatory change flag could not be set. Reset access again to retry.",
      };
    }

    if (params.teamMemberId) {
      await admin.from("team_members").update({ profile_id: profileId }).eq("id", params.teamMemberId).is("profile_id", null);
    }

    return { ok: true };
  }

  // Genuinely no account anywhere for this email - create one fresh.
  const outcome = await provisionParticipantAccount(params);
  if (outcome.status === "failed") return { ok: false, error: outcome.error };
  if (params.teamMemberId) {
    await admin.from("team_members").update({ profile_id: outcome.profileId }).eq("id", params.teamMemberId).is("profile_id", null);
  }
  return { ok: true };
}

// Called after a team rename (src/app/portal/team/actions.ts, renameTeam):
// the temporary-password formula bakes in the team name at account-creation
// time, so a rename would otherwise silently strand anyone who hasn't
// finished onboarding yet - the sign-in page and admin panel both compute
// the formula from the CURRENT team name, which no longer matches the
// password issued under the old one. Only accounts still on their temp
// password are resynced (must_change_password still true); anyone who
// already chose their own private password keeps it untouched.
export async function resyncTempPasswordsForTeam(teamId: string, newTeamName: string): Promise<void> {
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("team_members")
    .select("profile_id, email, full_name, date_of_birth, profiles(must_change_password)")
    .eq("team_id", teamId)
    .not("profile_id", "is", null);

  const toResync = (
    (members as unknown as {
      profile_id: string;
      email: string;
      full_name: string;
      date_of_birth: string;
      profiles: { must_change_password: boolean } | null;
    }[]) ?? []
  ).filter((m) => m.profiles?.must_change_password);

  await Promise.all(
    toResync.map((m) =>
      resetParticipantAccount({
        profileId: m.profile_id,
        email: m.email,
        teamName: newTeamName,
        fullName: m.full_name,
        dateOfBirth: m.date_of_birth,
      }),
    ),
  );
}
