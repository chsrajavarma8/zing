-- 0019_content_auth_model_update.sql
-- The privacy policy and FAQ (seeded in 0013_default_event.sql) still
-- describe the original email-OTP/magic-link authentication model. That
-- model was replaced earlier this project with password authentication
-- (deterministic temporary password at registration, mandatory private
-- password change, organizer-assisted recovery, no participant email at
-- any point) - the published policy text and FAQ answer were never updated
-- to match, so they currently describe a login flow that no longer exists.
-- This is a plain UPDATE (0013 used INSERT ... ON CONFLICT DO NOTHING, so a
-- second insert would never touch these already-existing rows).

update public.policy_versions
set content_markdown = replace(
  content_markdown,
  'Email is used for sign-in codes and essential event updates. WhatsApp updates, where configured, use an approved organizer channel. Promotional communications are sent only with separate, optional consent.',
  'Email is used for essential event updates and, where configured, WhatsApp updates through an approved organizer channel. No sign-in code or password-setup link is ever emailed: each participant signs in with a temporary password generated from their own registration details (team name, name, and date of birth) and is required to set a private password the first time they sign in. Promotional communications are sent only with separate, optional consent.'
)
where type = 'privacy' and version = 'draft-1'
  and content_markdown like '%Email is used for sign-in codes%';

update public.policy_versions
set content_markdown = replace(
  content_markdown,
  '## Authorized access and security

Access to participant data is restricted by role-based permissions and Row Level Security. Only authorized organizers, reviewers, and the participant themselves can access registration details.',
  '## Authentication and account security

Passwords are created and verified through Supabase Auth only, and are never stored in our own database tables, logs, or analytics. Administrator accounts are provisioned separately through a verified email invitation and never share the participant password mechanism.

## Organizer-assisted account recovery

There is no self-service "forgot password" email for participants. If a participant needs help regaining access, an organizer verifies their identity through additional details on file (not date of birth or team name alone) before resetting access.

## Authorized access and security

Access to participant data is restricted by role-based permissions and Row Level Security. Only authorized organizers, reviewers, and the participant themselves can access registration details.'
)
where type = 'privacy' and version = 'draft-1'
  and content_markdown like '%Only authorized organizers, reviewers, and the participant themselves can access registration details.%'
  and content_markdown not like '%Organizer-assisted account recovery%';

update public.policy_versions
set content_markdown = replace(
  content_markdown,
  'This platform uses essential cookies to maintain your signed-in session. No advertising or tracking cookies are used.',
  'This platform uses essential cookies to maintain your signed-in session - these cannot be disabled and no consent banner is shown for them, since they are strictly necessary for sign-in to function. No advertising or tracking cookies are currently used. If privacy-conscious analytics is enabled in the future, this policy and the site''s cookie controls will be updated first, and it will never collect names, emails, dates of birth, phone numbers, passwords, recovery tokens, or Drive URLs.'
)
where type = 'privacy' and version = 'draft-1'
  and content_markdown like '%No advertising or tracking cookies are used.%';

update public.faqs
set answer = 'Sign in with your registered email and password. First-time participants use a temporary password generated from their team name, their own name, and date of birth (shown on the sign-in page) and must set a private password on first sign-in. There is no email verification step.'
where question = 'How do I sign in?'
  and answer = 'Use the email address provided during registration and complete email verification.';

insert into public.faqs (event_id, question, answer, order_index, published)
select e.id,
  'Do I need to change my password after registering?',
  'Yes. The temporary password generated at registration must be changed to a private password the first time you sign in, before you can access your dashboard. No one else, including your team lead, can see or set this password for you.',
  10,
  true
from public.events e
where e.slug = 'default'
  and not exists (
    select 1 from public.faqs existing
    where existing.event_id = e.id and existing.question = 'Do I need to change my password after registering?'
  );
