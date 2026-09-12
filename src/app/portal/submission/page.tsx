import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { SubmissionForm } from "@/components/portal/submission-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Round, Submission } from "@/types/database";

export default async function SubmissionPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: rounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("event_id", portal.event.id)
    .neq("key", "minor")
    .order("order_index");
  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const roundIds = roundList.map((r) => r.id);

  const { data: submissions } =
    roundIds.length > 0
      ? await supabase.from("submissions").select("*").eq("team_id", portal.team.id).in("round_id", roundIds)
      : { data: [] as Submission[] };

  const isLead = portal.membership.role === "lead";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Your project submission</h1>
        <p className="text-muted-foreground">
          Keep your team&apos;s required project materials together in one public Google Drive folder.
        </p>
      </div>

      {roundList.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No submission rounds are configured yet.
          </CardContent>
        </Card>
      )}

      {roundList.map((round) => {
        const submission = (submissions as unknown as Submission[] | null)?.find((s) => s.round_id === round.id) ?? null;
        return (
          <Card key={round.id}>
            <CardHeader>
              <CardTitle className="text-base">{round.name}</CardTitle>
              <CardDescription>
                {round.ends_at ? `Deadline: ${new Date(round.ends_at).toLocaleString()}` : "Deadline: To be announced"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionForm
                teamId={portal.team.id}
                roundId={round.id}
                submission={submission}
                canEdit={isLead}
                deadlinePassed={Boolean(round.ends_at && Date.now() > Date.parse(round.ends_at))}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
