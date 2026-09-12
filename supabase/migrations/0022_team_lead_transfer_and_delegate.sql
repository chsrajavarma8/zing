-- 0022_team_lead_transfer_and_delegate.sql
-- Lets a team lead transfer leadership to an existing teammate (exactly one
-- lead at all times) and delegate submission access to one additional
-- member. Both are app-layer gated for timing (registration deadline /
-- team lock) in src/app/portal/team/actions.ts - this migration only adds
-- the data model and the RLS-visible "who can act" checks.

alter table public.teams
  add column submission_delegate_member_id uuid references public.team_members(id) on delete set null;

comment on column public.teams.submission_delegate_member_id is
  'Team lead may name one additional member who can create/edit/delete this team''s round submissions, alongside the lead. NULL = no delegate.';

-- Atomic leadership transfer: a single UPDATE flips both rows in one
-- statement so the partial unique index one_lead_per_team (team_members.role
-- = 'lead') never transiently sees zero or two leads. Runs as the calling
-- user's privileges are checked here (not just trusted from the caller) so
-- this function is safe to expose even though it's security definer.
create function public.transfer_team_lead(p_team_id uuid, p_new_lead_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_new_lead_team_id uuid;
begin
  if v_caller is null then
    raise exception 'Not signed in.';
  end if;

  if not public.is_team_lead(p_team_id, v_caller) then
    raise exception 'Only the current team lead can transfer leadership.';
  end if;

  select team_id into v_new_lead_team_id from public.team_members where id = p_new_lead_member_id;
  if v_new_lead_team_id is null or v_new_lead_team_id <> p_team_id then
    raise exception 'That person is not a member of this team.';
  end if;

  update public.team_members
  set role = case
    when id = p_new_lead_member_id then 'lead'
    when role = 'lead' then 'member'
    else role
  end
  where team_id = p_team_id and id in (
    p_new_lead_member_id,
    (select id from public.team_members where team_id = p_team_id and role = 'lead')
  );
end;
$$;

-- Only ever callable by an authenticated user; the function itself re-checks
-- that the caller is the team's actual current lead, so granting broad
-- execute is safe (mirrors verify_id_card()/event_registration_stats()
-- granted above - the function body is the real gate, not this grant).
grant execute on function public.transfer_team_lead(uuid, uuid) to authenticated;

create function public.is_submission_delegate(tid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.teams t
    join public.team_members tm on tm.id = t.submission_delegate_member_id
    where t.id = tid and tm.profile_id = uid
  );
$$;

-- Anyone who may act on a team's submissions: the lead or the one named delegate.
create function public.can_submit_for_team(tid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_team_lead(tid, uid) or public.is_submission_delegate(tid, uid);
$$;

drop policy submissions_insert on public.submissions;
create policy submissions_insert on public.submissions for insert
  with check (
    (public.can_submit_for_team(team_id) or public.is_event_admin(public.team_event_id(team_id)))
    and public.round_event_id(round_id) = public.team_event_id(team_id)
  );

drop policy submissions_update on public.submissions;
create policy submissions_update on public.submissions for update
  using (public.can_submit_for_team(team_id) or public.is_event_admin(public.team_event_id(team_id)))
  with check (
    (public.can_submit_for_team(team_id) or public.is_event_admin(public.team_event_id(team_id)))
    and public.round_event_id(round_id) = public.team_event_id(team_id)
  );

-- No delete policy existed before this migration - "Delete Submission" (req.
-- #11) needs one. Same authorized-actor set as insert/update.
create policy submissions_delete on public.submissions for delete
  using (public.can_submit_for_team(team_id) or public.is_event_admin(public.team_event_id(team_id)));
