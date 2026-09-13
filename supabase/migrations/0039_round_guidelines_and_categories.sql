-- 0039_round_guidelines_and_categories.sql
-- Splitting the combined /rounds page into per-round pages (Minor its own
-- page; Intermediate/Major sharing a tabbed page) surfaced that "Judging
-- Criteria" and "Evaluation Guidelines" were being asked to display as two
-- separate, independent sections, but the schema only ever had one field
-- (evaluation_criteria) plus a differently-purposed advancement_rules that
-- rounds-journey.tsx was already reusing inconsistently per round (see that
-- file's per-key branches) rather than genuinely being "guidelines" for two
-- of the three rounds. Likewise "Categories" (e.g. Presentation, Innovation)
-- had no field of its own anywhere.
--
-- Reuses every existing column rather than renaming/repurposing them (no
-- admin-entered content is lost): description stays the introduction,
-- evaluation_criteria stays the judging criteria, deliverables and
-- advancement_rules keep their existing meaning and columns. Only the two
-- genuinely-missing fields are added, both nullable text so every existing
-- row keeps working unchanged until an admin fills them in.
alter table public.rounds
  add column evaluation_guidelines text,
  add column categories text;

comment on column public.rounds.evaluation_guidelines is
  'General guidance on how judging is approached for this round - distinct from evaluation_criteria (the specific judging criteria/rubric) and from description (the round introduction).';
comment on column public.rounds.categories is
  'Free-text list of this round''s judging categories (e.g. "Presentation, Creativity, Technical Understanding"), independent per round.';
