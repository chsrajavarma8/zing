-- 0032_requests_resolve_delete.sql
-- Req: resolving a participant request now deletes it outright (list +
-- database) instead of just flipping its status - see resolveRequest()
-- in src/app/admin/requests/actions.ts. No delete policy existed on
-- `requests` before this, so RLS silently denied every delete attempt
-- (default-deny) even for staff. request_messages cascades automatically
-- (on delete cascade, 0008_requests_feedback.sql).

create policy requests_delete on public.requests for delete
  using (public.is_event_staff(event_id));
