// Single source of truth for displaying dates/times across the site.
// Requirement: every displayed date uses Indian day-month-year order
// (DD-MM-YYYY) and Indian Standard Time (Asia/Kolkata), regardless of the
// viewer's browser locale/timezone. Database columns stay as
// timestamptz/date (machine-readable) - only display goes through here.

const TIME_ZONE = "Asia/Kolkata";

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "14-09-2026"
export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

// "14-09-2026, 06:30 PM"
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  const datePart = formatDate(date);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TIME_ZONE,
  }).format(date);
  return `${datePart}, ${timePart}`;
}

// "06:30 PM"
export function formatTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TIME_ZONE,
  }).format(date);
}

// "14 September 2026" - for long-form prose contexts (still day-first).
export function formatDateLong(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

// IST has a fixed UTC+5:30 offset year-round (no daylight saving), so a
// constant-offset shift is correct and avoids pulling in a timezone library.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// For <input type="datetime-local">: always show/accept IST wall-clock time,
// regardless of the admin's own browser timezone, so deadlines are set
// unambiguously in IST rather than silently in whatever timezone the
// admin's device happens to be in.
export function toISTDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

// Inverse of the above: interprets a "YYYY-MM-DDTHH:mm" value as IST
// wall-clock time and returns the corresponding UTC ISO instant.
export function fromISTDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const utcMs = Date.parse(`${value}:00.000Z`) - IST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

export { TIME_ZONE };
