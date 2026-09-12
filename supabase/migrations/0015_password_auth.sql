-- 0015_password_auth.sql
-- Switch from OTP-only to email/password authentication. Accounts are still
-- only ever created by our own server code (team registration or an admin
-- invite) via the Supabase Admin API's inviteUserByEmail / resetPasswordForEmail
-- - there is still no public self-signup path anywhere in the app.
--
-- Previously, link_verified_member() marked a team_member "verified" the
-- moment their auth account + profile row existed. With password auth we
-- create that account proactively (to send the setup-link email), so
-- existence of the account no longer proves the participant did anything.
-- Verification must now happen explicitly when they complete the secure
-- link flow and set a password (see src/app/auth/set-password/actions.ts),
-- so this trigger now only links profile_id and leaves verification_status
-- untouched.

create or replace function public.link_verified_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.team_members
  set profile_id = new.id
  where lower(email) = lower(new.email)
    and profile_id is null;
  return new;
end;
$$;
