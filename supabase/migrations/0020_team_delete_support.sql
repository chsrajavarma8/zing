-- 0020_team_delete_support.sql
-- Admin panel needs a "Delete team" action (registrations). Every other
-- team_id foreign key already cascades on delete (team_members,
-- submissions, scores, qualification_status, requests) except
-- feedback.team_id, which has no ON DELETE behavior at all (defaults to
-- NO ACTION) - deleting a team with any feedback response would fail with
-- a foreign-key violation. feedback.team_id is already nullable (unlike
-- the cascading ones, which are all NOT NULL), signaling the original
-- intent was "feedback can exist without a team" - so SET NULL (keep the
-- feedback response as organizer analytics data, just detach it from the
-- deleted team) is the right behavior here, not CASCADE (which would
-- destroy feedback data just because a registration was removed).

alter table public.feedback
  drop constraint feedback_team_id_fkey,
  add constraint feedback_team_id_fkey
    foreign key (team_id) references public.teams(id) on delete set null;
