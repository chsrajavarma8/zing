-- 0024_login_activity.sql
-- Login activity log for the admin panel (req. #13): every sign-in attempt,
-- success or failure, across every account type. Written only by trusted
-- server code with the service-role client (same pattern as audit_logs) -
-- there is deliberately no client insert policy, so a participant cannot
-- forge or hide their own login history.

create table public.login_activity (
  id uuid primary key default gen_random_uuid(),
  attempted_email text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  role text not null default 'unknown' check (role in ('participant', 'team_lead', 'event_admin', 'reviewer', 'super_admin', 'unknown')),
  outcome text not null check (outcome in ('success', 'invalid_credentials', 'rate_limited')),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index login_activity_created_at_idx on public.login_activity (created_at desc);
create index login_activity_profile_id_idx on public.login_activity (profile_id);
create index login_activity_email_idx on public.login_activity (attempted_email);

alter table public.login_activity enable row level security;

-- Readable by administrators only (super admin, or an event_admin on any
-- event) - deliberately excludes reviewers/judges, who have no need to see
-- account login history. Never insertable/updatable by any client role
-- since all writes go through the service role from src/app/login/actions.ts.
create policy login_activity_select on public.login_activity for select
  using (
    public.is_super_admin()
    or exists (select 1 from public.event_admins where user_id = auth.uid() and role = 'event_admin')
  );
