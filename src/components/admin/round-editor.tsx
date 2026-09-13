"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateRound } from "@/app/admin/rounds/actions";
import { toISTDatetimeLocalValue, fromISTDatetimeLocalValue } from "@/lib/date";
import { roundPhaseLabel } from "@/lib/rounds";
import type { Round } from "@/types/database";

function valuesFromRound(round: Round) {
  return {
    name: round.name,
    description: round.description ?? "",
    evaluation_criteria: round.evaluation_criteria ?? "",
    evaluation_guidelines: round.evaluation_guidelines ?? "",
    categories: round.categories ?? "",
    deliverables: round.deliverables ?? "",
    advancement_rules: round.advancement_rules ?? "",
    starts_at: toISTDatetimeLocalValue(round.starts_at),
    ends_at: toISTDatetimeLocalValue(round.ends_at),
    is_active: round.is_active,
  };
}

// Compact single-round editor: Round Information, then Availability, then
// Save. Meant to sit inside one tab of RoundManagementTabs - each round gets
// its own instance, but only one is visible at a time, so this never stacks
// into the repeated wall of near-identical cards the old always-expanded
// per-round Card layout produced.
export function RoundEditor({ round, eventId, readOnly }: { round: Round; eventId: string; readOnly: boolean }) {
  const [values, setValues] = useState(() => valuesFromRound(round));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof values>(k: K, v: (typeof values)[K]) {
    setStatus("idle");
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setError(null);

    const startsAt = fromISTDatetimeLocalValue(values.starts_at);
    const endsAt = fromISTDatetimeLocalValue(values.ends_at);
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      setError("Submission end time must be after the start time.");
      return;
    }

    setStatus("saving");
    const result = await updateRound(round.id, eventId, { ...values, starts_at: startsAt, ends_at: endsAt });
    if (!result.ok) {
      setStatus("idle");
      setError(result.error ?? "Could not save round.");
      toast.error(result.error ?? "Could not save round.");
      return;
    }
    // Reflect exactly what the database now holds, not just what was sent -
    // e.g. if a value was trimmed/normalized server-side.
    setValues(valuesFromRound(result.round));
    setStatus("saved");
    toast.success("Round updated successfully.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{values.name}</h2>
        <Badge variant="outline">{roundPhaseLabel(round)}</Badge>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Round information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Round title</Label>
            <Input disabled={readOnly} value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Introduction / description</Label>
            <Textarea disabled={readOnly} rows={2} value={values.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Judging criteria</Label>
            <Textarea
              disabled={readOnly}
              rows={2}
              value={values.evaluation_criteria}
              onChange={(e) => set("evaluation_criteria", e.target.value)}
              placeholder="The specific rubric or criteria judges score against for this round."
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Evaluation guidelines</Label>
            <Textarea
              disabled={readOnly}
              rows={2}
              value={values.evaluation_guidelines}
              onChange={(e) => set("evaluation_guidelines", e.target.value)}
              placeholder="General guidance on how this round is evaluated, distinct from the criteria above."
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Categories</Label>
            <Textarea
              disabled={readOnly}
              rows={2}
              value={values.categories}
              onChange={(e) => set("categories", e.target.value)}
              placeholder="e.g. Presentation, Creativity, Technical Understanding"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Rules & instructions</Label>
            <Textarea disabled={readOnly} rows={2} value={values.advancement_rules} onChange={(e) => set("advancement_rules", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Submission requirements</Label>
            <Textarea disabled={readOnly} rows={2} value={values.deliverables} onChange={(e) => set("deliverables", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Availability</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Submission opens (IST)</Label>
            <Input type="datetime-local" disabled={readOnly} value={values.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Submission deadline (IST)</Label>
            <Input type="datetime-local" disabled={readOnly} value={values.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch disabled={readOnly} checked={values.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <Label className="font-normal">Round is active (accepts submissions)</Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Participants can submit only when the round is active and the current time is within the configured
          submission window.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!readOnly && (
        <Button onClick={save} disabled={status === "saving"}>
          {status === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "saved" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
        </Button>
      )}
    </div>
  );
}
