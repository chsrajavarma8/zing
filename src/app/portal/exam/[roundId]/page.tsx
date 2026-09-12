import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExamStart } from "@/components/portal/exam-start";
import { ExamRunner } from "@/components/portal/exam-runner";
import { Clock, FileQuestion } from "lucide-react";

export default async function ExamPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: roundData } = await supabase.from("rounds").select("*").eq("id", roundId).eq("event_id", portal.event.id).maybeSingle();
  if (!roundData) return <p className="text-muted-foreground">Round not found.</p>;
  const round = roundData as unknown as { id: string; name: string };

  const { data: exam } = await supabase.from("exams").select("*").eq("round_id", roundId).maybeSingle();
  const examRow = exam as unknown as {
    id: string;
    title: string;
    instructions: string | null;
    duration_minutes: number;
    starts_at: string;
    ends_at: string;
    answer_key_release_at: string | null;
  } | null;

  if (!examRow) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <FileQuestion className="h-8 w-8" />
          <p>No exam has been configured for this round yet.</p>
        </CardContent>
      </Card>
    );
  }

  const [{ data: attempt }, { count: questionCount }] = await Promise.all([
    supabase.from("exam_attempts").select("*").eq("exam_id", examRow.id).eq("team_member_id", portal.membership.id).maybeSingle(),
    supabase.from("exam_questions").select("id", { count: "exact", head: true }).eq("exam_id", examRow.id),
  ]);

  const attemptRow = attempt as unknown as { id: string; status: string; score: number | null; expires_at: string } | null;
  const now = Date.now();
  const notOpenYet = now < Date.parse(examRow.starts_at);
  const closed = now > Date.parse(examRow.ends_at);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Minor Round Assessment</h1>
        <p className="text-muted-foreground">Review the instructions before starting your online talent evaluation.</p>
      </div>

      {attemptRow && attemptRow.status !== "in_progress" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your assessment has been submitted.</CardTitle>
            <CardDescription>
              Attempt status: <Badge variant="secondary" className="capitalize">{attemptRow.status.replace("_", " ")}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {examRow.answer_key_release_at && now >= Date.parse(examRow.answer_key_release_at) ? (
              <p className="text-lg font-semibold text-foreground">Score: {attemptRow.score ?? "N/A"}</p>
            ) : (
              <p>Your score will be released by the organizers after review.</p>
            )}
          </CardContent>
        </Card>
      ) : attemptRow?.status === "in_progress" ? (
        <ExamRunner attemptId={attemptRow.id} />
      ) : notOpenYet ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p>This assessment opens at {new Date(examRow.starts_at).toLocaleString()}.</p>
          </CardContent>
        </Card>
      ) : closed ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p>This assessment&apos;s window closed on {new Date(examRow.ends_at).toLocaleString()}.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Before you start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Availability" value={`${new Date(examRow.starts_at).toLocaleString()} – ${new Date(examRow.ends_at).toLocaleString()}`} />
              <Field label="Duration" value={`${examRow.duration_minutes} minutes`} />
              <Field label="Questions" value={String(questionCount ?? 0)} />
              <Field label="Attempt status" value="Not started" />
            </div>
            {examRow.instructions && <p className="text-sm text-muted-foreground">{examRow.instructions}</p>}
            <ExamStart examId={examRow.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
