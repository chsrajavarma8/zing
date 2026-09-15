-- 0040_school_college_education_level.sql
-- Req.: school students must not be forced to provide college-specific
-- details. Until now every participant required a college name AND a
-- college roll number (both `not null`), with no way to register a school
-- student without inventing a fake roll number. Adds an explicit
-- education_level, makes roll_number optional (college-only), and adds
-- class_grade (school-only) - application code (src/lib/validations/registration.ts)
-- enforces which one is required per member.
--
-- education_level defaults to 'college' so every existing row (all
-- registered before this column existed) keeps its current meaning exactly
-- - no participant record's stored data changes.
alter table public.team_members
  add column education_level text not null default 'college' check (education_level in ('school', 'college')),
  add column class_grade text,
  alter column roll_number drop not null;

-- The old (event_id, college, roll_number) unique constraint assumed every
-- row has a roll number. Replaced with a partial index so it still catches
-- duplicate college+roll registrations, but doesn't apply to school members
-- (who have no roll number and would otherwise collide on NULL under some
-- Postgres uniqueness semantics, or fail to dedupe at all under others).
alter table public.team_members
  drop constraint team_members_event_id_college_roll_number_key;

create unique index team_members_college_roll_unique
  on public.team_members (event_id, college, roll_number)
  where roll_number is not null and education_level = 'college';
