"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { updateRound } from "@/app/admin/rounds/actions";
import type { Round } from "@/types/database";

function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RoundEditor({ round, eventId, readOnly }: { round: Round; eventId: string; readOnly: boolean }) {
  const [values, setValues] = useState({
    name: round.name,
    description: round.description ?? "",
    deliverables: round.deliverables ?? "",
    evaluation_criteria: round.evaluation_criteria ?? "",
    advancement_rules: round.advancement_rules ?? "",
    starts_at: toDatetimeLocal(round.starts_at),
    ends_at: toDatetimeLocal(round.ends_at),
    status: round.status,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(k: K, v: (typeof values)[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const result = await updateRound(round.id, eventId, {
      ...values,
      starts_at: values.starts_at ? new Date(values.starts_at).toISOString() : null,
      ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
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
        {round.key === "minor" && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/rounds/${round.id}/exam`}>
              <FileQuestion className="h-4 w-4" /> Configure exam
            </Link>
          </Button>
        )}
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
          <Label>Starts at</Label>
          <Input type="datetime-local" disabled={readOnly} value={values.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Ends at (deadline)</Label>
          <Input type="datetime-local" disabled={readOnly} value={values.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select disabled={readOnly} value={values.status} onValueChange={(v) => set("status", v as typeof values.status)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
