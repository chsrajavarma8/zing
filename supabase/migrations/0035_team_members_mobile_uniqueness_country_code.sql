-- 0035_team_members_mobile_uniqueness_country_code.sql
-- 0034's uniqueness index normalized only by stripping non-digit characters,
-- so a value that still carried a "91" country-code prefix (e.g. from a
-- future write path that forgot to call normalizePhoneInput() first) would
-- NOT collide with the same number already stored in bare 10-digit form -
-- verified live: inserting "+91 93333-33333" next to an existing
-- "9333333333" row did not trip the 0034 index. Every current application
-- write path already normalizes before insert (src/lib/phone.ts), so this
-- was not an active exploit, but the whole point of a database-level
-- constraint here is to not depend on every future write path remembering
-- to do that correctly.
--
-- The lookahead mirrors normalizePhoneInput()'s own safety rule exactly:
-- only strip a leading "91" or "0" when doing so leaves exactly 10 digits,
-- so a genuine 10-digit number that happens to start with "91" is never
-- corrupted.
drop index if exists public.team_members_mobile_normalized_idx;

create unique index team_members_mobile_normalized_idx
  on public.team_members (
    regexp_replace(
      regexp_replace(mobile, '[^0-9]', '', 'g'),
      '^(91|0)(?=[0-9]{10}$)', ''
    )
  );
