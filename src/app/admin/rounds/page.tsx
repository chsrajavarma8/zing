import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { RoundEditor } from "@/components/admin/round-editor";
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
        <h1 className="text-2xl font-bold">Rounds & Exams</h1>
        <p className="text-muted-foreground">Configure the Minor, Intermediate, and Major rounds.</p>
      </div>
      <div className="space-y-4">
        {((rounds as unknown as Round[] | null) ?? []).map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-6">
              <RoundEditor round={r} eventId={ctx.event.id} readOnly={!canManage(ctx)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
