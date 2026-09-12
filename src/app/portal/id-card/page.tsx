import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { IdCardView } from "@/components/portal/id-card-view";
import { Card, CardContent } from "@/components/ui/card";
import { IdCard } from "lucide-react";

export default async function IdCardPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: card } = await supabase
    .from("id_cards")
    .select("qr_token, revoked, issued_at")
    .eq("team_member_id", portal.membership.id)
    .maybeSingle();

  const c = card as unknown as { qr_token: string; revoked: boolean; issued_at: string } | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Your {portal.event.name} ID</h1>
        <p className="text-muted-foreground">View and download your participant identification.</p>
      </div>

      {!c ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <IdCard className="h-8 w-8" />
            <p>Your ID card will appear here when it is issued.</p>
          </CardContent>
        </Card>
      ) : (
        <IdCardView
          token={c.qr_token}
          revoked={c.revoked}
          fullName={portal.membership.full_name}
          teamName={portal.team.team_name}
          teamReferenceId={portal.team.reference_id}
          eventName={portal.event.name}
          organizerName={portal.event.organizer_name}
          role={portal.membership.role}
          referenceId={portal.membership.reference_id}
        />
      )}
    </div>
  );
}
