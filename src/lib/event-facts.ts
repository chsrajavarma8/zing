// Organizer-confirmed facts that aren't stored in the `events` table (no
// mentor/judge roster exists yet - see README "Known limitations"). Kept in
// one place so the homepage and any future page/dashboard reference agree,
// per the "single source of truth for event facts" requirement. Update here
// only when the organizer confirms a new number - never invent one.
export const MENTOR_COUNT_LABEL = "15+";
export const JUDGE_COUNT_LABEL = "8+";
export const ROUND_COUNT_LABEL = "3";

// Working assumption pending organizer sign-off (see handoff notes): "10"
// means age 10, not Class 10, and there is no upper age limit.
export const ELIGIBILITY_SUMMARY =
  "Open to students aged 10 and above, from school through graduate studies. There is no upper age limit.";
