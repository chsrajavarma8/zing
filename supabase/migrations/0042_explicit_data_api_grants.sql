-- 0042_explicit_data_api_grants.sql
-- Supabase no longer auto-grants table privileges to the Data API roles
-- (anon, authenticated, service_role) for tables created by migrations - the
-- new default gives them only TRUNCATE/REFERENCES/TRIGGER/MAINTAIN. Verified
-- on a fresh `supabase start` (CLI 2.114): every query from the app,
-- including the service-role client, failed with "permission denied for
-- table events". Projects created before that default change (such as the
-- current hosted project) already have these grants, so on them the GRANTs
-- below are no-ops; on any fresh install they are required.
--
-- Scope: BASE TABLES ONLY. Row Level Security (enabled on every public table)
-- remains the row-level boundary.
--
-- VIEWS ARE READ-ONLY for the API roles. Several views here deliberately run
-- with their owner's privileges (they are the narrow, filtered way the public
-- and participants read otherwise-protected tables), and PostgreSQL makes
-- simple views automatically updatable - so a write granted on such a view
-- writes to the base table WITHOUT RLS. Verified locally: with the legacy
-- default grants, an anonymous client could rename (and delete) teams through
-- public_scoreboard_teams. Every write privilege on every view is revoked.

grant usage on schema public to anon, authenticated, service_role;

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  loop
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', r.relname);
    execute format('grant all on public.%I to service_role', r.relname);
  end loop;

  for r in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from public, anon, authenticated', r.relname);
  end loop;
end;
$$;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;
