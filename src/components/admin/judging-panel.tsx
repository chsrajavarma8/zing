"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertCriterion, deleteCriterion, saveFinalScore, setPublication, setQualification } from "@/app/admin/judging/actions";
import type { Round, JudgingCriterion, Team } from "@/types/database";

interface Props {
  round: Round;
  eventId: string;
  currentUserId: string;
  canManage: boolean;
  criteria: JudgingCriterion[];
  teams: Team[];
  finalScores: { team_id: string; judge_id: string; score: number; comments: string | null }[];
  publications: { scope: string; is_published: boolean; reviewer_feedback_visible: boolean }[];
  qualifications: { team_id: string; status: string; rank: number | null }[];
}

export function JudgingPanel({ round, eventId, currentUserId, canManage, criteria, teams, finalScores, publications, qualifications }: Props) {
  const [, startTransition] = useTransition();
  const [newCriterion, setNewCriterion] = useState({ name: "", maxMarks: 10, weight: 1 });
  const participantPub = publications.find((p) => p.scope === "participant");
  const publicPub = publications.find((p) => p.scope === "public");

  async function handleAddCriterion() {
    if (!newCriterion.name.trim()) return;
    const result = await upsertCriterion(round.id, { name: newCriterion.name, maxMarks: newCriterion.maxMarks, weight: newCriterion.weight, orderIndex: criteria.length });
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else {
      toast.success("Criterion added");
      setNewCriterion({ name: "", maxMarks: 10, weight: 1 });
    }
  }

  function myScore(teamId: string) {
    return finalScores.find((s) => s.team_id === teamId && s.judge_id === currentUserId)?.score;
  }

  // Preserves the pre-existing multi-judge aggregation rule: a team's
  // published total is the average of every judge's individual score, so
  // adding more judges doesn't mechanically inflate a team's total.
  function teamAverage(teamId: string) {
    const relevant = finalScores.filter((s) => s.team_id === teamId);
    if (relevant.length === 0) return null;
    return relevant.reduce((sum, s) => sum + s.score, 0) / relevant.length;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Judging criteria: {round.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {criteria.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>
                {c.name} <span className="text-muted-foreground">({c.max_marks} marks, weight {c.weight})</span>
              </span>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete criterion ${c.name}`}
                  onClick={() => startTransition(async () => { await deleteCriterion(c.id); })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {canManage && (
            <div className="flex flex-wrap items-end gap-2 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={newCriterion.name} onChange={(e) => setNewCriterion((s) => ({ ...s, name: e.target.value }))} className="w-48" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Max marks</label>
                <Input type="number" value={newCriterion.maxMarks} onChange={(e) => setNewCriterion((s) => ({ ...s, maxMarks: Number(e.target.value) }))} className="w-24" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Weight</label>
                <Input type="number" value={newCriterion.weight} onChange={(e) => setNewCriterion((s) => ({ ...s, weight: Number(e.target.value) }))} className="w-20" />
              </div>
              <Button onClick={handleAddCriterion}>
                <Plus className="h-4 w-4" /> Add criterion
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enter your final score</CardTitle>
          <CardDescription>
            One overall score from 1 to 100 per team, weighing the marking criteria above. Attributed to your
            account and stays in draft until published.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Your score (1-100)</TableHead>
                <TableHead className="text-right">Judges scored</TableHead>
                <TableHead className="text-right">Team average</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => {
                const teamScores = finalScores.filter((s) => s.team_id === t.id);
                const avg = teamAverage(t.id);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.team_name}</TableCell>
                    <TableCell className="text-right">
                      <FinalScoreInput roundId={round.id} teamId={t.id} initial={myScore(t.id)} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{teamScores.length}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{avg !== null ? avg.toFixed(1) : "N/A"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publish results</CardTitle>
              <CardDescription>Draft scores stay private until you publish. Participant and public visibility are separate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PublishRow
                label="Visible to participants (their own team)"
                roundId={round.id}
                eventId={eventId}
                scope="participant"
                isPublished={participantPub?.is_published ?? false}
                reviewerFeedbackVisible={participantPub?.reviewer_feedback_visible ?? false}
              />
              <PublishRow
                label="Visible on the public scoreboard"
                roundId={round.id}
                eventId={eventId}
                scope="public"
                isPublished={publicPub?.is_published ?? false}
                reviewerFeedbackVisible={publicPub?.reviewer_feedback_visible ?? false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Qualification & ranking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {teams.map((t) => {
                const q = qualifications.find((x) => x.team_id === t.id);
                return (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <span className="font-medium">{t.team_name}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Rank"
                        defaultValue={q?.rank ?? ""}
                        className="w-20"
                        onBlur={(e) =>
                          startTransition(async () => {
                            await setQualification(round.id, t.id, eventId, (q?.status as "qualified" | "not_qualified" | "pending") ?? "pending", e.target.value ? Number(e.target.value) : null);
                          })
                        }
                      />
                      <Select
                        defaultValue={q?.status ?? "pending"}
                        onValueChange={(v) =>
                          startTransition(async () => {
                            const result = await setQualification(round.id, t.id, eventId, v as "qualified" | "not_qualified" | "pending", q?.rank ?? null);
                            if (!result.ok) toast.error(result.error ?? "Could not save.");
                          })
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="not_qualified">Not qualified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function FinalScoreInput({ roundId, teamId, initial }: { roundId: string; teamId: string; initial?: number }) {
  const [value, setValue] = useState(initial?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function commit() {
    if (value.trim() === "") return;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      toast.error("Enter a score between 1 and 100.");
      return;
    }
    setSaving(true);
    const result = await saveFinalScore(roundId, teamId, n);
    setSaving(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else toast.success("Score saved");
  }

  return (
    <Input
      type="number"
      min={1}
      max={100}
      step={1}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      className="w-20 text-right"
      disabled={saving}
    />
  );
}

function PublishRow({
  label,
  roundId,
  eventId,
  scope,
  isPublished,
  reviewerFeedbackVisible,
}: {
  label: string;
  roundId: string;
  eventId: string;
  scope: "participant" | "public";
  isPublished: boolean;
  reviewerFeedbackVisible: boolean;
}) {
  const [published, setPublished] = useState(isPublished);
  const [feedback, setFeedback] = useState(reviewerFeedbackVisible);
  const [busy, setBusy] = useState(false);

  async function apply(nextPublished: boolean, nextFeedback: boolean) {
    setBusy(true);
    const result = await setPublication(roundId, eventId, scope, nextPublished, nextFeedback);
    setBusy(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else toast.success("Publication updated");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          {published ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={feedback} disabled={busy} onCheckedChange={(v) => { setFeedback(v); apply(published, v); }} />
          Reviewer feedback visible
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={published} disabled={busy} onCheckedChange={(v) => { setPublished(v); apply(v, feedback); }} />
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Published
        </label>
      </div>
    </div>
  );
}
