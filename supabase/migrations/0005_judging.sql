-- 0005_judging.sql
-- Judging criteria, scores (draft/published), qualification, and publication controls.

create table public.judging_criteria (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  name text not null,
  max_marks numeric not null,
  weight numeric not null default 1,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  criterion_id uuid not null references public.judging_criteria(id) on delete cascade,
  judge_id uuid not null references public.profiles(id),
  marks numeric not null,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, team_id, criterion_id, judge_id)
);

create trigger set_updated_at_scores before update on public.scores
  for each row execute function public.set_updated_at();

create table public.score_audit (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.scores(id) on delete cascade,
  previous_marks numeric,
  new_marks numeric,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create function public.log_score_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.score_audit (score_id, previous_marks, new_marks, changed_by)
  values (new.id, case when tg_op = 'UPDATE' then old.marks else null end, new.marks, auth.uid());
  return new;
end;
$$;

create trigger scores_audit_insert after insert on public.scores
  for each row execute function public.log_score_change();

create trigger scores_audit_update after update of marks on public.scores
  for each row execute function public.log_score_change();

-- Controls whether round results are visible to participants and/or the public.
-- Two independent scopes so "participant results" can go live before "public results".
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  scope text not null check (scope in ('participant', 'public')),
  is_published boolean not null default false,
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  reviewer_feedback_visible boolean not null default false,
  unique (round_id, scope)
);

create table public.qualification_status (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  status text not null default 'pending' check (status in ('qualified', 'not_qualified', 'pending')),
  rank int,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz not null default now(),
  unique (team_id, round_id)
);
