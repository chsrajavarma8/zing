import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { ScheduleManager } from "@/components/admin/schedule-manager";
import { SCHEDULE_EXTRAS_KEY, type ScheduleExtraItem } from "@/lib/schedule-extras";
import type { Round } from "@/types/database";

export default async function AdminSchedulePage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [{ data: rounds }, { data: extrasBlock }] = await Promise.all([
    supabase.from("rounds").select("*").eq("event_id", ctx.event.id).order("order_index"),
    supabase.from("content_blocks").select("content").eq("event_id", ctx.event.id).eq("key", SCHEDULE_EXTRAS_KEY).maybeSingle(),
  ]);

  const extraItems = ((extrasBlock as unknown as { content: { items?: ScheduleExtraItem[] } } | null)?.content.items ?? []) as ScheduleExtraItem[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground">
          One place for every date that drives the public Schedule page: registration, each round&apos;s submission
          window, and any custom milestones you add.
        </p>
      </div>
      <ScheduleManager
        event={ctx.event}
        rounds={(rounds as unknown as Round[] | null) ?? []}
        extraItems={extraItems}
        readOnly={!canManage(ctx)}
      />
    </div>
  );
}
