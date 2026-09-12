-- 0003_rounds_exams.sql
-- Rounds (Minor / Intermediate / Major) and the Minor-round screening exam engine.

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  key text not null check (key in ('minor', 'intermediate', 'major')),
  name text not null,
  description text,
  deliverables text,
  evaluation_criteria text,
  advancement_rules text,
  order_index int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, key)
);

create trigger set_updated_at_rounds before update on public.rounds
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- exams: one screening exam per (typically) the Minor round.
-- ---------------------------------------------------------------------------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  title text not null,
  instructions text,
  duration_minutes int not null default 60,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  shuffle_questions boolean not null default true,
  qualification_rule jsonb not null default '{"type":"top_n","n":50}'::jsonb,
  answer_key_release_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_exams before update on public.exams
  for each row execute function public.set_updated_at();

create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('mcq_single', 'mcq_multi', 'short_text')),
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb,
  marks numeric not null default 1,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index exam_questions_exam_id_idx on public.exam_questions (exam_id);

-- One attempt per participant per exam. Timing is server-authoritative:
-- expires_at is fixed at start time and the client never controls it.
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'auto_submitted', 'disqualified')),
  score numeric,
  created_at timestamptz not null default now(),
  unique (exam_id, team_member_id)
);

create index exam_attempts_exam_id_idx on public.exam_attempts (exam_id);
create index exam_attempts_team_member_id_idx on public.exam_attempts (team_member_id);

create table public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  answer jsonb,
  is_correct boolean,
  marks_awarded numeric,
  autosaved_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index exam_answers_attempt_id_idx on public.exam_answers (attempt_id);

create table public.exam_qualifications (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  qualified boolean not null default false,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz not null default now(),
  unique (exam_id, team_member_id)
);
