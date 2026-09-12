-- 0014_admin_invites.sql
-- Secure administrator provisioning: there is no publicly selectable admin role
-- and no signup form grants admin access. A super admin (via a privileged
-- server action using the service role) creates a pending invite by email;
-- the invite is consumed automatically the first time that email completes
-- OTP/magic-link login, granting the platform_roles / event_admins row.

create table public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  scope text not null check (scope in ('platform', 'event')),
  event_id uuid references public.events(id) on delete cascade,
  role text not null check (role in ('super_admin', 'event_admin', 'reviewer')),
  invited_by uuid references public.profiles(id),
  invited_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_by uuid references public.profiles(id),
  check ((scope = 'platform' and event_id is null) or (scope = 'event' and event_id is not null)),
  check (scope = 'event' or role = 'super_admin')
);

create index admin_invites_email_idx on public.admin_invites (lower(email)) where consumed_at is null;

alter table public.admin_invites enable row level security;

create policy admin_invites_select on public.admin_invites for select
  using (public.is_super_admin() or (scope = 'event' and event_id is not null and public.is_event_admin(event_id)));

create policy admin_invites_write on public.admin_invites for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create function public.consume_admin_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  for inv in
    select * from public.admin_invites
    where lower(email) = lower(new.email) and consumed_at is null
  loop
    if inv.scope = 'platform' then
      insert into public.platform_roles (user_id, role, granted_by)
      values (new.id, inv.role, inv.invited_by)
      on conflict (user_id) do nothing;
    else
      insert into public.event_admins (event_id, user_id, role, created_by)
      values (inv.event_id, new.id, inv.role, inv.invited_by)
      on conflict (event_id, user_id, role) do nothing;
    end if;

    update public.admin_invites
    set consumed_at = now(), consumed_by = new.id
    where id = inv.id;
  end loop;
  return new;
end;
$$;

create trigger on_profile_created_consume_invites
  after insert on public.profiles
  for each row execute function public.consume_admin_invites();

-- ---------------------------------------------------------------------------
-- login_eligibility: used by the login route to decide whether to allow
-- Supabase to create a new auth user for an email that has never signed in.
-- Eligible = has a team_member record in any event, OR an unconsumed admin
-- invite, OR is already a known profile (returning user).
-- ---------------------------------------------------------------------------
create function public.is_login_eligible(p_email text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (select 1 from public.profiles where lower(email) = lower(p_email))
    or exists (select 1 from public.team_members where lower(email) = lower(p_email))
    or exists (select 1 from public.admin_invites where lower(email) = lower(p_email) and consumed_at is null);
$$;

grant execute on function public.is_login_eligible(text) to anon, authenticated;
