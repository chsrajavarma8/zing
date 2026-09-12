"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Clock, Loader2, ShieldAlert, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Question {
  id: string;
  question_text: string;
  question_type: "mcq_single" | "mcq_multi" | "short_text";
  options: { id: string; label: string }[];
  marks: number;
}

type AnswerValue = { selected?: string } | { selected?: string[] } | { text?: string };

const blockClipboard = (e: React.ClipboardEvent) => e.preventDefault();

export function ExamRunner({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [current, setCurrent] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const autoSubmitted = useRef(false);

  useEffect(() => {
    fetch(`/api/exam/${attemptId}/questions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status !== "in_progress") {
          router.refresh();
          return;
        }
        setQuestions(data.questions);
        setExpiresAt(data.expiresAt);
        const restored: Record<string, AnswerValue> = {};
        for (const a of data.answers ?? []) restored[a.question_id] = a.answer;
        setAnswers(restored);
      });
  }, [attemptId, router]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    await fetch(`/api/exam/${attemptId}/submit`, { method: "POST" });
    router.refresh();
  }, [attemptId, router]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = Date.parse(expiresAt) - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        submit();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, submit]);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function updateAnswer(questionId: string, value: AnswerValue) {
    setAnswers((a) => ({ ...a, [questionId]: value }));
    setSavingIds((s) => new Set(s).add(questionId));
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(async () => {
      await fetch(`/api/exam/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer: value }),
      });
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(questionId);
        return next;
      });
    }, 700);
  }

  if (!questions) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const q = questions[current];
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs / 1000) % 60);
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/90 p-3 backdrop-blur lg:top-0">
        <Badge variant={remainingMs < 60_000 ? "destructive" : "secondary"} className="gap-1.5 text-sm">
          <Clock className="h-3.5 w-3.5" />
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </Badge>
        <p className="text-sm text-muted-foreground">
          {answeredCount}/{questions.length} answered
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const firstUnanswered = questions.findIndex((qq) => !answers[qq.id]);
              if (firstUnanswered === -1) {
                toast.success("All questions are answered.");
              } else {
                setCurrent(firstUnanswered);
              }
            }}
          >
            <ListChecks className="h-4 w-4" /> Review answers
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit assessment
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit your assessment?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will not be able to change your answers after submission unless the organizers reopen the
                  attempt. You&apos;ve answered {answeredCount} of {questions.length} questions.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep working</AlertDialogCancel>
                <AlertDialogAction onClick={submit}>Submit assessment</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => setCurrent(i)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors",
              i === current && "border-primary text-primary",
              answers[qq.id] && "bg-primary/10",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Question {current + 1} of {questions.length} · {q.marks} marks
          </CardTitle>
          <p className="pt-1 text-sm">{q.question_text}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {q.question_type === "mcq_single" && (
            <RadioGroup
              value={(answers[q.id] as { selected?: string })?.selected ?? ""}
              onValueChange={(v) => updateAnswer(q.id, { selected: v })}
            >
              {q.options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2 rounded-md border p-3">
                  <RadioGroupItem value={opt.id} id={`${q.id}-${opt.id}`} />
                  <Label htmlFor={`${q.id}-${opt.id}`} className="flex-1 font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {q.question_type === "mcq_multi" && (
            <div className="space-y-2">
              {q.options.map((opt) => {
                const selected = ((answers[q.id] as { selected?: string[] })?.selected ?? []) as string[];
                const checked = selected.includes(opt.id);
                return (
                  <div key={opt.id} className="flex items-center gap-2 rounded-md border p-3">
                    <Checkbox
                      id={`${q.id}-${opt.id}`}
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v ? [...selected, opt.id] : selected.filter((s) => s !== opt.id);
                        updateAnswer(q.id, { selected: next });
                      }}
                    />
                    <Label htmlFor={`${q.id}-${opt.id}`} className="flex-1 font-normal">
                      {opt.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}

          {q.question_type === "short_text" && (
            <>
              <Textarea
                rows={6}
                value={(answers[q.id] as { text?: string })?.text ?? ""}
                onChange={(e) => updateAnswer(q.id, { text: e.target.value })}
                onCopy={blockClipboard}
                onPaste={blockClipboard}
                onCut={blockClipboard}
              />
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Copy/paste disabled for this field</AlertTitle>
                <AlertDescription>
                  This is a deterrent only and cannot guarantee against cheating. It applies to exam answers
                  only: copy/paste stays available everywhere else on the site.
                </AlertDescription>
              </Alert>
            </>
          )}

          {savingIds.has(q.id) && <p className="text-xs text-muted-foreground">Saving…</p>}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Previous
        </Button>
        <Button variant="outline" disabled={current === questions.length - 1} onClick={() => setCurrent((c) => c + 1)}>
          Save and next
        </Button>
      </div>
    </div>
  );
}
