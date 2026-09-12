-- 0013_default_event.sql
-- Baseline configuration data: the real Zing Hackathon / Skillglider event
-- record (name, organizer, contact, prize pool are official/confirmed), with
-- dates, team-size limits, and prize distribution deliberately left unset
-- until the organizer confirms them via the admin panel. Contains no
-- participant records and no inflated statistics.

insert into public.events (
  slug, name, organizer_name, tagline, description, prize_pool_label,
  start_date, end_date, registration_open_at, registration_close_at,
  team_size_min, team_size_max, support_email, support_phone, support_website,
  community_base_count, status, is_default
) values (
  'default',
  'Zing Hackathon',
  'Skillglider',
  'Build something original.',
  'Configure this description from the admin panel.',
  '₹2 Lakhs',
  null, null, null, null,
  1, 4,
  'skillglider4@gmail.com', '+91 7993446574', 'https://skillglider.in',
  200,
  'draft',
  true
)
on conflict (slug) do nothing;

insert into public.rounds (event_id, key, name, description, order_index, status)
select e.id, r.key, r.name, r.description, r.order_index, 'upcoming'
from public.events e
cross join (values
  ('minor', 'Minor Round', 'Online talent evaluation and screening.', 1),
  ('intermediate', 'Intermediate Round', 'Project development and evaluation.', 2),
  ('major', 'Major Round', 'Final presentation and demonstration.', 3)
) as r(key, name, description, order_index)
where e.slug = 'default'
on conflict (event_id, key) do nothing;

insert into public.policy_versions (event_id, type, version, content_markdown, is_current)
select e.id, p.type, 'draft-1', p.content, true
from public.events e
cross join (values
  ('rules', '# Zing Hackathon Rules and Regulations

**This draft has not been reviewed by counsel or legally approved.** Organizers should review and publish a final version from the admin panel before launch.

## Registration accuracy

Provide accurate participant and institution details. Follow the published eligibility and team-size requirements.

## Original work

Submit work your team is authorized to use. Credit third-party code, datasets, assets, and tools.

## Problem statement

Your team is responsible for selecting and explaining its own problem statement.

## Assessment conduct

Follow the published exam instructions. Unauthorized assistance or interference with the assessment may be reviewed by organizers.

## Project submissions

Include all required materials in your team''s public Google Drive folder and maintain the required access permissions.

## Deadlines

Follow the published deadlines and rules governing updates after submission.

## Communication

Maintain active contact information and check your dashboard, email, and official updates regularly.

## Respectful participation

Treat participants, reviewers, and organizers respectfully. Harassment, abuse, and attempts to disrupt the event are prohibited.

## Review and disputes

Use the published organizer process to report concerns or request clarification.

## Organizer-configurable conditions

Disqualification procedures, AI-use rules, appeals, and other unconfirmed conditions will be published here by the organizers before they take effect.'),
  ('privacy', '# Privacy Policy

**This draft describes the platform''s implemented practices below, but has not been reviewed by counsel or legally approved.** Organizers should review and publish a final version from the admin panel before launch.

This page explains how Skillglider handles personal information for Zing Hackathon registration, participation, communication, and event administration.

## Organizer identity and privacy contact

Zing Hackathon is organized by Skillglider. For privacy-related questions, contact skillglider4@gmail.com.

## Information collected

At registration, we collect each participant''s full name, date of birth, college or institution, college roll number, email address, mobile number, WhatsApp number, team role, and team name.

## Purposes of processing

Information is used to administer registration, verify participant identity, run assessments and judging, publish results, and send event communications.

## Supabase and configured service providers

This platform uses Supabase for authentication, database, and file storage. Additional service providers, such as an email or WhatsApp delivery service, are listed here once configured by the organizers.

## Email and WhatsApp communications

Email is used for sign-in codes and essential event updates. WhatsApp updates, where configured, use an approved organizer channel. Promotional communications are sent only with separate, optional consent.

## Public scoreboard information

Published results may show team name, round, criterion-level and total scores, and qualification status. Personal contact details and dates of birth are never published.

## Public Google Drive submissions

Submission folders are shared publicly by participants at "Anyone with the link" (Viewer) access, under Google''s own terms. Participants are responsible for excluding confidential or personal information from these folders.

## Authorized access and security

Access to participant data is restricted by role-based permissions and Row Level Security. Only authorized organizers, reviewers, and the participant themselves can access registration details.

## Retention and deletion

Retention periods have not yet been confirmed by the organizers and will be published here once set.

## Correction and privacy requests

Participants can review and correct their own profile details after signing in. For other privacy requests, contact skillglider4@gmail.com.

## Cookies and authentication sessions

This platform uses essential cookies to maintain your signed-in session. No advertising or tracking cookies are used.

## Participants below the relevant age threshold

Arrangements for participants below the relevant age threshold in their jurisdiction have not yet been confirmed and will be published here by the organizers.

## Policy changes

This policy may be updated. The version and effective date at the top of this page reflect the most recently published version.'),
  ('terms', '# Terms and Conditions

**This draft has not been reviewed by counsel or legally approved.** Organizers should review and publish a final version, and confirm all unresolved details, before registration opens.

These terms describe the conditions for registering for and participating in Zing Hackathon, organized by Skillglider.

## Eligibility and registration

Participants must provide accurate registration details and meet the published eligibility requirements.

## Team membership

Team composition and size limits are set by the organizers and shown on the registration page. Membership changes are locked after the published registration deadline.

## Event format and schedule

The event runs across Minor, Intermediate, and Major rounds according to the published schedule, which may be updated.

## Assessments and submissions

The Minor round includes a timed, server-monitored online assessment. Later rounds require project submissions as one public Google Drive folder containing all required materials.

## Judging and qualification

Judging criteria, weights, and advancement rules are configured per round. Draft scores remain private until explicitly published by the organizers.

## Prize pool and confirmed award conditions

The confirmed total prize pool is Rs. 2,00,000. Award categories, distribution, and any additional conditions will be published separately once confirmed.

## Intellectual property and permitted use

Participants retain ownership of their submitted work unless otherwise agreed in writing with the organizers. Any limited permissions granted to the organizers, such as showcasing your project, will be described here once confirmed.

## Participant conduct

Participants must act honestly and respectfully toward other participants, reviewers, and organizers. Harassment, plagiarism, and disruptive behavior are prohibited.

## Disqualification and review process

Organizers may review conduct or submissions that appear to violate these terms or the Rules and Regulations. The disqualification and appeals process will be published here once confirmed.

## Event changes or cancellation

The organizers may change the schedule, format, or other event details, and will communicate material changes through the notification system.

## Fees and refunds

Registration fees, if any, and any applicable refund conditions have not yet been confirmed and will be published here if applicable.

## Support and disputes

For support, contact skillglider4@gmail.com or +91 7993446574. The process for raising and resolving disputes will be published here once confirmed.

## Applicable legal details requiring organizer confirmation

Governing law, jurisdiction, and other legal details have not yet been confirmed and will be published here before registration opens.')
) as p(type, content)
where e.slug = 'default'
on conflict (event_id, type, version) do nothing;

insert into public.content_blocks (event_id, key, content)
select e.id, c.key, c.content
from public.events e
cross join (values
  ('hero', '{"headline": "Zing Hackathon by Skillglider", "subheadline": "Build something original.", "cta_label": "Register Now"}'::jsonb),
  ('about', '{"body": "Configure the about section from the admin panel."}'::jsonb),
  ('eligibility', '{"body": "Configure eligibility rules and team-size limits from the admin panel."}'::jsonb),
  ('problem_statement', '{"body": "Participants must identify their own problem statement and develop an original solution. There is no fixed organizer-provided problem statement unless configured otherwise."}'::jsonb)
) as c(key, content)
where e.slug = 'default'
on conflict (event_id, key) do nothing;

insert into public.faqs (event_id, question, answer, order_index, published)
select e.id, f.question, f.answer, f.order_index, true
from public.events e
cross join (values
  ('Who organizes Zing Hackathon?', 'Zing Hackathon is organized by Skillglider.', 0),
  ('What is the total prize pool?', 'The total prize pool is Rs. 2,00,000. Award distribution will be published separately.', 1),
  ('Do we receive a fixed problem statement?', 'No. Your team should identify its own problem statement and develop a solution that follows the event rules.', 2),
  ('How many rounds are there?', 'There are three rounds: Minor, Intermediate, and Major.', 3),
  ('How do I sign in?', 'Use the email address provided during registration and complete email verification.', 4),
  ('How do we submit our project?', 'Submit one publicly accessible Google Drive folder link containing all required materials.', 5),
  ('Where can I see marks?', 'Published marks and qualification updates appear in the scoreboard and your participant dashboard, according to organizer visibility settings.', 6),
  ('How will I receive updates?', 'Check your dashboard and registered email regularly. WhatsApp updates may also be sent through configured organizer channels.', 7),
  ('What are the dates, team sizes, and registration fees?', 'Refer to the latest event details. Information that has not been confirmed will be marked as awaiting announcement.', 8),
  ('How can I contact support?', 'Email skillglider4@gmail.com or call +91 7993446574.', 9)
) as f(question, answer, order_index)
where e.slug = 'default'
  and not exists (
    select 1 from public.faqs existing where existing.event_id = e.id and existing.question = f.question
  );
