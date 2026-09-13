-- 0038_final_scores_delete.sql
-- No delete policy existed on final_scores at all (0026_final_scores.sql) -
-- RLS defaults to deny, so nobody, not even an event admin, could remove a
-- mistakenly-entered score through the app. Admin-only, mirroring every
-- other admin-write policy on this table (final_scores_insert/_update).
-- final_score_audit rows for the deleted score cascade automatically (its
-- own FK, unrelated scores/teams/submissions/other rounds are untouched).
create policy final_scores_delete on public.final_scores for delete
  using (public.is_event_admin(public.round_event_id(round_id)));
