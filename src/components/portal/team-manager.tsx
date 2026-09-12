"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, Plus, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { addTeamMember, removeTeamMember } from "@/app/portal/team/actions";
import type { Team, TeamMember, Event } from "@/types/database";

const EMPTY = {
  fullName: "",
  dateOfBirth: "",
  college: "",
  rollNumber: "",
  email: "",
  mobile: "",
  whatsapp: "",
  whatsappSameAsMobile: true,
  gender: "",
};

export function TeamManager({
  team,
  teammates,
  event,
  isLead,
  deadlinePassed,
}: {
  team: Team;
  teammates: TeamMember[];
  event: Event;
  isLead: boolean;
  deadlinePassed: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const canManage = isLead && !deadlinePassed && teammates.length < event.team_size_max;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await addTeamMember(team.id, event.id, {
      ...form,
      gender: form.gender || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not add member.");
      return;
    }
    toast.success("Member added");
    setForm(EMPTY);
    setAdding(false);
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    const result = await removeTeamMember(memberId, event.id);
    setRemoving(null);
    if (!result.ok) {
      toast.error(result.error ?? "Could not remove member.");
      return;
    }
    toast.success("Member removed");
  }

  return (
    <div className="space-y-6">
      {deadlinePassed && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Membership locked</AlertTitle>
          <AlertDescription>The registration deadline has passed, so team membership can no longer be changed.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members ({teammates.length}/{event.team_size_max})</CardTitle>
          <CardDescription>Team size: {event.team_size_min}–{event.team_size_max}, including the lead.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {teammates.map((tm) => (
            <div key={tm.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {tm.full_name} {tm.role === "lead" && <Badge variant="secondary" className="ml-1">Lead</Badge>}
                </p>
                <p className="text-muted-foreground">{tm.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={tm.verification_status === "verified" ? "default" : "outline"}>{tm.verification_status}</Badge>
                {isLead && tm.role !== "lead" && !deadlinePassed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${tm.full_name}`}
                    disabled={removing === tm.id}
                    onClick={() => handleRemove(tm.id)}
                  >
                    {removing === tm.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
        {canManage && (
          <CardFooter>
            {!adding ? (
              <Button variant="outline" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add member
              </Button>
            ) : (
              <form onSubmit={handleAdd} className="w-full space-y-3">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Full name" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                  <Input type="date" required value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
                  <Input placeholder="College" required value={form.college} onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))} />
                  <Input placeholder="Roll number" required value={form.rollNumber} onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))} />
                  <Input placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  <Input placeholder="Mobile number" required value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="newMemberWaSame"
                    checked={form.whatsappSameAsMobile}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, whatsappSameAsMobile: Boolean(v) }))}
                  />
                  <Label htmlFor="newMemberWaSame" className="font-normal">WhatsApp same as mobile</Label>
                </div>
                {!form.whatsappSameAsMobile && (
                  <Input placeholder="WhatsApp number" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add to team
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setAdding(false); setError(null); }}>
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  No email is sent. The new member signs in at /login with a temporary password computed from your
                  team name, their own name, and their date of birth: see &quot;First-time login instructions&quot;
                  on the sign-in page. You can&apos;t set a password for them; they&apos;ll set their own private
                  password the first time they sign in.
                </p>
              </form>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
