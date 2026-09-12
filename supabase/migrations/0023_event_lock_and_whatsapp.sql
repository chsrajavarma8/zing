-- 0023_event_lock_and_whatsapp.sql
-- (a) A distinct "hackathon start" instant that locks team changes, kept
--     separate from registration_close_at (registration can close well
--     before the event actually starts) and from the display-only
--     start_date (a date, not a precise instant). NULL = not yet locked by
--     this gate (registration_close_at can still lock things independently).
-- (b) Admin-configurable WhatsApp group invite link shown after registration
--     and on the participant dashboard - a group invite only, never used for
--     notification delivery.

alter table public.events
  add column team_lock_at timestamptz,
  add column whatsapp_group_url text,
  add column whatsapp_group_enabled boolean not null default false;

comment on column public.events.team_lock_at is
  'Once now() passes this instant, team composition/details/leadership/delegate can no longer change (submissions during an open round window are unaffected). NULL = this gate is not yet active.';
comment on column public.events.whatsapp_group_url is
  'WhatsApp group invite link (chat.whatsapp.com/...) shown on the registration confirmation page and participant dashboard. Never used for outbound notification delivery.';
