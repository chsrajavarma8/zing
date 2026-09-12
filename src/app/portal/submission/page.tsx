import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { SubmissionForm } from "@/components/portal/submission-form";
import { DocumentSubmissionForm } from "@/components/portal/document-submission-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { isSubmissionWindowOpen, submissionUnavailableReason } from "@/lib/rounds";
import type { Round, Submission } from "@/types/database";

export default async function SubmissionPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", portal.event.id).order("order_index");
  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const roundIds = roundList.map((r) => r.id);

  const { data: submissions } =
    roundIds.length > 0
      ? await supabase.from("submissions").select("*").eq("team_id", portal.team.id).in("round_id", roundIds)
      : { data: [] as Submission[] };

  const canSubmit = portal.membership.role === "lead" || portal.team.submission_delegate_member_id === portal.membership.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Your round submissions</h1>
        <p className="text-muted-foreground">
          Submit the required materials for each round before its submission window closes.
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
        const windowOpen = isSubmissionWindowOpen(round);
        const unavailableReason = submissionUnavailableReason(round);

        return (
          <Card key={round.id}>
            <CardHeader>
              <CardTitle className="text-base">{round.name}</CardTitle>
              <CardDescription>{unavailableReason ?? "Submissions are open."}</CardDescription>
            </CardHeader>
            <CardContent>
              {round.key === "minor" ? (
                <DocumentSubmissionForm
                  teamId={portal.team.id}
                  roundId={round.id}
                  submission={submission}
                  canEdit={canSubmit}
                  windowOpen={windowOpen}
                  unavailableReason={unavailableReason}
                />
              ) : (
                <SubmissionForm
                  teamId={portal.team.id}
                  roundId={round.id}
                  submission={submission}
                  canEdit={canSubmit}
                  windowOpen={windowOpen}
                  unavailableReason={unavailableReason}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
