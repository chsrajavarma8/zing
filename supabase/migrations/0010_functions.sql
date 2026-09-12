-- 0010_functions.sql
-- Security-definer helper functions used throughout RLS policies.
-- These run with elevated privilege internally but only ever return booleans/ids,
-- so they cannot be used to exfiltrate data - safe to call from policies.

create function public.is_super_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.platform_roles where user_id = uid and role = 'super_admin');
$$;

create function public.is_event_admin(eid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin(uid) or exists (
    select 1 from public.event_admins
    where event_id = eid and user_id = uid and role = 'event_admin'
  );
$$;

create function public.is_reviewer(eid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.event_admins
    where event_id = eid and user_id = uid and role = 'reviewer'
  );
$$;

-- "staff" = anyone with elevated read access to an event: admin, reviewer, or super admin.
create function public.is_event_staff(eid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(eid, uid) or public.is_reviewer(eid, uid);
$$;

create function public.is_any_staff(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin(uid) or exists (select 1 from public.event_admins where user_id = uid);
$$;

create function public.is_team_lead(tid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid and profile_id = uid and role = 'lead'
  );
$$;

create function public.is_team_member_of(tid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid and profile_id = uid
  );
$$;

create function public.team_event_id(tid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select event_id from public.teams where id = tid;
$$;

create function public.round_event_id(rid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select event_id from public.rounds where id = rid;
$$;

create function public.is_scope_published(rid uuid, scope_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_published from public.publications
    where round_id = rid and scope = scope_name), false);
$$;

-- ---------------------------------------------------------------------------
-- Registration statistics: real counts, kept distinct from the configured base.
-- displayedCommunityCount = events.community_base_count + actual participant_count.
-- ---------------------------------------------------------------------------
create function public.event_registration_stats(eid uuid)
returns table (
  participant_count bigint,
  team_count bigint,
  community_base_count int,
  displayed_community_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*) from public.team_members where event_id = eid) as participant_count,
    (select count(*) from public.teams where event_id = eid) as team_count,
    (select e.community_base_count from public.events e where e.id = eid) as community_base_count,
    (select e.community_base_count from public.events e where e.id = eid)
      + (select count(*) from public.team_members where event_id = eid) as displayed_community_count;
$$;

grant execute on function public.event_registration_stats(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ID card QR verification: returns only minimal, non-sensitive fields.
-- Never exposes date of birth, email, mobile, or WhatsApp.
-- ---------------------------------------------------------------------------
create function public.verify_id_card(token uuid)
returns table (
  full_name text,
  team_name text,
  event_name text,
  role text,
  reference_id text,
  valid boolean
)
language sql stable security definer set search_path = public
as $$
  select
    tm.full_name,
    t.team_name,
    e.name as event_name,
    tm.role,
    tm.reference_id,
    (not ic.revoked) as valid
  from public.id_cards ic
  join public.team_members tm on tm.id = ic.team_member_id
  join public.teams t on t.id = tm.team_id
  join public.events e on e.id = t.event_id
  where ic.qr_token = token;
$$;

grant execute on function public.verify_id_card(uuid) to anon, authenticated;
