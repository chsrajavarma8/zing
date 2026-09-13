-- 0037_fix_notification_rls_recursion.sql
-- CRITICAL fix: notifications_select and notification_recipients_select
-- (0011_rls.sql) each contain an EXISTS subquery against the OTHER table -
-- notifications_select checks notification_recipients, and
-- notification_recipients_select checks notifications. Evaluating either
-- policy re-triggers RLS on the other table, which re-triggers the first
-- again, and Postgres correctly detects this as infinite recursion
-- (error 42P17) rather than looping forever.
--
-- This was never hit by a plain `.from("notifications")` or
-- `.from("notification_recipients")` query alone, only by the embedded-join
-- shape the portal notifications page and layout unread-count actually use
-- (`notification_recipients.select("..., notifications(...)")`), which asks
-- Postgres to apply both tables' policies together for the same rows. The
-- query fails outright with 42P17, the Supabase client returns `data: null`
-- with the error attached, and every call site in this codebase reads that
-- as "no notifications" without checking `error` - so a notification an
-- admin sent, with correct recipient rows already in the database, silently
-- never appeared for anyone. This is the root cause of the reported
-- "notifications don't reach team leads/members" bug - confirmed live
-- (register a throwaway team, insert a notification + recipient row exactly
-- as sendNotification() does, then query as that recipient: 42P17).
--
-- Fixed the same way every other cross-table RLS check in this codebase
-- avoids this class of bug: a SECURITY DEFINER helper's internal query runs
-- as the function's owner, not the calling role, so it does not re-trigger
-- RLS on the table it reads - breaking the cycle without weakening who can
-- see what (see is_event_staff, is_team_lead, is_scope_published, etc.).
create function public.is_notification_recipient(nid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.notification_recipients where notification_id = nid and profile_id = uid
  );
$$;

create function public.notification_event_id(nid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select event_id from public.notifications where id = nid;
$$;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (
    public.is_event_staff(event_id)
    or public.is_notification_recipient(id)
  );

drop policy if exists notification_recipients_select on public.notification_recipients;
create policy notification_recipients_select on public.notification_recipients for select
  using (
    profile_id = auth.uid()
    or public.is_event_staff(public.notification_event_id(notification_id))
  );
