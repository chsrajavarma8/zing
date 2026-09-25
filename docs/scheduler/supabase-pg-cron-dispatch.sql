-- OPTIONAL scheduler for /api/cron/dispatch-notifications every 5 minutes,
-- independent of the Vercel plan (Vercel Hobby only allows daily cron jobs;
-- Pro allows "*/5 * * * *" directly in vercel.json).
--
-- Not a migration: it needs the production URL and CRON_SECRET, which must
-- not be committed. Run once in the Supabase SQL editor AFTER deploying, with
-- the two placeholders replaced. Requires the pg_cron and pg_net extensions
-- (Database -> Extensions in the dashboard).
--
-- What depends on this schedule: scheduled EMAIL-channel delivery and the
-- sent_at bookkeeping. In-app visibility does not: the database releases a
-- scheduled notification at scheduled_at, and open portal pages pick it up
-- within about a minute (NotificationsAutoRefresh).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the secret in Vault, never inline in the job definition.
select vault.create_secret('<CRON_SECRET value>', 'dispatch_notifications_cron_secret');

select cron.schedule(
  'dispatch-notifications',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://<production-origin>/api/cron/dispatch-notifications',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_notifications_cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- Check runs:   select * from cron.job_run_details order by start_time desc limit 10;
-- Remove job:   select cron.unschedule('dispatch-notifications');
