// Shared submission-availability logic (req. #19): a round only accepts
// submissions while it is switched on (is_active) AND the current time
// falls within its starts_at/ends_at window - either condition alone is not
// enough. Centralized here so the public site, the participant portal, and
// the submission forms all agree on the same rule and the same reason text.

import { formatDateTime } from "@/lib/date";
import type { Round } from "@/types/database";

export type RoundPhase = "inactive" | "upcoming" | "open" | "closed";

type RoundTiming = Pick<Round, "is_active" | "starts_at" | "ends_at">;

export function getRoundPhase(round: RoundTiming): RoundPhase {
  const now = Date.now();
  if (!round.is_active) return "inactive";
  if (round.starts_at && now < Date.parse(round.starts_at)) return "upcoming";
  if (round.ends_at && now > Date.parse(round.ends_at)) return "closed";
  return "open";
}

export function isSubmissionWindowOpen(round: RoundTiming): boolean {
  return getRoundPhase(round) === "open";
}

export function roundPhaseLabel(round: RoundTiming): string {
  switch (getRoundPhase(round)) {
    case "inactive":
      return "Not open";
    case "upcoming":
      return "Upcoming";
    case "closed":
      return "Closed";
    case "open":
      return "Open";
  }
}

// null when submissions are open - a human-readable reason (plus the
// relevant opening/closing time) otherwise.
export function submissionUnavailableReason(round: RoundTiming): string | null {
  switch (getRoundPhase(round)) {
    case "open":
      return null;
    case "inactive":
      return "Submissions for this round are not open yet. Check back once the organizers activate it.";
    case "upcoming":
      return `The submission window opens ${formatDateTime(round.starts_at!)}.`;
    case "closed":
      return `The submission window closed ${formatDateTime(round.ends_at!)}.`;
  }
}
