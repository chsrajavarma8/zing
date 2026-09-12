-- 0026_final_scores.sql
-- Req. #9: each judge now enters exactly one final score (1-100 inclusive)
-- per team per round, instead of scoring each judging_criteria row
-- separately. judging_criteria/scores are left in place unchanged (the
-- criteria remain visible as the marking rubric in the admin panel and
-- judging interface - see judging_criteria_select, "select using (true)" -
-- they just no longer take a numeric entry each). The existing multi-judge
-- rule ("sum every judge's number for a team") is preserved here: a team's
-- round total is the sum of every judge's final_scores.score.

create table public.final_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  judge_id uuid not null references public.profiles(id),
  score numeric not null check (score >= 1 and score <= 100),
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, team_id, judge_id)
);

create index final_scores_round_team_idx on public.final_scores (round_id, team_id);

create trigger set_updated_at_final_scores before update on public.final_scores
  for each row execute function public.set_updated_at();

create table public.final_score_audit (
  id uuid primary key default gen_random_uuid(),
  final_score_id uuid not null references public.final_scores(id) on delete cascade,
  previous_score numeric,
  new_score numeric,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create function public.log_final_score_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.final_score_audit (final_score_id, previous_score, new_score, changed_by)
  values (new.id, case when tg_op = 'UPDATE' then old.score else null end, new.score, auth.uid());
  return new;
end;
$$;

create trigger final_scores_audit_insert after insert on public.final_scores
  for each row execute function public.log_final_score_change();

create trigger final_scores_audit_update after update of score on public.final_scores
  for each row execute function public.log_final_score_change();

alter table public.final_scores enable row level security;
alter table public.final_score_audit enable row level security;

-- Mirrors the scores_* policies in 0011_rls.sql: draft scores are staff-only,
-- participants/public see only published scope.
create policy final_scores_select on public.final_scores for select
  using (
    public.is_event_staff(public.round_event_id(round_id))
    or (
      public.is_team_member_of(team_id)
      and public.is_scope_published(round_id, 'participant')
    )
    or public.is_scope_published(round_id, 'public')
  );

create policy final_scores_insert on public.final_scores for insert
  with check (
    (public.is_reviewer(public.round_event_id(round_id)) and judge_id = auth.uid())
    or public.is_event_admin(public.round_event_id(round_id))
  );

create policy final_scores_update on public.final_scores for update
  using (
    (public.is_reviewer(public.round_event_id(round_id)) and judge_id = auth.uid())
    or public.is_event_admin(public.round_event_id(round_id))
  )
  with check (
    (public.is_reviewer(public.round_event_id(round_id)) and judge_id = auth.uid())
    or public.is_event_admin(public.round_event_id(round_id))
  );

create policy final_score_audit_select on public.final_score_audit for select
  using (
    exists (select 1 from public.final_scores s where s.id = final_score_id and public.is_event_staff(public.round_event_id(s.round_id)))
  );

-- Mirrors scores_participant_visible (0017_security_hardening.sql): masks
-- comments unless the round's participant publication explicitly marked
-- reviewer feedback visible - RLS alone can't hide just one column.
create view public.final_scores_participant_visible
  with (security_invoker = on)
  as
  select
    s.id,
    s.round_id,
    s.team_id,
    s.judge_id,
    s.score,
    case
      when exists (
        select 1 from public.publications p
        where p.round_id = s.round_id and p.scope = 'participant'
          and p.is_published and p.reviewer_feedback_visible
      ) then s.comments
      else null
    end as comments,
    s.created_at,
    s.updated_at
  from public.final_scores s;

grant select on public.final_scores_participant_visible to authenticated, anon;
