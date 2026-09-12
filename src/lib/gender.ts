// Single source of truth for the gender dropdown's options (registration,
// profile edit, and admin-adds-a-member). Values double as the stored
// text and the displayed label, so admin views and CSV export need no
// separate lookup/translation step.
export const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];

export function isGenderOption(value: string): value is Gender {
  return (GENDER_OPTIONS as readonly string[]).includes(value);
}
