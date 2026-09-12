-- 0007_content.sql
-- Admin-editable public content: documents, announcements, FAQs, generic content blocks.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  type text not null check (type in
    ('rules', 'submission_instructions', 'presentation_guidelines', 'exhibit_request', 'organizer_published')),
  storage_path text,
  external_url text,
  version int not null default 1,
  is_current boolean not null default true,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index documents_event_id_idx on public.documents (event_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index announcements_event_id_idx on public.announcements (event_id);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question text not null,
  answer text not null,
  order_index int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Generic keyed content blocks for homepage hero copy, prizes text, eligibility
-- rules, etc. `key` examples: 'hero', 'about', 'eligibility', 'prizes', 'privacy_intro'.
create table public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  key text not null,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (event_id, key)
);

create trigger set_updated_at_content_blocks before update on public.content_blocks
  for each row execute function public.set_updated_at();
