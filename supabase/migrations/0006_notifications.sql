-- 0006_notifications.sql
-- Notifications with per-recipient, per-channel delivery tracking.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  message text not null,
  audience_type text not null check (audience_type in
    ('all', 'team_leads', 'team_members', 'selected_teams', 'individual', 'round_based')),
  audience_filter jsonb not null default '{}'::jsonb,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  related_round_id uuid references public.rounds(id),
  channels text[] not null default array['in_app']::text[],
  action_link text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index notifications_event_id_idx on public.notifications (event_id);

create table public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'whatsapp')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'delivered', 'failed', 'not_configured')),
  error_message text,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, profile_id, channel)
);

create index notification_recipients_profile_id_idx on public.notification_recipients (profile_id);
create index notification_recipients_notification_id_idx on public.notification_recipients (notification_id);
