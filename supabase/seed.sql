-- seed.sql
-- DEVELOPMENT DEMO DATA ONLY. This file is applied by `supabase db reset` for
-- local development and is NEVER applied to a remote/production database by
-- `supabase db push` (which only runs files in supabase/migrations). Do not
-- copy this data into a migration.
--
-- Adds a handful of clearly-fake teams/participants under the default event
-- so the participant portal and admin panel have something to click through
-- locally. Every name/email is obviously synthetic.

do $$
declare
  v_event_id uuid;
  v_team_id uuid;
begin
  select id into v_event_id from public.events where slug = 'default';
  if v_event_id is null then
    raise notice 'No default event found - run migrations first.';
    return;
  end if;

  -- Ensure the default event is published locally so registration/portal pages work.
  update public.events set status = 'published',
    registration_open_at = now() - interval '7 days',
    registration_close_at = now() + interval '30 days',
    start_date = current_date + 14,
    end_date = current_date + 16
  where id = v_event_id;

  insert into public.teams (event_id, team_name, status)
  values (v_event_id, '[DEV DEMO] Nullpointers', 'verified')
  returning id into v_team_id;

  insert into public.team_members (
    event_id, team_id, role, full_name, date_of_birth, college, roll_number,
    email, mobile, whatsapp, whatsapp_same_as_mobile, consent_accepted,
    communication_consent_essential
  ) values
    (v_event_id, v_team_id, 'lead', '[DEV DEMO] Asha Rao', '2003-05-14', 'Demo Institute of Technology', 'DIT001',
      'dev-demo-lead@example.test', '+910000000001', '+910000000001', true, true, true),
    (v_event_id, v_team_id, 'member', '[DEV DEMO] Kabir Singh', '2003-08-02', 'Demo Institute of Technology', 'DIT002',
      'dev-demo-member@example.test', '+910000000002', '+910000000002', true, true, true);

  insert into public.faqs (event_id, question, answer, order_index, published)
  values (v_event_id, '[DEV DEMO] Is this real data?', 'No - everything prefixed [DEV DEMO] is local seed data only.', 0, true);

  insert into public.announcements (event_id, title, body, published_at)
  values (v_event_id, '[DEV DEMO] Welcome', 'This is seed data for local development.', now());
end $$;
