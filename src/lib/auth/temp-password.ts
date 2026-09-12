// Deterministic temporary-password formula for first-time participant login.
// Each participant can recompute this themselves from public/self-known
// details (their team name, their own name, their own date of birth) - the
// app never needs to transmit or store the result anywhere but Supabase Auth.
//
// Formula: first 2 letters of team name + first 3 letters of full name +
// 4-digit birth year, all lowercase letters only, padded with "x" if a name
// portion is too short (e.g. a 1-letter team/given name). Example: team
// "Zing", name "Rajavarma", DOB 1998-09-14 -> "zi" + "raj" + "1998" =
// "ziraj1998".
//
// Spaces/punctuation in the team or participant name are stripped before
// taking letters (normalizeLetters), so "A B" and "Team #1" degrade
// gracefully to their letters-only form rather than erroring. A short name
// (fewer letters than the formula needs) is padded with "x" rather than
// guessing at additional characters. Date of birth is a required
// registration field, so a birth year is always present by the time this
// runs - InvalidDateOfBirthError below is the fail-closed guard for a
// malformed value slipping through, not a "missing year" case.
const TEAM_PART_LENGTH = 2;
const NAME_PART_LENGTH = 3;

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

function extractBirthYear(dateOfBirth: string): string {
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

  return String(date.getUTCFullYear()).padStart(4, "0");
}

export function generateTemporaryPassword(params: { teamName: string; fullName: string; dateOfBirth: string }): string {
  const teamPart = padWithX(normalizeLetters(params.teamName), TEAM_PART_LENGTH);
  const namePart = padWithX(normalizeLetters(params.fullName), NAME_PART_LENGTH);
  const year = extractBirthYear(params.dateOfBirth);
  return `${teamPart}${namePart}${year}`;
}
