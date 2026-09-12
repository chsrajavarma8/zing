-- 0030_round_activation_and_review_decisions.sql
-- Req. #18/#19: replace the three-way rounds.status enum (upcoming/active/
-- completed) - which only ever drove a read-only public badge and was
-- otherwise disconnected from submission enforcement - with a single
-- `is_active` switch that admins control directly and that the submission
-- window checks now actually enforce, alongside starts_at/ends_at.
-- Req. #20: collapse the ad-hoc review_status values (pending/accessible/
-- access_issue/accepted) into the three states organizers actually use to
-- make a decision - pending_review/accepted/rejected - and track who
-- submitted, so review-decision notifications can reach the right people.

-- =============================================================================
-- rounds.is_active
-- =============================================================================
alter table public.rounds add column is_active boolean not null default false;

update public.rounds set is_active = true where status = 'active';

alter table public.rounds drop constraint if exists rounds_status_check;
alter table public.rounds drop column status;

-- =============================================================================
-- submissions: review decision + who submitted
-- =============================================================================
alter table public.submissions add column submitted_by uuid references public.profiles(id);

alter table public.submissions drop constraint if exists submissions_review_status_check;

update public.submissions set review_status = 'pending_review' where review_status in ('pending', 'accessible');
update public.submissions set review_status = 'rejected' where review_status = 'access_issue';

-- Backfill so the not-null-reason constraint below doesn't reject
-- pre-existing rows carried over from the old 'access_issue' status without
-- notes attached.
update public.submissions
set reviewer_notes = 'No reason recorded.'
where review_status = 'rejected' and coalesce(trim(reviewer_notes), '') = '';

alter table public.submissions alter column review_status set default 'pending_review';
alter table public.submissions add constraint submissions_review_status_check
  check (review_status in ('pending_review', 'accepted', 'rejected'));

-- A rejection must always carry a reason for the team to act on - enforced
-- at the database boundary, not just in the admin UI.
alter table public.submissions add constraint submissions_rejected_requires_reason
  check (review_status <> 'rejected' or coalesce(trim(reviewer_notes), '') <> '');

-- =============================================================================
-- protect_submission_fields / protect_submission_delete_window: now also
-- require the round to be is_active, not just within its starts_at/ends_at
-- window - a round can be timed but switched off, and vice versa either
-- check alone let submissions through the other didn't intend.
-- =============================================================================
create or replace function public.protect_submission_fields()
returns trigger
language plpgsql
as $$
declare
  ev_id uuid;
  active boolean;
  starts timestamptz;
  ends timestamptz;
begin
  ev_id := public.team_event_id(new.team_id);

  if public.is_service_role() or public.is_event_admin(ev_id) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.review_status is distinct from old.review_status then new.review_status := old.review_status; end if;
    if new.reviewer_notes is distinct from old.reviewer_notes then new.reviewer_notes := old.reviewer_notes; end if;
    if new.reviewed_by is distinct from old.reviewed_by then new.reviewed_by := old.reviewed_by; end if;
    if new.reviewed_at is distinct from old.reviewed_at then new.reviewed_at := old.reviewed_at; end if;
    if new.team_id is distinct from old.team_id then new.team_id := old.team_id; end if;
    if new.round_id is distinct from old.round_id then new.round_id := old.round_id; end if;
  else
    new.review_status := 'pending_review';
    new.reviewer_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  select r.is_active, r.starts_at, r.ends_at into active, starts, ends from public.rounds r where r.id = new.round_id;
  if not coalesce(active, false) then
    raise exception 'This round is not open for submissions.' using errcode = '22023';
  end if;
  if starts is not null and now() < starts then
    raise exception 'The submission window has not opened yet for this round.' using errcode = '22023';
  end if;
  if ends is not null and now() > ends then
    raise exception 'The submission deadline for this round has passed.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function public.protect_submission_delete_window()
returns trigger
language plpgsql
as $$
declare
  ev_id uuid;
  active boolean;
  ends timestamptz;
begin
  ev_id := public.team_event_id(old.team_id);

  if public.is_service_role() or public.is_event_admin(ev_id) then
    return old;
  end if;

  select r.is_active, r.ends_at into active, ends from public.rounds r where r.id = old.round_id;
  if not coalesce(active, false) then
    raise exception 'This round is not open for submissions - deletion is no longer allowed.' using errcode = '22023';
  end if;
  if ends is not null and now() > ends then
    raise exception 'The submission deadline for this round has passed - deletion is no longer allowed.' using errcode = '22023';
  end if;

  return old;
end;
$$;
