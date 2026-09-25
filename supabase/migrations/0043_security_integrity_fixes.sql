-- 0042_security_integrity_fixes.sql
-- Forward-only fixes for the 2026-09-23 audit (see docs/SECURITY-FIXES-2026-09.md
-- for the finding-by-finding mapping). Every change here is additive or
-- replaces a policy/function/view in place - no existing row is modified.
--
-- DEPLOYMENT: apply this migration immediately BEFORE deploying the matching
-- application code. The new code depends on the RPCs/views created here, and
-- the previous code reads tables this migration locks down (e.g. anonymous
-- reads of final_scores), so the two must ship together.

-- =============================================================================
-- Helpers
-- =============================================================================

-- Safe text -> uuid cast for storage-path parsing: returns NULL instead of
-- raising on malformed input, so a policy evaluates to "deny" rather than
-- erroring.
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function public.try_uuid(text) to anon, authenticated, service_role;

-- True only for the Data API client roles. Trusted paths (service role,
-- migrations, SECURITY DEFINER functions owned by postgres, Supabase Auth's
-- own connection) are never blocked by the column guards below.
create or replace function public.is_client_role()
returns boolean
language sql
stable
as $$
  select current_user in ('anon', 'authenticated') and not public.is_service_role();
$$;

-- =============================================================================
-- BUG-002: profiles.email / profiles.id are identity keys used by server-side
-- provisioning. A user must never be able to rewrite them through the
-- profiles_update_self policy. Raise (not silently revert) so a direct write
-- fails loudly instead of reporting success.
-- =============================================================================
create or replace function public.protect_profile_identity_fields()
returns trigger
language plpgsql
as $$
begin
  if public.is_client_role() then
    if new.email is distinct from old.email or new.id is distinct from old.id then
      raise exception 'Profile email and id can only be changed through Supabase Auth.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_identity_fields on public.profiles;
create trigger protect_profile_identity_fields
  before update on public.profiles
  for each row execute function public.protect_profile_identity_fields();

-- Keep profiles.email in step with the verified Auth email (e.g. after a
-- confirmed email change), so server code that reads profiles.email never
-- drifts from the real identity.
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email_from_auth();

-- =============================================================================
-- BUG-002 / BUG-010: stop linking team_members rows to ANY newly created
-- profile purely because the emails match. A profile can be created before
-- mailbox ownership is proven (e.g. an unconfirmed sign-up, if public sign-up
-- is ever enabled on the project). Linking now happens only in trusted server
-- code: right after the server itself creates the invited account, or after a
-- successful sign-in whose Auth email is confirmed.
-- =============================================================================
drop trigger if exists on_profile_created_link_member on public.profiles;
drop function if exists public.link_verified_member();

-- =============================================================================
-- BUG-009: anonymous email enumeration. Unused by the application.
-- =============================================================================
revoke all on function public.is_login_eligible(text) from public, anon, authenticated;
drop function if exists public.is_login_eligible(text);

-- =============================================================================
-- BUG-007 / BUG-014: scores. Base tables become staff-only. Participants and
-- the public read through views that (a) never expose judge identity,
-- (b) mask comments unless feedback is explicitly visible, and (c) exclude
-- disqualified teams from public rankings. Views run as their owner
-- (security definer semantics) with security_barrier, so their WHERE clause
-- is the only row filter and cannot be bypassed via predicate pushdown.
-- =============================================================================
drop policy if exists final_scores_select on public.final_scores;
create policy final_scores_select on public.final_scores for select
  using (public.is_event_staff(public.round_event_id(round_id)));

drop view if exists public.final_scores_participant_visible;
create view public.final_scores_participant_visible
  with (security_barrier = true)
  as
  select
    s.id,
    s.round_id,
    s.team_id,
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
  from public.final_scores s
  where public.is_team_member_of(s.team_id)
    and public.is_scope_published(s.round_id, 'participant');

revoke all on public.final_scores_participant_visible from anon;
grant select on public.final_scores_participant_visible to authenticated;

-- Aggregated per team so the public never sees individual judge rows.
create view public.public_round_scores
  with (security_barrier = true)
  as
  select
    s.round_id,
    s.team_id,
    avg(s.score)::numeric as average_score,
    count(*)::int as judge_count
  from public.final_scores s
  join public.teams t on t.id = s.team_id
  where public.is_scope_published(s.round_id, 'public')
    and t.status <> 'disqualified'
  group by s.round_id, s.team_id;

grant select on public.public_round_scores to anon, authenticated;

create or replace view public.public_scoreboard_teams
  with (security_barrier = true)
  as
  select t.id, t.team_name, t.reference_id
  from public.teams t
  where t.status <> 'disqualified'
    and exists (
      select 1 from public.final_scores fs
      where fs.team_id = t.id and public.is_scope_published(fs.round_id, 'public')
    );

grant select on public.public_scoreboard_teams to anon, authenticated;

-- Legacy per-criterion scores table (no longer written by the app): same rule.
drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores for select
  using (public.is_event_staff(public.round_event_id(round_id)));

drop view if exists public.scores_participant_visible;
create view public.scores_participant_visible
  with (security_barrier = true)
  as
  select
    s.id,
    s.round_id,
    s.team_id,
    s.criterion_id,
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
  from public.scores s
  where public.is_team_member_of(s.team_id)
    and public.is_scope_published(s.round_id, 'participant');

revoke all on public.scores_participant_visible from anon;
grant select on public.scores_participant_visible to authenticated;

-- qualification_status: disqualified teams are not ranked publicly either.
drop policy if exists qualification_status_select on public.qualification_status;
create policy qualification_status_select on public.qualification_status for select
  using (
    public.is_event_staff(public.round_event_id(round_id))
    or (public.is_team_member_of(team_id) and public.is_scope_published(round_id, 'participant'))
    or (
      public.is_scope_published(round_id, 'public')
      and exists (select 1 from public.teams t where t.id = team_id and t.status <> 'disqualified')
    )
  );

-- =============================================================================
-- BUG-016 / BUG-019: team roster privacy. Full team_members rows (DOB,
-- gender, mobile, WhatsApp, roll number, email) are visible only to the
-- participant themselves and event staff. Teammates read team_roster, which
-- exposes display fields only (email only to the member themselves and the
-- team lead). Lead-driven membership changes go through the SECURITY DEFINER
-- RPCs below, which authorize the caller and lock the team row.
-- =============================================================================
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select
  using (public.is_event_staff(event_id) or profile_id = auth.uid());

drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members for insert
  with check (public.is_event_admin(event_id) and event_id = public.team_event_id(team_id));

drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members for update
  using (public.is_event_admin(event_id) or profile_id = auth.uid())
  with check (
    (public.is_event_admin(event_id) or profile_id = auth.uid())
    and event_id = public.team_event_id(team_id)
  );

drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members for delete
  using (public.is_event_admin(event_id));

create view public.team_roster
  with (security_barrier = true)
  as
  select
    tm.id,
    tm.team_id,
    tm.event_id,
    tm.role,
    tm.full_name,
    tm.college,
    tm.education_level,
    tm.reference_id,
    tm.verification_status,
    (tm.profile_id is not null) as has_account,
    (tm.profile_id = auth.uid()) as is_self,
    case when tm.profile_id = auth.uid() or public.is_team_lead(tm.team_id) then tm.email end as email,
    tm.created_at
  from public.team_members tm
  where public.is_team_member_of(tm.team_id) or public.is_event_staff(tm.event_id);

revoke all on public.team_roster from anon;
grant select on public.team_roster to authenticated;

-- Shared guard used by the lead RPCs: raises unless team changes are allowed.
create or replace function public.assert_team_changes_allowed(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ev record;
begin
  select team_lock_at, registration_close_at into ev from public.events where id = p_event_id;
  if ev.team_lock_at is not null and now() > ev.team_lock_at then
    raise exception 'Team changes are locked - the hackathon has started.' using errcode = '22023';
  end if;
  if ev.registration_close_at is not null and now() > ev.registration_close_at then
    raise exception 'Team changes are locked - the registration deadline has passed.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.assert_team_changes_allowed(uuid) from public, anon, authenticated;

create or replace function public.assert_caller_onboarded()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if coalesce((select must_change_password from public.profiles where id = auth.uid()), true) then
    raise exception 'Set your private password before continuing.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_caller_onboarded() from public, anon, authenticated;

-- Lead adds a member. Size limit is checked under a row lock on the team so
-- two concurrent adds cannot exceed team_size_max. Returns the new row id.
create or replace function public.lead_add_team_member(p_team_id uuid, p_member jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team record;
  v_max int;
  v_count int;
  v_id uuid;
  v_level text := coalesce(p_member->>'education_level', 'college');
begin
  perform public.assert_caller_onboarded();

  select id, event_id into v_team from public.teams where id = p_team_id for update;
  if v_team.id is null then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;
  if not public.is_team_lead(p_team_id) then
    raise exception 'Only the team lead can add members.' using errcode = '42501';
  end if;
  perform public.assert_team_changes_allowed(v_team.event_id);

  select team_size_max into v_max from public.events where id = v_team.event_id;
  select count(*) into v_count from public.team_members where team_id = p_team_id;
  if v_count >= coalesce(v_max, 4) then
    raise exception 'Your team already has the maximum of % members.', coalesce(v_max, 4) using errcode = '22023';
  end if;

  insert into public.team_members (
    event_id, team_id, role, full_name, date_of_birth, education_level, college,
    roll_number, class_grade, email, mobile, whatsapp, whatsapp_same_as_mobile, gender,
    consent_accepted, communication_consent_essential
  ) values (
    v_team.event_id, p_team_id, 'member',
    p_member->>'full_name',
    (p_member->>'date_of_birth')::date,
    v_level,
    p_member->>'college',
    case when v_level = 'college' then nullif(p_member->>'roll_number', '') end,
    case when v_level = 'school' then nullif(p_member->>'class_grade', '') end,
    lower(trim(p_member->>'email')),
    p_member->>'mobile',
    p_member->>'whatsapp',
    coalesce((p_member->>'whatsapp_same_as_mobile')::boolean, true),
    nullif(p_member->>'gender', ''),
    true,
    true
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.lead_add_team_member(uuid, jsonb) from public, anon;
grant execute on function public.lead_add_team_member(uuid, jsonb) to authenticated;

-- Lead removes a non-lead member. Raises (never silently no-ops) when the
-- caller is not the lead, the member is missing, is the lead, or removal
-- would drop below team_size_min. Returns the removed row id.
create or replace function public.lead_remove_team_member(p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_min int;
  v_count int;
begin
  perform public.assert_caller_onboarded();

  select id, team_id, event_id, role into v_member from public.team_members where id = p_member_id;
  if v_member.id is null then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;
  -- Lock the team so concurrent removals are serialized for the size check.
  perform 1 from public.teams where id = v_member.team_id for update;

  if not public.is_team_lead(v_member.team_id) then
    raise exception 'Only the team lead can remove members.' using errcode = '42501';
  end if;
  if v_member.role = 'lead' then
    raise exception 'The team lead cannot be removed. Transfer leadership first.' using errcode = '22023';
  end if;
  perform public.assert_team_changes_allowed(v_member.event_id);

  select team_size_min into v_min from public.events where id = v_member.event_id;
  select count(*) into v_count from public.team_members where team_id = v_member.team_id;
  if v_count <= coalesce(v_min, 1) then
    raise exception 'Your team must have at least % members.', coalesce(v_min, 1) using errcode = '22023';
  end if;

  delete from public.team_members where id = p_member_id;
  return p_member_id;
end;
$$;

revoke all on function public.lead_remove_team_member(uuid) from public, anon;
grant execute on function public.lead_remove_team_member(uuid) to authenticated;

-- =============================================================================
-- BUG-013: lead transfer. PostgreSQL checks the non-deferrable partial unique
-- index one_lead_per_team row by row, so flipping both rows in one UPDATE
-- fails whenever the new lead's row is visited first. Demote, then promote,
-- in two statements, under a lock on the team so concurrent transfers are
-- serialized. Also refuses a no-op/self transfer explicitly.
-- =============================================================================
create or replace function public.transfer_team_lead(p_team_id uuid, p_new_lead_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_target record;
begin
  if v_caller is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  perform 1 from public.teams where id = p_team_id for update;

  if not public.is_team_lead(p_team_id, v_caller) then
    raise exception 'Only the current team lead can transfer leadership.' using errcode = '42501';
  end if;

  select id, team_id, role into v_target from public.team_members where id = p_new_lead_member_id;
  if v_target.id is null or v_target.team_id <> p_team_id then
    raise exception 'That person is not a member of this team.' using errcode = '22023';
  end if;
  if v_target.role = 'lead' then
    raise exception 'That person is already the team lead.' using errcode = '22023';
  end if;

  perform set_config('app.bypass_role_protection', 'true', true);

  update public.team_members set role = 'member' where team_id = p_team_id and role = 'lead';
  update public.team_members set role = 'lead' where id = p_new_lead_member_id;

  perform set_config('app.bypass_role_protection', 'false', true);
end;
$$;

revoke all on function public.transfer_team_lead(uuid, uuid) from public, anon;
grant execute on function public.transfer_team_lead(uuid, uuid) to authenticated;

-- =============================================================================
-- BUG-006 / BUG-022: a scheduled notification must not be readable before it
-- is released. Release is time-based (scheduled_at <= now()) or explicit
-- (sent_at set), so in-app delivery happens exactly at the scheduled time
-- without depending on how often the dispatch cron runs.
-- =============================================================================
create or replace function public.notification_released(nid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.notifications n
    where n.id = nid
      and (n.sent_at is not null or (n.scheduled_at is not null and n.scheduled_at <= now()))
  );
$$;

grant execute on function public.notification_released(uuid) to authenticated;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (
    public.is_event_staff(event_id)
    or (
      public.is_notification_recipient(id)
      and (sent_at is not null or (scheduled_at is not null and scheduled_at <= now()))
    )
  );

drop policy if exists notification_recipients_select on public.notification_recipients;
create policy notification_recipients_select on public.notification_recipients for select
  using (
    (profile_id = auth.uid() and public.notification_released(notification_id))
    or public.is_event_staff(public.notification_event_id(notification_id))
  );

drop policy if exists notification_recipients_update_self on public.notification_recipients;
create policy notification_recipients_update_self on public.notification_recipients for update
  using (profile_id = auth.uid() and public.notification_released(notification_id))
  with check (profile_id = auth.uid());

-- =============================================================================
-- BUG-012: atomic, serialized policy publication.
-- =============================================================================
create or replace function public.publish_policy_version(
  p_event_id uuid,
  p_type text,
  p_version text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_version text := trim(coalesce(p_version, ''));
begin
  if not public.is_event_admin(p_event_id) then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if p_type not in ('privacy', 'terms', 'rules') then
    raise exception 'Unknown policy type.' using errcode = '22023';
  end if;
  if v_version = '' or length(v_version) > 60 then
    raise exception 'Enter a version label (up to 60 characters).' using errcode = '22023';
  end if;

  -- Serialize publications of the same policy type for the same event.
  perform pg_advisory_xact_lock(hashtextextended('policy_publish:' || p_event_id::text || ':' || p_type, 0));

  if exists (
    select 1 from public.policy_versions
    where event_id = p_event_id and type = p_type and version = v_version
  ) then
    raise exception 'That version label is already used.' using errcode = '23505';
  end if;

  update public.policy_versions
  set is_current = false
  where event_id = p_event_id and type = p_type and is_current;

  insert into public.policy_versions (event_id, type, version, content_markdown, is_current, published_at, created_by)
  values (p_event_id, p_type, v_version, coalesce(p_content, ''), true, now(), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.publish_policy_version(uuid, text, text, text) from public, anon;
grant execute on function public.publish_policy_version(uuid, text, text, text) to authenticated;

-- =============================================================================
-- BUG-018: organizer flag on request messages is derived, never client-set.
-- =============================================================================
create or replace function public.set_request_message_sender_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
begin
  if public.is_service_role() then
    return new;
  end if;
  select event_id into v_event from public.requests where id = new.request_id;
  new.is_admin := coalesce(public.is_event_staff(v_event), false);
  new.sender_profile_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_request_message_sender_role on public.request_messages;
create trigger set_request_message_sender_role
  before insert on public.request_messages
  for each row execute function public.set_request_message_sender_role();

-- Requests: only staff decide status, and the event must match the team.
create or replace function public.protect_request_fields()
returns trigger
language plpgsql
as $$
begin
  if public.is_service_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.event_id is distinct from public.team_event_id(new.team_id) then
      raise exception 'Request event does not match the team.' using errcode = '22023';
    end if;
    if not public.is_event_staff(new.event_id) then
      new.status := 'open';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_request_fields on public.requests;
create trigger protect_request_fields
  before insert on public.requests
  for each row execute function public.protect_request_fields();

-- =============================================================================
-- BUG-023: branding objects are writable only by admins of the event encoded
-- in the object path (<event_id>/...), or super admins. Reviewers excluded.
-- =============================================================================
drop policy if exists branding_admin_write on storage.objects;
drop policy if exists branding_admin_update on storage.objects;
drop policy if exists branding_admin_delete on storage.objects;

create policy branding_admin_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and public.is_event_admin(public.try_uuid((storage.foldername(name))[1]))
  );

create policy branding_admin_update on storage.objects for update to authenticated
  using (
    bucket_id = 'branding'
    and public.is_event_admin(public.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'branding'
    and public.is_event_admin(public.try_uuid((storage.foldername(name))[1]))
  );

create policy branding_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and public.is_event_admin(public.try_uuid((storage.foldername(name))[1]))
  );

-- =============================================================================
-- RISK-002: shared (cross-instance) rate limiting. Keys are hashed by the
-- application before they reach this table, so no raw emails/IPs are stored.
-- Service role only.
-- =============================================================================
create table if not exists public.rate_limit_events (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_bucket_created_idx on public.rate_limit_events (bucket, created_at);
create index if not exists rate_limit_events_created_idx on public.rate_limit_events (created_at);

alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;
revoke all on sequence public.rate_limit_events_id_seq from anon, authenticated;

create or replace function public.rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_oldest timestamptz;
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
begin
  perform pg_advisory_xact_lock(hashtextextended('rate_limit:' || p_bucket, 0));

  delete from public.rate_limit_events where bucket = p_bucket and created_at < now() - v_window;

  -- Opportunistic global cleanup so abandoned buckets don't accumulate.
  if random() < 0.01 then
    delete from public.rate_limit_events where created_at < now() - interval '1 day';
  end if;

  select count(*), min(created_at) into v_count, v_oldest
  from public.rate_limit_events where bucket = p_bucket;

  if v_count >= p_limit then
    return query select false, greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::int);
    return;
  end if;

  insert into public.rate_limit_events (bucket) values (p_bucket);
  return query select true, 0;
end;
$$;

revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- =============================================================================
-- RISK-003: revoke every session (and refresh token) of a user after an
-- administrative password reset/replacement. Supabase does not do this on an
-- admin password update. Server code that validates sessions via
-- auth.getUser() rejects the user immediately afterwards; an already-issued
-- access JWT remains cryptographically valid for direct Data API calls until
-- it expires (default 1 hour).
-- =============================================================================
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_deleted int;
begin
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- =============================================================================
-- BUG-002: server-side identity lookups use the verified Auth email, never
-- the (formerly client-writable) profiles.email column. Service role only.
-- =============================================================================
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- =============================================================================
-- Views are read-only for the API roles (see 0042). The views created above
-- run with their owner's privileges and several are automatically updatable
-- (e.g. final_scores_participant_visible, team_roster), so a write privilege
-- inherited from default privileges would let a participant change scores
-- or teammates' rows through them. Revoke every write on every public view.
-- Keep this block LAST in any migration that creates a view.
-- =============================================================================
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from public, anon, authenticated', r.relname);
  end loop;
end;
$$;
