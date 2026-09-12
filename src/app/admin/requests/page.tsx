import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { AdminRequestCard } from "@/components/admin/admin-request-card";
import type { RequestRow } from "@/types/database";

export default async function AdminRequestsPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("requests")
    .select("*, teams(team_name, reference_id)")
    .eq("event_id", ctx.event.id)
    .order("created_at", { ascending: false });

  const requestIds = (requests as unknown as { id: string }[] | null)?.map((r) => r.id) ?? [];
  const { data: messages } = requestIds.length > 0 ? await supabase.from("request_messages").select("*").in("request_id", requestIds).order("created_at") : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Participant requests</h1>
        <p className="text-muted-foreground">Review queries, exhibit requests, and correction requests.</p>
      </div>

      <div className="space-y-4">
        {(requests as unknown as (RequestRow & { teams: { team_name: string; reference_id: string } | null })[] | null)?.map((r) => (
          <AdminRequestCard
            key={r.id}
            request={r}
            eventId={ctx.event.id}
            messages={
              (messages as unknown as { id: string; request_id: string; message: string; is_admin: boolean; created_at: string }[] | null)?.filter(
                (m) => m.request_id === r.id,
              ) ?? []
            }
          />
        ))}
        {(!requests || requests.length === 0) && <p className="text-center text-muted-foreground py-8">No requests yet.</p>}
      </div>
    </div>
  );
}
