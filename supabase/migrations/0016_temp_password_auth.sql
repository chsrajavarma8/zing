-- 0016_temp_password_auth.sql
-- Switch participant onboarding from email-link password setup to
-- server-generated deterministic temporary passwords (no email sent).
-- Admin/reviewer provisioning (invite links) is untouched - this only
-- affects the participant account-creation path.

alter table public.profiles
  add column must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'True immediately after a participant account is created with a
   server-generated temporary password. Cleared only by the server-side
   password-change action once the participant has set their own private
   password - never client-writable, see protect_must_change_password below.';

-- Defense in depth: profiles_update_self (0011_rls.sql) lets a user update
-- their own profile row at the row level, which Postgres RLS cannot restrict
-- to individual columns. Without this trigger, a participant could bypass
-- the mandatory password-change gate by calling
-- `supabase.from('profiles').update({ must_change_password: false })`
-- directly from the browser without ever changing their password. Only the
-- service-role client (used exclusively by trusted server actions) may
-- change this column.
create function public.protect_must_change_password()
returns trigger
language plpgsql
as $$
begin
  if new.must_change_password is distinct from old.must_change_password
     and auth.role() is distinct from 'service_role' then
    new.must_change_password := old.must_change_password;
  end if;
  return new;
end;
$$;

create trigger protect_must_change_password
  before update on public.profiles
  for each row execute function public.protect_must_change_password();
