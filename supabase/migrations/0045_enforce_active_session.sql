-- 0045_enforce_active_session.sql
-- RISK-003: revoking a user's sessions (revoke_user_sessions, 0043) stops
-- refresh and makes auth.getUser() fail, but an ACCESS TOKEN that was already
-- issued stays cryptographically valid until it expires (default 3600 s).
-- Verified locally: after revocation, the old access token still read the
-- user's team_members row (email, date of birth) through the Data API, and
-- still authenticated against Storage.
--
-- Control: every authenticated Data API request must carry a JWT whose
-- session_id still exists (and hasn't passed not_after) in auth.sessions.
-- Implemented with PostgREST's supported pre-request hook, so it applies to
-- every table/view/RPC request without touching each policy, plus the same
-- check on the only client-writable Storage policies (branding).
--
-- Not covered: Realtime (not used by this app). Anonymous and service-role
-- requests carry no session and are unaffected.
--
-- ROLLBACK (if the hook must be disabled):
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';

create or replace function public.session_is_active()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_sid uuid;
begin
  if v_claims->>'role' is distinct from 'authenticated' then
    return true;
  end if;
  begin
    v_sid := (v_claims->>'session_id')::uuid;
  exception when others then
    return false;
  end;
  if v_sid is null then
    -- A user token without a session id can't be revoked or checked.
    return false;
  end if;
  return exists (
    select 1 from auth.sessions s
    where s.id = v_sid and (s.not_after is null or s.not_after > now())
  );
end;
$$;

grant execute on function public.session_is_active() to anon, authenticated, service_role;

create or replace function public.enforce_active_session()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.session_is_active() then
    raise sqlstate 'PT401' using message = 'Your session has ended. Please sign in again.';
  end if;
end;
$$;

grant execute on function public.enforce_active_session() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.enforce_active_session';
notify pgrst, 'reload config';

-- Storage: the branding write policies (0043) additionally require a live session.
drop policy if exists branding_admin_write on storage.objects;
drop policy if exists branding_admin_update on storage.objects;
drop policy if exists branding_admin_delete on storage.objects;

create policy branding_admin_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and public.session_is_active()
    and public.is_event_admin(public.try_uuid((storage.foldername(name))[1]))
  );

create policy branding_admin_update on storage.objects for update to authenticated
  using (
    bucket_id = 'branding'
    and public.session_is_active()
    and public.is_event_admin(public.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'branding'
    and public.session_is_active()
    and public.is_event_admin(public.try_uuid((storage.foldername(name))[1]))
  );

create policy branding_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and public.session_is_active()
    and public.is_event_admin(public.try_uuid((storage.foldername(name))[1]))
  );
