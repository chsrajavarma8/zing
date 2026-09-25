-- HOTFIX (safe to apply on its own, before the full September 2026 release).
-- Removes write privileges that the API roles may hold on public views.
-- public_scoreboard_teams (migration 0036) runs with its owner's privileges
-- and is automatically updatable, so with Supabase's legacy default grants
-- an anonymous client can rename or delete teams through it. The application
-- only ever SELECTs from views, so this does not affect current behavior.
-- Idempotent. Apply in the Supabase SQL editor; migrations 0042/0043 repeat it.
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

-- Verification (should return no rows):
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (select table_name from information_schema.views where table_schema = 'public')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
