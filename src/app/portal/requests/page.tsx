import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { RequestsPanel } from "@/components/portal/requests-panel";
import type { RequestRow } from "@/types/database";

export default async function RequestsPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("requests")
    .select("*")
    .eq("team_id", portal.team.id)
    .order("created_at", { ascending: false });

  const requestIds = (requests as unknown as RequestRow[] | null)?.map((r) => r.id) ?? [];
  const { data: messages } =
    requestIds.length > 0
      ? await supabase
          .from("request_messages")
          .select("*")
          .in("request_id", requestIds)
          .order("created_at")
      : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Contact the organizing team</h1>
        <p className="text-muted-foreground">Submit an event-related request and track the response.</p>
      </div>
      <RequestsPanel
        eventId={portal.event.id}
        teamId={portal.team.id}
        requests={(requests as unknown as RequestRow[] | null) ?? []}
        messages={(messages as unknown as { id: string; request_id: string; message: string; is_admin: boolean; created_at: string }[] | null) ?? []}
      />
    </div>
  );
}
