"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertQuestion, deleteQuestion, type QuestionInput } from "@/app/admin/rounds/[roundId]/exam/actions";
import type { ExamQuestion } from "@/types/database";

function emptyForm(orderIndex: number): QuestionInput {
  return {
    questionText: "",
    questionType: "mcq_single",
    options: [
      { id: "a", label: "" },
      { id: "b", label: "" },
    ],
    correctAnswer: { selected: "a" },
    marks: 1,
    orderIndex,
  };
}

export function QuestionBank({ examId, roundId, questions, readOnly }: { examId: string; roundId: string; questions: ExamQuestion[]; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExamQuestion | null>(null);
  const [form, setForm] = useState<QuestionInput>(emptyForm(questions.length));
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(emptyForm(questions.length));
    setOpen(true);
  }

  function openEdit(q: ExamQuestion) {
    setEditing(q);
    setForm({
      questionText: q.question_text,
      questionType: q.question_type,
      options: (q.options as { id: string; label: string }[]) ?? [],
      correctAnswer: q.correct_answer as { selected: string | string[] } | null,
      marks: q.marks,
      orderIndex: q.order_index,
    });
    setOpen(true);
  }

  async function handleSave() {
    setBusy(true);
    const result = await upsertQuestion(examId, roundId, form, editing?.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save question.");
      return;
    }
    toast.success("Question saved");
    setOpen(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteQuestion(id, roundId);
    if (!result.ok) toast.error(result.error ?? "Could not delete.");
    else toast.success("Question deleted");
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Add question
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit question" : "New question"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Question text</Label>
                <Textarea rows={3} value={form.questionText} onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={form.questionType}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        questionType: v as QuestionInput["questionType"],
                        options: v === "short_text" ? [] : f.options.length ? f.options : [{ id: "a", label: "" }, { id: "b", label: "" }],
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq_single">Single choice</SelectItem>
                      <SelectItem value="mcq_multi">Multiple choice</SelectItem>
                      <SelectItem value="short_text">Short text (manual grading)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Marks</Label>
                  <Input type="number" value={form.marks} onChange={(e) => setForm((f) => ({ ...f, marks: Number(e.target.value) }))} />
                </div>
              </div>

              {form.questionType !== "short_text" && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  {form.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <Input
                        value={opt.label}
                        placeholder={`Option ${opt.id.toUpperCase()}`}
                        onChange={(e) => {
                          const options = [...form.options];
                          options[i] = { ...opt, label: e.target.value };
                          setForm((f) => ({ ...f, options }));
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove option ${opt.id.toUpperCase()}`}
                        onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        options: [...f.options, { id: String.fromCharCode(97 + f.options.length), label: "" }],
                      }))
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Add option
                  </Button>

                  <div className="pt-2">
                    <Label>Correct answer{form.questionType === "mcq_multi" ? "s" : ""}</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {form.options.map((opt) => {
                        const selected =
                          form.questionType === "mcq_single"
                            ? form.correctAnswer?.selected === opt.id
                            : ((form.correctAnswer?.selected as string[]) ?? []).includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (form.questionType === "mcq_single") {
                                setForm((f) => ({ ...f, correctAnswer: { selected: opt.id } }));
                              } else {
                                const current = (form.correctAnswer?.selected as string[]) ?? [];
                                const next = current.includes(opt.id) ? current.filter((x) => x !== opt.id) : [...current, opt.id];
                                setForm((f) => ({ ...f, correctAnswer: { selected: next } }));
                              }
                            }}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${selected ? "border-primary bg-primary/10 text-primary" : ""}`}
                          >
                            {opt.id.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Never shown to participants before the answer key release time.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-start justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                {i + 1}. {q.question_text}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">{q.question_type.replace("_", " ")}</Badge>
                <Badge variant="secondary">{q.marks} marks</Badge>
              </div>
            </div>
            {!readOnly && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label={`Edit question ${i + 1}`} onClick={() => openEdit(q)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Delete question ${i + 1}`} onClick={() => handleDelete(q.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
      </div>
    </div>
  );
}
