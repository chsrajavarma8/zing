-- 0031_privacy_policy_gender.sql
-- Req: the participant profile now collects an optional gender field (a
-- fixed Male/Female/Prefer not to say dropdown - src/lib/gender.ts). Update
-- the seeded Privacy Policy's "Information collected" section to disclose
-- it and note it is kept private, matching the pattern of prior seeded-copy
-- fixes (0019/0021/0029: plain UPDATE, since 0013 used INSERT ... ON
-- CONFLICT DO NOTHING and will never re-touch already-seeded rows).

update public.policy_versions
set content_markdown = replace(
  content_markdown,
  'At registration, we collect each participant''s full name, date of birth, college or institution, college roll number, email address, mobile number, WhatsApp number, team role, and team name.',
  'At registration, we collect each participant''s full name, date of birth, college or institution, college roll number, email address, mobile number, WhatsApp number, team role, and team name. Gender is collected only if the organizers enable that field, is always optional to answer, and is kept private - visible only to the participant themselves and event organizers, and never published or shown to other participants.'
)
where type = 'privacy'
  and content_markdown like '%At registration, we collect each participant''s full name, date of birth, college or institution, college roll number, email address, mobile number, WhatsApp number, team role, and team name.%';
