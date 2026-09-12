-- 0018_admin_invite_tokens.sql
-- CRITICAL fix: consume_admin_invites() (0014_admin_invites.sql) fires on
-- EVERY profile creation and grants a role purely by matching email - with
-- no proof that the person creating that profile actually owns the mailbox.
-- Participant registration creates profiles with an attacker-supplied email
-- and `email_confirm: true` (a flag WE set to skip Supabase's own email
-- step, not evidence of mailbox ownership). Anyone who knows or guesses an
-- email a super admin invite is pending for could register a "team" using
-- that exact email before the real admin completes their invite, and the
-- trigger would silently hand them the role. This happened structurally
-- (not just hypothetically) in this project: an invite row was left
-- unconsumed for a real duration after a failed send earlier this session.
--
-- Fix: profile creation alone no longer grants anything. An invite is only
-- consumed by an explicit, token-bound acceptance action (see
-- acceptAdminInvite() in src/lib/auth/provisioning.ts) that verifies the
-- CURRENTLY AUTHENTICATED session's email matches the invite, using an
-- unguessable single-use token that only ever reaches the real inbox via
-- Supabase's own email delivery embedded in the invite/reset link.

drop trigger if exists on_profile_created_consume_invites on public.profiles;
drop function if exists public.consume_admin_invites();

alter table public.admin_invites
  add column token text,
  add column expires_at timestamptz not null default (now() + interval '7 days');

update public.admin_invites set token = encode(gen_random_bytes(32), 'hex') where token is null;

alter table public.admin_invites
  alter column token set not null;

create unique index admin_invites_token_idx on public.admin_invites (token);

comment on column public.admin_invites.token is
  'Unguessable single-use token embedded in the invite/reset link redirect
   URL. Consuming an invite requires presenting this exact token from an
   authenticated session whose email matches - never inferred from email
   alone. See acceptAdminInvite().';

-- Atomic, race-safe acceptance: a single UPDATE ... WHERE consumed_at IS
-- NULL RETURNING * (issued from acceptAdminInvite() via the service-role
-- client) can only ever succeed once per invite, so two concurrent accept
-- attempts for the same token cannot both grant a role.
