"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { upsertExam } from "@/app/admin/rounds/actions";
import type { Exam } from "@/types/database";

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExamConfigForm({ roundId, eventId, exam, readOnly }: { roundId: string; eventId: string; exam: Exam | null; readOnly: boolean }) {
  const rule = (exam?.qualification_rule as { type?: string; n?: number; value?: number }) ?? { type: "top_n", n: 50 };
  const [values, setValues] = useState({
    title: exam?.title ?? "Minor Round Screening Exam",
    instructions: exam?.instructions ?? "",
    durationMinutes: exam?.duration_minutes ?? 60,
    startsAt: toDatetimeLocal(exam?.starts_at),
    endsAt: toDatetimeLocal(exam?.ends_at),
    shuffleQuestions: exam?.shuffle_questions ?? true,
    qualificationType: (rule.type as "top_n" | "min_score") ?? "top_n",
    qualificationN: rule.n ?? 50,
    qualificationValue: rule.value ?? 60,
    answerKeyReleaseAt: toDatetimeLocal(exam?.answer_key_release_at),
    status: exam?.status ?? "draft",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(k: K, v: (typeof values)[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const result = await upsertExam(roundId, eventId, {
      title: values.title,
      instructions: values.instructions,
      durationMinutes: values.durationMinutes,
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : new Date().toISOString(),
      endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : new Date().toISOString(),
      shuffleQuestions: values.shuffleQuestions,
      qualificationRule:
        values.qualificationType === "top_n" ? { type: "top_n", n: values.qualificationN } : { type: "min_score", value: values.qualificationValue },
      answerKeyReleaseAt: values.answerKeyReleaseAt ? new Date(values.answerKeyReleaseAt).toISOString() : null,
      status: values.status as "draft" | "scheduled" | "live" | "closed",
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else {
      toast.success("Exam saved");
      if (!exam) window.location.reload();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Title</Label>
          <Input disabled={readOnly} value={values.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Instructions</Label>
          <Textarea disabled={readOnly} rows={3} value={values.instructions} onChange={(e) => set("instructions", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Duration (minutes)</Label>
          <Input type="number" disabled={readOnly} value={values.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select disabled={readOnly} value={values.status} onValueChange={(v) => set("status", v as typeof values.status)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Window opens</Label>
          <Input type="datetime-local" disabled={readOnly} value={values.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Window closes</Label>
          <Input type="datetime-local" disabled={readOnly} value={values.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Switch disabled={readOnly} checked={values.shuffleQuestions} onCheckedChange={(v) => set("shuffleQuestions", v)} />
          <Label className="font-normal">Shuffle question order per attempt</Label>
        </div>
        <div className="space-y-2">
          <Label>Qualification rule</Label>
          <Select disabled={readOnly} value={values.qualificationType} onValueChange={(v) => set("qualificationType", v as "top_n" | "min_score")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top_n">Top N scorers</SelectItem>
              <SelectItem value="min_score">Minimum score</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {values.qualificationType === "top_n" ? (
          <div className="space-y-2">
            <Label>N</Label>
            <Input type="number" disabled={readOnly} value={values.qualificationN} onChange={(e) => set("qualificationN", Number(e.target.value))} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Minimum score</Label>
            <Input type="number" disabled={readOnly} value={values.qualificationValue} onChange={(e) => set("qualificationValue", Number(e.target.value))} />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label>Answer key / score release time</Label>
          <Input type="datetime-local" disabled={readOnly} value={values.answerKeyReleaseAt} onChange={(e) => set("answerKeyReleaseAt", e.target.value)} />
          <p className="text-xs text-muted-foreground">Scores stay hidden from participants until this time.</p>
        </div>
      </div>
      {!readOnly && (
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save exam settings
        </Button>
      )}
    </div>
  );
}
