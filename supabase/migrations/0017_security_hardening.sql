-- 0017_security_hardening.sql
-- Security audit fixes (see audit report). Adds column-level protection that
-- Postgres RLS cannot express directly (row-level only), closes a
-- cross-event PII leak, masks unpublished reviewer notes, and enforces
-- submission deadlines/consistency at the database boundary - not just in
-- server actions, which a direct PostgREST/Supabase-JS call can bypass.

-- =============================================================================
-- Generic helper: is the current request running as the service-role key?
-- Used by every protective trigger below so trusted server code (which
-- already performs its own authorization check before writing) is never
-- blocked, while a direct client write to a protected column is reverted.
-- =============================================================================
create or replace function public.is_service_role()
returns boolean
language sql stable
as $$
  select auth.role() = 'service_role';
$$;

-- =============================================================================
-- team_members: column-level protection.
--
-- team_members_update (0011_rls.sql) is a row-level policy - a participant
-- updating their OWN row, or a team lead updating a teammate's row, can
-- currently set ANY column, including role (self-promotion to lead),
-- profile_id (hijacking another account's association), team_id/event_id,
-- verification_status/verified_at (bypassing the mandatory password-change
-- gate - see finding 3), and consent flags. Only an event admin or trusted
-- server code (service role) may change these; everyone else's attempt to
-- change them is silently reverted to the prior value, while the rest of a
-- legitimate update (e.g. editing full_name) still goes through.
-- =============================================================================
create function public.protect_team_member_fields()
returns trigger
language plpgsql
as $$
begin
  if public.is_service_role() or public.is_event_admin(new.event_id) then
    return new;
  end if;

  if new.role is distinct from old.role then new.role := old.role; end if;
  if new.team_id is distinct from old.team_id then new.team_id := old.team_id; end if;
  if new.event_id is distinct from old.event_id then new.event_id := old.event_id; end if;
  if new.profile_id is distinct from old.profile_id then new.profile_id := old.profile_id; end if;
  if new.verification_status is distinct from old.verification_status then new.verification_status := old.verification_status; end if;
  if new.verified_at is distinct from old.verified_at then new.verified_at := old.verified_at; end if;
  if new.invited_at is distinct from old.invited_at then new.invited_at := old.invited_at; end if;
  if new.consent_accepted is distinct from old.consent_accepted then new.consent_accepted := old.consent_accepted; end if;
  if new.communication_consent_essential is distinct from old.communication_consent_essential then
    new.communication_consent_essential := old.communication_consent_essential;
  end if;
  if new.communication_consent_promotional is distinct from old.communication_consent_promotional then
    new.communication_consent_promotional := old.communication_consent_promotional;
  end if;

  return new;
end;
$$;

create trigger protect_team_member_fields
  before update on public.team_members
  for each row execute function public.protect_team_member_fields();

-- =============================================================================
-- teams: a team lead can currently self-approve/disqualify their own team via
-- a direct write to `status`, bypassing the admin-only TeamStatusControl UI.
-- =============================================================================
create function public.protect_team_fields()
returns trigger
language plpgsql
as $$
begin
  if public.is_service_role() or public.is_event_admin(new.event_id) then
    return new;
  end if;
  if new.status is distinct from old.status then new.status := old.status; end if;
  if new.event_id is distinct from old.event_id then new.event_id := old.event_id; end if;
  return new;
end;
$$;

create trigger protect_team_fields
  before update on public.teams
  for each row execute function public.protect_team_fields();

-- =============================================================================
-- submissions: a team lead can currently set review_status/reviewer_notes/
-- reviewed_by/reviewed_at directly (self-accepting their own submission), and
-- reassign a submission to a different team_id/round_id. Also enforce the
-- round deadline at the database boundary, not only in saveSubmission().
-- =============================================================================
create function public.protect_submission_fields()
returns trigger
language plpgsql
as $$
declare
  ev_id uuid;
  ends timestamptz;
begin
  -- team_id is NOT NULL on this table, so new.team_id is always present on
  -- both INSERT and UPDATE - do not reference OLD here, it isn't assigned
  -- yet on INSERT and referencing it would raise "record OLD is not
  -- assigned yet" for every new submission.
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
    -- Insert: reviewer fields must start clean, never attacker-supplied.
    new.review_status := 'pending';
    new.reviewer_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  select r.ends_at into ends from public.rounds r where r.id = new.round_id;
  if ends is not null and now() > ends then
    raise exception 'The submission deadline for this round has passed.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger protect_submission_fields
  before insert or update on public.submissions
  for each row execute function public.protect_submission_fields();

-- =============================================================================
-- scores: enforce marks bounds and criterion/round/team consistency at the
-- database boundary (previously unchecked - a judge row could reference a
-- criterion belonging to a different round, or an out-of-range mark).
-- =============================================================================
create function public.validate_score()
returns trigger
language plpgsql
as $$
declare
  crit_round uuid;
  max_marks numeric;
  team_event uuid;
  round_event uuid;
begin
  select round_id, jc.max_marks into crit_round, max_marks
    from public.judging_criteria jc where jc.id = new.criterion_id;

  if crit_round is null then
    raise exception 'Unknown judging criterion.' using errcode = '22023';
  end if;
  if crit_round is distinct from new.round_id then
    raise exception 'This criterion does not belong to the given round.' using errcode = '22023';
  end if;

  team_event := public.team_event_id(new.team_id);
  round_event := public.round_event_id(new.round_id);
  if team_event is null or round_event is null or team_event is distinct from round_event then
    raise exception 'Team and round belong to different events.' using errcode = '22023';
  end if;

  if new.marks < 0 or (max_marks is not null and new.marks > max_marks) then
    raise exception 'Marks must be between 0 and % for this criterion.', max_marks using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger validate_score
  before insert or update on public.scores
  for each row execute function public.validate_score();

-- =============================================================================
-- notification_recipients: a recipient should only ever toggle read_at on
-- their own row - not reassign it to a different notification/profile or
-- forge delivery status.
-- =============================================================================
create function public.protect_notification_recipient_fields()
returns trigger
language plpgsql
as $$
begin
  if public.is_service_role() or exists (
    select 1 from public.notifications n where n.id = new.notification_id and public.is_event_admin(n.event_id)
  ) then
    return new;
  end if;

  if new.notification_id is distinct from old.notification_id then new.notification_id := old.notification_id; end if;
  if new.profile_id is distinct from old.profile_id then new.profile_id := old.profile_id; end if;
  if new.channel is distinct from old.channel then new.channel := old.channel; end if;
  if new.delivery_status is distinct from old.delivery_status then new.delivery_status := old.delivery_status; end if;
  if new.error_message is distinct from old.error_message then new.error_message := old.error_message; end if;
  if new.delivered_at is distinct from old.delivered_at then new.delivered_at := old.delivered_at; end if;

  return new;
end;
$$;

create trigger protect_notification_recipient_fields
  before update on public.notification_recipients
  for each row execute function public.protect_notification_recipient_fields();

-- =============================================================================
-- profiles_select: cross-event PII leak. is_any_staff() checks "is this user
-- staff for ANY event", so a reviewer on one small event could read every
-- registered participant's full_name/email across every unrelated event on
-- the platform. Scope it: staff can see profiles of participants within
-- events they actually have access to, plus other admins/reviewers (needed
-- for the Roles & Admins page) - never arbitrary unrelated participants.
-- =============================================================================
drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.team_members tm
      where tm.profile_id = profiles.id and public.is_event_staff(tm.event_id)
    )
    or (
      public.is_any_staff()
      and exists (select 1 from public.event_admins ea where ea.user_id = profiles.id)
    )
  );

-- =============================================================================
-- scores: unpublished reviewer comments must never be visible just because
-- marks were published to participants/public. RLS is row-level, so this
-- needs a view that nulls `comments` out unless the round's participant
-- publication explicitly marked reviewer_feedback_visible. Staff keep using
-- the base table directly (unchanged - they should see everything).
-- =============================================================================
create view public.scores_participant_visible
  with (security_invoker = on)
  as
  select
    s.id,
    s.round_id,
    s.team_id,
    s.criterion_id,
    s.judge_id,
    s.marks,
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
  from public.scores s;

grant select on public.scores_participant_visible to authenticated, anon;
