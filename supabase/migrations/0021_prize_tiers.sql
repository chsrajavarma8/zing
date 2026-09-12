-- 0021_prize_tiers.sql
-- Total prize pool confirmed as ₹4,00,000, broken down as 1st ₹2,00,000 /
-- 2nd ₹1,50,000 / 3rd ₹50,000. Updates the event record and the previously
-- "to be announced" terms/FAQ text now that the breakdown is confirmed, and
-- adds a structured, admin-editable prize_tiers content block (same
-- editable pattern as hero/about/eligibility).

update public.events
set prize_pool_label = '₹4 Lakhs'
where slug = 'default' and prize_pool_label in ('₹2 Lakhs', '₹4 Lakhs');

insert into public.content_blocks (event_id, key, content)
select e.id, 'prize_tiers', jsonb_build_object(
  'tier1_label', '1st Place',
  'tier1_amount', '₹2,00,000',
  'tier2_label', '2nd Place',
  'tier2_amount', '₹1,50,000',
  'tier3_label', '3rd Place',
  'tier3_amount', '₹50,000'
)
from public.events e
where e.slug = 'default'
on conflict (event_id, key) do nothing;

update public.policy_versions
set content_markdown = replace(
  content_markdown,
  'The confirmed total prize pool is Rs. 2,00,000. Award categories, distribution, and any additional conditions will be published separately once confirmed.',
  'The confirmed total prize pool is Rs. 4,00,000, awarded as: 1st place Rs. 2,00,000, 2nd place Rs. 1,50,000, and 3rd place Rs. 50,000. Additional award categories and conditions, if any, will be published separately.'
)
where type = 'terms' and version = 'draft-1'
  and content_markdown like '%confirmed total prize pool is Rs. 2,00,000%';

update public.faqs
set answer = 'The total prize pool is Rs. 4,00,000: 1st place Rs. 2,00,000, 2nd place Rs. 1,50,000, and 3rd place Rs. 50,000.'
where question = 'What is the total prize pool?'
  and answer = 'The total prize pool is Rs. 2,00,000. Award distribution will be published separately.';
