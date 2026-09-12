-- 0028_talent_round_rename.sql
-- Req. #3: "There is no examination. The first round is named Talent
-- Round." The round's internal `key` stays 'minor' (many RLS policies,
-- server routes, and the submissions/final_scores schema already reference
-- rounds by id, not by key text, so no functional code depends on the key
-- itself) - only the organizer-facing/participant-facing `name` changes.
-- Renames the already-seeded row for existing installs, and updates the
-- 0013 seed default so a fresh install starts with the right name too.

update public.rounds
set name = 'Talent Round',
    description = 'Submit a document showcasing your talent - upload a file or share a document link.'
where key = 'minor' and name = 'Minor Round';
