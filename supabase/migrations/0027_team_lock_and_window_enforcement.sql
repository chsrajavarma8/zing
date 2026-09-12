-- 0027_team_lock_and_window_enforcement.sql
-- Req. #5 and #11 hardening: the app-layer checks added in
-- src/app/portal/team/actions.ts (team_lock_at) and
-- src/app/portal/submission/actions.ts (round starts_at, and the delete
-- window) are not the real security boundary - a direct PostgREST/
-- Supabase-JS call with a participant's own JWT bypasses server actions
-- entirely and only goes through RLS. This migration closes that gap the
-- same way 0017_security_hardening.sql did for the equivalent cases:
-- enforce timing at the database boundary too, not just in application code.

-- =============================================================================
-- teams / team_members: block team-composition changes once team_lock_at has
-- passed, for everyone except staff and trusted server code (service role -
-- e.g. admin-assisted corrections). transfer_team_lead() runs as the calling
-- participant's own role (not service role), so it is correctly still
-- blocked by this trigger once locked - leadership transfer freezes too.
-- =============================================================================
create function public.protect_team_lock()
returns trigger
language plpgsql
as $$
declare
  ev record;
  v_event_id uuid;
begin
  -- This trigger fires on both INSERT and DELETE. NEW is not assigned on
  -- DELETE and OLD is not assigned on INSERT - referencing either
  -- unconditionally raises "record ... is not assigned yet" (the same
  -- pitfall documented in protect_submission_fields, 0017_security_hardening.sql).
  v_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;

  if public.is_service_role() or public.is_event_admin(v_event_id) then
    return coalesce(new, old);
  end if;

  select team_lock_at, registration_close_at into ev from public.events where id = v_event_id;

  if ev.team_lock_at is not null and now() > ev.team_lock_at then
    raise exception 'Team changes are locked - the hackathon has started.' using errcode = '22023';
  end if;
  if ev.registration_close_at is not null and now() > ev.registration_close_at then
    raise exception 'Team changes are locked - the registration deadline has passed.' using errcode = '22023';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger protect_team_lock_members
  before insert or delete on public.team_members
  for each row execute function public.protect_team_lock();

-- teams table has no event_id on DELETE-relevant paths beyond update; only
-- guard the mutable fields a lead can otherwise change (name, delegate).
create function public.protect_team_fields_lock()
returns trigger
language plpgsql
as $$
declare
  ev record;
begin
  if public.is_service_role() or public.is_event_admin(new.event_id) then
    return new;
  end if;

  if new.team_name is distinct from old.team_name
     or new.submission_delegate_member_id is distinct from old.submission_delegate_member_id then
    select team_lock_at, registration_close_at into ev from public.events where id = new.event_id;
    if ev.team_lock_at is not null and now() > ev.team_lock_at then
      raise exception 'Team changes are locked - the hackathon has started.' using errcode = '22023';
    end if;
    if ev.registration_close_at is not null and now() > ev.registration_close_at then
      raise exception 'Team changes are locked - the registration deadline has passed.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_team_fields_lock
  before update on public.teams
  for each row execute function public.protect_team_fields_lock();

-- team_members.role changes (lead transfer) go through transfer_team_lead(),
-- which runs as the calling participant's own privileges (not service
-- role), so this must also gate role flips the same way.
create function public.protect_team_member_role_lock()
returns trigger
language plpgsql
as $$
declare
  ev record;
begin
  if public.is_service_role() or public.is_event_admin(new.event_id) then
    return new;
  end if;

  if new.role is distinct from old.role then
    select team_lock_at, registration_close_at into ev from public.events where id = new.event_id;
    if ev.team_lock_at is not null and now() > ev.team_lock_at then
      raise exception 'Team changes are locked - the hackathon has started.' using errcode = '22023';
    end if;
    if ev.registration_close_at is not null and now() > ev.registration_close_at then
      raise exception 'Team changes are locked - the registration deadline has passed.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

-- Runs alongside (not instead of) the existing protect_team_member_fields
-- trigger from 0017 - that one still reverts role for anyone who isn't
-- staff/service-role on a raw column write; this one additionally blocks
-- the legitimate transfer_team_lead() RPC path once locked, since that
-- function performs the UPDATE as the caller's own role.
create trigger protect_team_member_role_lock
  before update on public.team_members
  for each row execute function public.protect_team_member_role_lock();

-- =============================================================================
-- submissions: protect_submission_fields (0017) only checked ends_at (the
-- deadline). Add the window-open check (starts_at) to the same trigger, and
-- add an equivalent BEFORE DELETE trigger, since "Delete Submission" (req.
-- #11) previously had no database-level timing protection at all - only the
-- app-layer check in deleteSubmission().
-- =============================================================================
create or replace function public.protect_submission_fields()
returns trigger
language plpgsql
as $$
declare
  ev_id uuid;
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
    new.review_status := 'pending';
    new.reviewer_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  select r.starts_at, r.ends_at into starts, ends from public.rounds r where r.id = new.round_id;
  if starts is not null and now() < starts then
    raise exception 'The submission window has not opened yet for this round.' using errcode = '22023';
  end if;
  if ends is not null and now() > ends then
    raise exception 'The submission deadline for this round has passed.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create function public.protect_submission_delete_window()
returns trigger
language plpgsql
as $$
declare
  ev_id uuid;
  ends timestamptz;
begin
  ev_id := public.team_event_id(old.team_id);

  if public.is_service_role() or public.is_event_admin(ev_id) then
    return old;
  end if;

  select r.ends_at into ends from public.rounds r where r.id = old.round_id;
  if ends is not null and now() > ends then
    raise exception 'The submission deadline for this round has passed - deletion is no longer allowed.' using errcode = '22023';
  end if;

  return old;
end;
$$;

create trigger protect_submission_delete_window
  before delete on public.submissions
  for each row execute function public.protect_submission_delete_window();

-- =============================================================================
-- CRITICAL FIX: transfer_team_lead() (0022_team_lead_transfer_and_delegate.sql)
-- performs `update team_members set role = ...` as the calling lead's own
-- authenticated role (SECURITY DEFINER affects table/RLS permissions, not
-- auth.role() - that still reflects the connecting session). But
-- protect_team_member_fields (0017_security_hardening.sql) unconditionally
-- reverts `role` back to its old value for anyone who isn't staff/service-role
-- - which is every participant, including one calling transfer_team_lead()
-- legitimately. As written, leadership transfer silently no-ops: the RPC
-- returns success (no exception raised - the trigger just resets the column)
-- but the role never actually changes. Fix: transfer_team_lead() sets a
-- transaction-local flag proving the write came from this vetted, narrow
-- path (which already re-verified caller-is-lead and target-is-teammate
-- itself) - protect_team_member_fields steps aside for that one flag, but
-- protect_team_member_role_lock (added above, in this same migration) still
-- applies its own team_lock_at/registration_close_at timing check
-- independently, so transfer still correctly freezes once locked.
-- =============================================================================
create or replace function public.protect_team_member_fields()
returns trigger
language plpgsql
as $$
begin
  if public.is_service_role() or public.is_event_admin(new.event_id) then
    return new;
  end if;

  if new.role is distinct from old.role
     and coalesce(current_setting('app.bypass_role_protection', true), 'false') <> 'true' then
    new.role := old.role;
  end if;
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

create or replace function public.transfer_team_lead(p_team_id uuid, p_new_lead_member_id uuid)
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

  -- Transaction-local only (the third `true` argument) - never leaks to
  -- other statements/connections, and protect_team_member_role_lock still
  -- runs and can still reject this same UPDATE on timing grounds.
  perform set_config('app.bypass_role_protection', 'true', true);

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
