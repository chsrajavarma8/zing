"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateEvent } from "@/app/admin/events/actions";
import { updateRound } from "@/app/admin/rounds/actions";
import { saveScheduleExtras } from "@/app/admin/schedule/actions";
import type { ScheduleExtraItem } from "@/lib/schedule-extras";
import { toISTDatetimeLocalValue, fromISTDatetimeLocalValue } from "@/lib/date";
import type { Event, Round } from "@/types/database";

const ROUND_LABELS: Record<string, string> = { minor: "Minor Round (Talent)", intermediate: "Intermediate Round", major: "Major Round" };

function RegistrationSchedule({ event, readOnly }: { event: Event; readOnly: boolean }) {
  const [values, setValues] = useState({
    registration_open_at: toISTDatetimeLocalValue(event.registration_open_at),
    registration_close_at: toISTDatetimeLocalValue(event.registration_close_at),
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const openAt = fromISTDatetimeLocalValue(values.registration_open_at);
    const closeAt = fromISTDatetimeLocalValue(values.registration_close_at);
    if (openAt && closeAt && Date.parse(closeAt) <= Date.parse(openAt)) {
      setError("Registration close time must be after the open time.");
      return;
    }
    setStatus("saving");
    const result = await updateEvent(event.id, { registration_open_at: openAt, registration_close_at: closeAt });
    if (!result.ok) {
      setStatus("idle");
      setError(result.error ?? "Could not save.");
      toast.error(result.error ?? "Could not save.");
      return;
    }
    setStatus("saved");
    toast.success("Registration schedule updated.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registration</CardTitle>
        <CardDescription>Drives the &quot;Registration&quot; row on the public Schedule page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Opens (IST)</Label>
            <Input
              type="datetime-local"
              disabled={readOnly}
              value={values.registration_open_at}
              onChange={(e) => {
                setStatus("idle");
                setValues((v) => ({ ...v, registration_open_at: e.target.value }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Closes (IST)</Label>
            <Input
              type="datetime-local"
              disabled={readOnly}
              value={values.registration_close_at}
              onChange={(e) => {
                setStatus("idle");
                setValues((v) => ({ ...v, registration_close_at: e.target.value }));
              }}
            />
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!readOnly && (
          <Button onClick={save} disabled={status === "saving"}>
            {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RoundSchedule({ round, eventId, readOnly }: { round: Round; eventId: string; readOnly: boolean }) {
  const [values, setValues] = useState({
    starts_at: toISTDatetimeLocalValue(round.starts_at),
    ends_at: toISTDatetimeLocalValue(round.ends_at),
    is_active: round.is_active,
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const startsAt = fromISTDatetimeLocalValue(values.starts_at);
    const endsAt = fromISTDatetimeLocalValue(values.ends_at);
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      setError("Submission end time must be after the start time.");
      return;
    }
    setStatus("saving");
    const result = await updateRound(round.id, eventId, { starts_at: startsAt, ends_at: endsAt, is_active: values.is_active });
    if (!result.ok) {
      setStatus("idle");
      setError(result.error ?? "Could not save.");
      toast.error(result.error ?? "Could not save.");
      return;
    }
    setStatus("saved");
    toast.success(`${round.name} schedule updated.`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{ROUND_LABELS[round.key] ?? round.name}</CardTitle>
        <CardDescription>Drives this round&apos;s row on the public Schedule page and its round page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Submission opens (IST)</Label>
            <Input
              type="datetime-local"
              disabled={readOnly}
              value={values.starts_at}
              onChange={(e) => {
                setStatus("idle");
                setValues((v) => ({ ...v, starts_at: e.target.value }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Submission deadline (IST)</Label>
            <Input
              type="datetime-local"
              disabled={readOnly}
              value={values.ends_at}
              onChange={(e) => {
                setStatus("idle");
                setValues((v) => ({ ...v, ends_at: e.target.value }));
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            disabled={readOnly}
            checked={values.is_active}
            onCheckedChange={(v) => {
              setStatus("idle");
              setValues((s) => ({ ...s, is_active: v }));
            }}
          />
          <Label className="font-normal">Round is active (accepts submissions)</Label>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!readOnly && (
          <Button onClick={save} disabled={status === "saving"}>
            {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function newExtraItem(): ScheduleExtraItem {
  return { id: crypto.randomUUID(), label: "", value: "", at: null };
}

// Custom one-off milestones (e.g. "Talent round results", "Opening
// ceremony") beyond the fixed Registration + three rounds. Adding one only
// stages it locally; nothing is persisted until Save changes, same pattern
// as the other cards on this page.
function CustomMilestones({ eventId, initialItems, readOnly }: { eventId: string; initialItems: ScheduleExtraItem[]; readOnly: boolean }) {
  const [items, setItems] = useState<ScheduleExtraItem[]>(initialItems);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function update(id: string, patch: Partial<ScheduleExtraItem>) {
    setStatus("idle");
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setStatus("idle");
    setItems((list) => [...list, newExtraItem()]);
  }

  function removeItem(id: string) {
    setStatus("idle");
    setItems((list) => list.filter((item) => item.id !== id));
  }

  async function save() {
    setError(null);
    if (items.some((item) => !item.label.trim())) {
      setError("Every milestone needs a label before saving.");
      return;
    }
    setStatus("saving");
    const result = await saveScheduleExtras(eventId, items);
    if (!result.ok) {
      setStatus("idle");
      setError(result.error ?? "Could not save.");
      toast.error(result.error ?? "Could not save.");
      return;
    }
    setStatus("saved");
    toast.success("Custom milestones updated.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom milestones</CardTitle>
        <CardDescription>
          Extra rows on the public Schedule page beyond registration and the three rounds - e.g. results
          announcements or an opening ceremony.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No custom milestones yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                disabled={readOnly}
                placeholder="e.g. Talent round results"
                value={item.label}
                onChange={(e) => update(item.id, { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Detail text</Label>
              <Input
                disabled={readOnly}
                placeholder="e.g. Announced on the dashboard"
                value={item.value}
                onChange={(e) => update(item.id, { value: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date (IST, optional)</Label>
              <Input
                type="datetime-local"
                disabled={readOnly}
                value={toISTDatetimeLocalValue(item.at)}
                onChange={(e) => update(item.id, { at: fromISTDatetimeLocalValue(e.target.value) })}
              />
            </div>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start sm:size-9 sm:justify-self-auto sm:p-0"
                aria-label={`Remove ${item.label || "milestone"}`}
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sm:hidden">Remove milestone</span>
              </Button>
            )}
          </div>
        ))}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4" /> Add milestone
            </Button>
            <Button onClick={save} disabled={status === "saving"}>
              {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// One page for every date that feeds the public Schedule page - reuses the
// same updateEvent/updateRound actions Event & Branding and Rounds already
// use, so there's no second source of truth for this data, just a
// consolidated place to edit it.
export function ScheduleManager({
  event,
  rounds,
  extraItems,
  readOnly,
}: {
  event: Event;
  rounds: Round[];
  extraItems: ScheduleExtraItem[];
  readOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <RegistrationSchedule event={event} readOnly={readOnly} />
      {rounds.map((r) => (
        <RoundSchedule key={r.id} round={r} eventId={event.id} readOnly={readOnly} />
      ))}
      <CustomMilestones eventId={event.id} initialItems={extraItems} readOnly={readOnly} />
    </div>
  );
}
