-- 0001_core.sql
-- Core platform tables: profiles, platform roles, events, event-scoped admin roles,
-- configurable registration fields, and policy (privacy/terms) versions.

create extension if not exists "pgcrypto";

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: 1:1 extension of auth.users. Created automatically via trigger.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth.users, created by handle_new_user trigger.';

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- platform_roles: platform-wide super admin assignment. NEVER publicly
-- selectable/insertable by clients. Only managed via service-role scripts
-- or by an existing super admin through a privileged server action.
-- ---------------------------------------------------------------------------
create table public.platform_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('super_admin')),
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events: the reusable "hackathon" entity. Everything else hangs off this.
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null default '[HACKATHON NAME]',
  organizer_name text not null default '[ORGANIZER NAME]',
  tagline text,
  description text,
  prize_pool_label text not null default '[CONFIRMED PRIZE POOL]',
  start_date date,
  end_date date,
  registration_open_at timestamptz,
  registration_close_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  team_size_min int not null default 1,
  team_size_max int not null default 4,
  support_email text not null default '[CONTACT DETAILS]',
  support_phone text not null default '[CONTACT DETAILS]',
  support_website text,
  community_base_count int not null default 200,
  branding jsonb not null default '{}'::jsonb,
  problem_statement_mode text not null default 'self_identified'
    check (problem_statement_mode in ('self_identified', 'organizer_provided')),
  problem_statement_text text,
  allow_gender_field boolean not null default true,
  gender_field_required boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_default boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.events.community_base_count is
  'Offset added to actual registered participant count to produce displayedCommunityCount. Must be labeled as a community total, never as verified registrations, unless genuinely historical.';

create unique index one_default_event on public.events (is_default) where is_default;

-- ---------------------------------------------------------------------------
-- event_admins: event-scoped roles (event_admin, reviewer/judge).
-- Super admins implicitly have access to all events via platform_roles.
-- ---------------------------------------------------------------------------
create table public.event_admins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('event_admin', 'reviewer')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (event_id, user_id, role)
);

-- ---------------------------------------------------------------------------
-- registration_fields: admin-configurable extra fields collected at registration.
-- ---------------------------------------------------------------------------
create table public.registration_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  key text not null,
  label text not null,
  field_type text not null check (field_type in ('text', 'textarea', 'select', 'checkbox', 'number', 'date')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  applies_to text not null default 'team' check (applies_to in ('team', 'member')),
  order_index int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, key)
);

-- ---------------------------------------------------------------------------
-- policy_versions: versioned Privacy Policy / Terms text participants accept.
-- ---------------------------------------------------------------------------
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  type text not null check (type in ('privacy', 'terms', 'rules')),
  version text not null,
  content_markdown text not null default '',
  is_current boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (event_id, type, version)
);

create unique index one_current_policy_per_type
  on public.policy_versions (event_id, type) where is_current;

create trigger set_updated_at_profiles before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at_events before update on public.events
  for each row execute function public.set_updated_at();
