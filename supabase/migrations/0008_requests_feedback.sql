-- 0008_requests_feedback.sql
-- Organizer requests (general / exhibition / presentation / registration
-- correction / technical issue), threaded messages, and structured feedback.

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique default public.next_reference_id('REQ'),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id),
  type text not null check (type in ('general', 'exhibition', 'presentation', 'registration_correction', 'technical_issue')),
  subject text not null,
  message text not null,
  related_round_id uuid references public.rounds(id),
  -- Type-specific fields, e.g. exhibition: {project_title, exhibit_description, space_or_equipment_needs, additional_notes}.
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'in_progress', 'awaiting_response', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_team_id_idx on public.requests (team_id);
create index requests_event_id_idx on public.requests (event_id);

create trigger set_updated_at_requests before update on public.requests
  for each row execute function public.set_updated_at();

create table public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id),
  message text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index request_messages_request_id_idx on public.request_messages (request_id);

-- feedback: structured ratings per the participant-facing feedback form,
-- plus two free-text prompts. Always linked to the submitting participant -
-- never anonymous, since organizers may need to follow up.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  rating int check (rating between 1 and 5),
  registration_experience_rating int check (registration_experience_rating between 1 and 5),
  portal_usability_rating int check (portal_usability_rating between 1 and 5),
  communication_rating int check (communication_rating between 1 and 5),
  what_worked_well text,
  what_could_improve text,
  created_at timestamptz not null default now()
);

create index feedback_event_id_idx on public.feedback (event_id);
