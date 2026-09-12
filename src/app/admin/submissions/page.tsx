import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { SubmissionReviewRow } from "@/components/admin/submission-review-row";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Round } from "@/types/database";

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", ctx.event.id).order("order_index");
  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const activeRoundId = sp.round ?? roundList[0]?.id;

  const { data: submissions } = activeRoundId
    ? await supabase
        .from("submissions")
        .select("*, teams(team_name, reference_id)")
        .eq("round_id", activeRoundId)
        .order("submitted_at", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Submissions</h1>
        <p className="text-muted-foreground">Review Drive folder links, document links, and uploaded documents.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {roundList.map((r) => (
          <a
            key={r.id}
            href={`/admin/submissions?round=${r.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${r.id === activeRoundId ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            {r.name}
          </a>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Link / File</TableHead>
                <TableHead>Checklist</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                {canManage(ctx) && <TableHead>Review</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(submissions as unknown as
                | {
                    id: string;
                    drive_folder_url: string | null;
                    document_link_url: string | null;
                    document_storage_path: string | null;
                    file_name: string | null;
                    checklist: Record<string, boolean>;
                    review_status: string;
                    reviewer_notes: string | null;
                    reviewed_at: string | null;
                    updated_at: string;
                    teams: { team_name: string; reference_id: string } | null;
                  }[]
                | null
              )?.map((s) => (
                <SubmissionReviewRow key={s.id} submission={s} eventId={ctx.event.id} canManage={canManage(ctx)} />
              ))}
            </TableBody>
          </Table>
          {(!submissions || submissions.length === 0) && (
            <p className="py-8 text-center text-muted-foreground">No submissions for this round yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
