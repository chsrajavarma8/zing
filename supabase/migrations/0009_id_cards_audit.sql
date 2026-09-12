-- 0009_id_cards_audit.sql
-- Participant ID cards (QR-verifiable) and the platform-wide audit log.

create table public.id_cards (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references public.team_members(id) on delete cascade unique,
  qr_token uuid not null default gen_random_uuid() unique,
  issued_at timestamptz not null default now(),
  revoked boolean not null default false
);

-- audit_logs: append-only trail of privileged/admin actions.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  event_id uuid references public.events(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index audit_logs_event_id_idx on public.audit_logs (event_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
