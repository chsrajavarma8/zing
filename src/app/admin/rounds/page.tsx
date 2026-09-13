import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { RoundManagementTabs } from "@/components/admin/round-management-tabs";
import { Card, CardContent } from "@/components/ui/card";
import type { Round } from "@/types/database";

export default async function AdminRoundsPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", ctx.event.id).order("order_index");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Round Management</h1>
        <p className="text-muted-foreground">Edit each round&apos;s content, judging setup, and submission window.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <RoundManagementTabs
            rounds={(rounds as unknown as Round[] | null) ?? []}
            eventId={ctx.event.id}
            readOnly={!canManage(ctx)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
