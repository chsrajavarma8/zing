import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ExamConfigForm } from "@/components/admin/exam-config-form";
import { QuestionBank } from "@/components/admin/question-bank";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Exam, ExamQuestion } from "@/types/database";

export default async function ExamConfigPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: round } = await supabase.from("rounds").select("id, name, event_id").eq("id", roundId).maybeSingle();
  if (!round || (round as unknown as { event_id: string }).event_id !== ctx.event.id) notFound();

  const { data: exam } = await supabase.from("exams").select("*").eq("round_id", roundId).maybeSingle();
  const examRow = exam as unknown as Exam | null;

  const { data: questions } = examRow
    ? await supabase.from("exam_questions").select("*").eq("exam_id", examRow.id).order("order_index")
    : { data: [] as ExamQuestion[] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exam configuration</h1>
        <p className="text-muted-foreground">{(round as unknown as { name: string }).name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <ExamConfigForm roundId={roundId} eventId={ctx.event.id} exam={examRow} readOnly={!canManage(ctx)} />
        </CardContent>
      </Card>

      {examRow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question bank</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionBank
              examId={examRow.id}
              roundId={roundId}
              questions={(questions as unknown as ExamQuestion[] | null) ?? []}
              readOnly={!canManage(ctx)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
