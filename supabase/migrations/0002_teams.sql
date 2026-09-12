-- 0002_teams.sql
-- Teams, team members (participants), and consent records.

create sequence public.reference_id_seq;

create function public.next_reference_id(prefix text)
returns text
language sql
as $$
  select prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reference_id_seq')::text, 6, '0');
$$;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_name text not null,
  reference_id text not null unique default public.next_reference_id('TEAM'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'disqualified')),
  extra_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_teams before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  role text not null default 'member' check (role in ('lead', 'member')),
  reference_id text not null unique default public.next_reference_id('PTC'),

  full_name text not null,
  date_of_birth date not null,
  college text not null,
  roll_number text not null,
  email text not null,
  mobile text not null,
  whatsapp text not null,
  whatsapp_same_as_mobile boolean not null default true,
  gender text,
  extra_fields jsonb not null default '{}'::jsonb,

  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified')),
  invited_at timestamptz,
  verified_at timestamptz,

  consent_accepted boolean not null default false,
  privacy_policy_version_id uuid references public.policy_versions(id),
  terms_version_id uuid references public.policy_versions(id),
  communication_consent_essential boolean not null default true,
  communication_consent_promotional boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_id, email),
  unique (event_id, college, roll_number)
);

create index team_members_team_id_idx on public.team_members (team_id);
create index team_members_profile_id_idx on public.team_members (profile_id);
create index team_members_event_id_idx on public.team_members (event_id);

create trigger set_updated_at_team_members before update on public.team_members
  for each row execute function public.set_updated_at();

-- Exactly one lead per team, enforced at application layer + this partial unique index.
create unique index one_lead_per_team on public.team_members (team_id) where role = 'lead';

-- ---------------------------------------------------------------------------
-- Link a verified auth user to their pending team_member row by email match.
-- Called from a trigger on profiles insert/update (email confirmed) and
-- can also be invoked idempotently from server actions after OTP verification.
-- ---------------------------------------------------------------------------
create function public.link_verified_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.team_members
  set profile_id = new.id,
      verification_status = 'verified',
      verified_at = now()
  where lower(email) = lower(new.email)
    and profile_id is null;
  return new;
end;
$$;

create trigger on_profile_created_link_member
  after insert on public.profiles
  for each row execute function public.link_verified_member();

-- ---------------------------------------------------------------------------
-- consents: append-only log distinct from the current-state flags above,
-- so we retain history of every acceptance event.
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  consent_type text not null check (consent_type in ('essential_communication', 'promotional_communication', 'privacy_policy', 'terms')),
  accepted boolean not null,
  policy_version_id uuid references public.policy_versions(id),
  accepted_at timestamptz not null default now(),
  ip_address text
);

create index consents_team_member_id_idx on public.consents (team_member_id);
