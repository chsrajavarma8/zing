-- 0041_faq_team_size_agreement.sql
-- Req.: "Registration specifies team size, while the FAQ gives a vague
-- response. Make the information agree." Team size (3-4, including the
-- lead) is organizer-confirmed and already shown live on /register and in
-- the portal; only the registration fee and exact dates remain genuinely
-- unconfirmed (see 0013's "Registration fees... have not yet been
-- confirmed" and the null registration_open_at/close_at on the default
-- event) - so this splits the one vague FAQ into a concrete team-size
-- answer plus a separate answer that stays honest about what's still
-- pending, rather than inventing a fee or dates.
update public.faqs
set question = 'What is the team size?',
    answer = 'Each team has 3-4 members, including the team lead. This is shown on the registration page and can''t be changed once you''ve submitted your team.'
where question = 'What are the dates, team sizes, and registration fees?'
  and answer = 'Refer to the latest event details. Information that has not been confirmed will be marked as awaiting announcement.';

insert into public.faqs (event_id, question, answer, order_index, published)
select e.id,
  'Are there registration fees, and what are the exact dates?',
  'Registration fees, if any, and the exact event dates have not been confirmed yet by the organizers. Check the Schedule page and your dashboard for updates once these are published.',
  9,
  true
from public.events e
where e.slug = 'default'
  and not exists (
    select 1 from public.faqs existing
    where existing.event_id = e.id and existing.question = 'Are there registration fees, and what are the exact dates?'
  );
