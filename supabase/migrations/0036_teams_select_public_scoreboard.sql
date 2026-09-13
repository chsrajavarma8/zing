-- 0036_teams_select_public_scoreboard.sql
-- Public scoreboard "Unknown" team name bug: the scoreboard page
-- (src/app/(public)/scoreboard/page.tsx) reads final_scores with an
-- embedded teams(team_name, reference_id) relationship. final_scores_select
-- (0026_final_scores.sql) already lets an anonymous visitor see a score row
-- once its round's 'public' scope is published, but the embedded join is a
-- SEPARATE read of the teams table, governed by teams_select's own RLS -
-- which had no public-when-published clause at all, only staff/team-member.
-- PostgREST's relationship embedding silently returns null for a joined row
-- RLS hides rather than erroring, so every published score's team_name
-- resolved to the "Unknown" fallback regardless of publication state.
--
-- Fixed with a narrow view instead of broadening teams_select itself -
-- widening that policy would hand anonymous visitors the WHOLE teams row
-- (status, organizer-defined extra_fields) for any team with a public
-- score, not just the two fields the leaderboard actually needs. Does not
-- touch team_members (participant PII: email, mobile, DOB, roll number) at
-- all.
--
-- Deliberately WITHOUT security_invoker (unlike scores_participant_visible /
-- final_scores_participant_visible, 0017/0026): those views only mask one
-- column and rely on the caller already passing the base table's own RLS.
-- Here the whole point is to grant a row anon does NOT pass teams_select
-- for - the view must run as its (superuser) owner, bypassing RLS on the
-- underlying teams/final_scores reads, with the WHERE/EXISTS clause below
-- as the only filter standing in for that policy.
create view public.public_scoreboard_teams
  as
  select t.id, t.team_name, t.reference_id
  from public.teams t
  where exists (
    select 1 from public.final_scores fs
    where fs.team_id = t.id and public.is_scope_published(fs.round_id, 'public')
  );

grant select on public.public_scoreboard_teams to authenticated, anon;
