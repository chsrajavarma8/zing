"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateRound } from "@/app/admin/rounds/actions";
import { toISTDatetimeLocalValue, fromISTDatetimeLocalValue } from "@/lib/date";
import type { Round } from "@/types/database";

export function RoundEditor({ round, eventId, readOnly }: { round: Round; eventId: string; readOnly: boolean }) {
  const [values, setValues] = useState({
    name: round.name,
    description: round.description ?? "",
    deliverables: round.deliverables ?? "",
    evaluation_criteria: round.evaluation_criteria ?? "",
    advancement_rules: round.advancement_rules ?? "",
    starts_at: toISTDatetimeLocalValue(round.starts_at),
    ends_at: toISTDatetimeLocalValue(round.ends_at),
    is_active: round.is_active,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(k: K, v: (typeof values)[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const result = await updateRound(round.id, eventId, {
      ...values,
      starts_at: fromISTDatetimeLocalValue(values.starts_at),
      ends_at: fromISTDatetimeLocalValue(values.ends_at),
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else toast.success("Round saved");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase">{round.key}</Badge>
          <h2 className="text-lg font-semibold">{values.name}</h2>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Round name</Label>
          <Input disabled={readOnly} value={values.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Description</Label>
          <Textarea disabled={readOnly} rows={2} value={values.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Deliverables</Label>
          <Textarea disabled={readOnly} rows={2} value={values.deliverables} onChange={(e) => set("deliverables", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Evaluation criteria (description)</Label>
          <Textarea disabled={readOnly} rows={2} value={values.evaluation_criteria} onChange={(e) => set("evaluation_criteria", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Advancement rules</Label>
          <Textarea disabled={readOnly} rows={2} value={values.advancement_rules} onChange={(e) => set("advancement_rules", e.target.value)} />
        </div>
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
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Submissions are only accepted while this round is active AND the current time is within the submission
          window above. Switch this off to close submissions immediately, regardless of the window.
        </p>
      </div>

      {!readOnly && (
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save round
        </Button>
      )}
    </div>
  );
}
