// Deterministic temporary-password formula for first-time participant login.
// Each participant can recompute this themselves from public/self-known
// details (their team name, their own name, their own date of birth) - the
// app never needs to transmit or store the result anywhere but Supabase Auth.
//
// Formula: first 2 letters of team name + first 5 letters of full name +
// date of birth as MMDD, all lowercase letters only, padded with "x" if a
// portion is too short. Example: team "Zing", name "Rajavarma", DOB 14
// September -> "zi" + "rajav" + "0914" = "zirajav0914".

const TEAM_PART_LENGTH = 2;
const NAME_PART_LENGTH = 5;

export class InvalidDateOfBirthError extends Error {
  constructor() {
    super("Invalid date of birth.");
    this.name = "InvalidDateOfBirthError";
  }
}

function normalizeLetters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function padWithX(value: string, length: number): string {
  if (value.length >= length) return value.slice(0, length);
  return value + "x".repeat(length - value.length);
}

function formatMonthDay(dateOfBirth: string): { mm: string; dd: string } {
  // dateOfBirth is stored/submitted as an ISO date string ("YYYY-MM-DD").
  // Parse as UTC to avoid local-timezone off-by-one shifts near midnight.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth.trim());
  if (!match) throw new InvalidDateOfBirthError();

  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new InvalidDateOfBirthError();

  // Reject impossible calendar dates (e.g. "2024-02-30") that Date would
  // otherwise silently roll forward into the next month.
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new InvalidDateOfBirthError();
  }

  return {
    mm: String(date.getUTCMonth() + 1).padStart(2, "0"),
    dd: String(date.getUTCDate()).padStart(2, "0"),
  };
}

export function generateTemporaryPassword(params: { teamName: string; fullName: string; dateOfBirth: string }): string {
  const teamPart = padWithX(normalizeLetters(params.teamName), TEAM_PART_LENGTH);
  const namePart = padWithX(normalizeLetters(params.fullName), NAME_PART_LENGTH);
  const { mm, dd } = formatMonthDay(params.dateOfBirth);
  return `${teamPart}${namePart}${mm}${dd}`;
}
