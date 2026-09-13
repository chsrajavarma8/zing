// Shared shape for custom one-off schedule milestones (e.g. "Talent round
// results", "Opening ceremony"), stored as a single content_blocks row
// (key: SCHEDULE_EXTRAS_KEY). Split out from admin/schedule/actions.ts
// because a "use server" file may only export async functions - a plain
// constant or type export there fails to bundle at all.
export const SCHEDULE_EXTRAS_KEY = "schedule_extra_items";

export interface ScheduleExtraItem {
  id: string;
  label: string;
  value: string;
  at: string | null;
}
