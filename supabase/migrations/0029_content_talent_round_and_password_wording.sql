-- 0029_content_talent_round_and_password_wording.sql
-- Fixes seeded content (rules/terms/FAQ) that still described the removed
-- exam/assessment workflow (req. #3) or the old MMDD temporary-password
-- formula (req. #8, superseded by 0026-era temp-password.ts change to
-- "2 team letters + 3 name letters + birth year"). Plain UPDATEs, same
-- pattern as 0019/0021, since 0013 used INSERT ... ON CONFLICT DO NOTHING
-- and will never re-touch already-seeded rows.

update public.policy_versions
set content_markdown = replace(
  content_markdown,
  '## Assessment conduct

Follow the published exam instructions. Unauthorized assistance or interference with the assessment may be reviewed by organizers.',
  '## Talent Round conduct

Follow the published Talent Round submission instructions. Submitted documents must be your own original work; misrepresentation or interference with the submission process may be reviewed by organizers.'
)
where type = 'rules' and version = 'draft-1'
  and content_markdown like '%Follow the published exam instructions.%';

update public.policy_versions
set content_markdown = replace(
  content_markdown,
  '## Assessments and submissions

The Minor round includes a timed, server-monitored online assessment. Later rounds require project submissions as one public Google Drive folder containing all required materials.',
  '## Talent Round and project submissions

The Talent Round requires submitting one document per team, either as an uploaded file or a shareable document link. Later rounds require project submissions as one public Google Drive folder containing all required materials.'
)
where type = 'terms' and version = 'draft-1'
  and content_markdown like '%The Minor round includes a timed, server-monitored online assessment.%';

update public.faqs
set answer = 'Sign in with your registered email and password. First-time participants use a temporary password generated from 2 letters of their team name, 3 letters of their own name, and their birth year (shown on the sign-in page) and must set a private password on first sign-in. There is no email verification step.'
where question = 'How do I sign in?'
  and answer like '%temporary password generated from their team name, their own name, and date of birth%';

update public.faqs
set answer = 'There are three rounds: Talent, Intermediate, and Major.'
where question = 'How many rounds are there?'
  and answer = 'There are three rounds: Minor, Intermediate, and Major.';

insert into public.faqs (event_id, question, answer, order_index, published)
select e.id,
  'What is the Talent Round?',
  'The Talent Round is the first round. Submit one document per team - either upload a file (PDF, DOC, DOCX, PPT, PPTX, PNG, or JPEG, up to 25 MB) or share a document link, such as a Google Docs link with viewer access - during the published submission window.',
  3,
  true
from public.events e
where e.slug = 'default'
  and not exists (
    select 1 from public.faqs existing where existing.event_id = e.id and existing.question = 'What is the Talent Round?'
  );
