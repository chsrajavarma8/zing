-- 0033_team_members_select_full_roster.sql
-- CRITICAL fix: team_members_select (0011_rls.sql) let a viewer see a row
-- only if it was their own, or if they were the LEAD of that team - an
-- ordinary member could never see any teammate's row, including the lead's.
-- getPortalContext() (src/lib/portal/data.ts) queries teammates by team_id
-- expecting the full roster back for everyone on the team; RLS silently
-- filtered that down to "just me" for non-leads, which is exactly the
-- reported symptom (two members of the same team seeing different rosters).
--
-- teams_select (same file, line ~114) already uses is_team_member_of(id) for
-- the equivalent "can this person see their own team" check - this brings
-- team_members_select in line with that established pattern instead of the
-- lead-only check it had. is_team_member_of() already covers "this is my own
-- row" (it matches on profile_id = uid), so the separate profile_id clause
-- and the lead-only clause both collapse into this one call.
drop policy if exists team_members_select on public.team_members;

create policy team_members_select on public.team_members for select
  using (
    public.is_event_staff(event_id)
    or public.is_team_member_of(team_id)
  );
