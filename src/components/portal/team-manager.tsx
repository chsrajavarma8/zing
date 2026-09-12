"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, Plus, Trash2, Lock, Pencil, Save, ArrowLeftRight, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import {
  addTeamMember,
  removeTeamMember,
  renameTeam,
  transferTeamLead,
  setSubmissionDelegate,
} from "@/app/portal/team/actions";
import { GENDER_OPTIONS, type Gender } from "@/lib/gender";
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
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [teamName, setTeamName] = useState(team.team_name);
  const [renameBusy, setRenameBusy] = useState(false);

  const [transferring, setTransferring] = useState<string | null>(null);
  const [delegateBusy, setDelegateBusy] = useState(false);

  const canManage = isLead && !deadlinePassed && teammates.length < event.team_size_max;
  const canManageTeam = isLead && !deadlinePassed;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await addTeamMember(team.id, event.id, {
      ...form,
      gender: (form.gender || undefined) as Gender | undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not add member.");
      return;
    }
    toast.success("Member added");
    setForm(EMPTY);
    setAdding(false);
    router.refresh();
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
    router.refresh();
  }

  async function handleRename() {
    if (teamName.trim() === team.team_name) {
      setRenaming(false);
      return;
    }
    setRenameBusy(true);
    const result = await renameTeam(team.id, event.id, teamName);
    setRenameBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not rename team.");
      return;
    }
    toast.success("Team renamed");
    setRenaming(false);
    router.refresh();
  }

  async function handleTransfer(memberId: string) {
    setTransferring(memberId);
    const result = await transferTeamLead(team.id, event.id, memberId);
    setTransferring(null);
    if (!result.ok) {
      toast.error(result.error ?? "Could not transfer leadership.");
      return;
    }
    toast.success("Leadership transferred");
    router.refresh();
  }

  async function handleDelegate(memberId: string | null) {
    setDelegateBusy(true);
    const result = await setSubmissionDelegate(team.id, event.id, memberId);
    setDelegateBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not update delegate access.");
      return;
    }
    toast.success(memberId ? "Submission access granted" : "Submission access revoked");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {deadlinePassed && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Team changes locked</AlertTitle>
          <AlertDescription>
            The registration deadline has passed or the hackathon has started, so team membership, name, leadership,
            and delegate submission access can no longer be changed. Submissions during an open round window are not
            affected.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team name</CardTitle>
        </CardHeader>
        <CardContent>
          {renaming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="max-w-xs" disabled={renameBusy} />
              <Button size="sm" onClick={handleRename} disabled={renameBusy}>
                {renameBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTeamName(team.team_name);
                  setRenaming(false);
                }}
                disabled={renameBusy}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="font-medium">{team.team_name}</p>
              {canManageTeam && (
                <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members ({teammates.length}/{event.team_size_max})</CardTitle>
          <CardDescription>Team size: {event.team_size_min}–{event.team_size_max}, including the lead.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {teammates.map((tm) => {
            const isDelegate = team.submission_delegate_member_id === tm.id;
            return (
              <div key={tm.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {tm.full_name}{" "}
                    {tm.role === "lead" && <Badge variant="secondary" className="ml-1">Lead</Badge>}
                    {isDelegate && (
                      <Badge variant="outline" className="ml-1">
                        <UserCheck className="mr-1 h-3 w-3" /> Can submit
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground">{tm.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={tm.verification_status === "verified" ? "default" : "outline"}>{tm.verification_status}</Badge>

                  {canManageTeam && tm.role !== "lead" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={transferring === tm.id}>
                          {transferring === tm.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
                          Make lead
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Transfer leadership to {tm.full_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will become a normal team member and lose lead-only controls (adding/removing
                            members, renaming the team, delegate access). {tm.full_name} will become the team lead
                            immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleTransfer(tm.id)}>Transfer leadership</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  {canManageTeam && tm.role !== "lead" && (
                    <Button
                      variant={isDelegate ? "secondary" : "outline"}
                      size="sm"
                      disabled={delegateBusy}
                      onClick={() => handleDelegate(isDelegate ? null : tm.id)}
                    >
                      {delegateBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isDelegate ? <X className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {isDelegate ? "Revoke submit access" : "Allow submit"}
                    </Button>
                  )}

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
            );
          })}
          {canManageTeam && (
            <p className="pt-1 text-xs text-muted-foreground">
              As team lead, you can transfer leadership to a teammate and choose one additional member who may
              submit on the team&apos;s behalf, in addition to you.
            </p>
          )}
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
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 shrink-0 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">+91</span>
                    <Input
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      maxLength={10}
                      required
                      value={form.mobile}
                      onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    />
                  </div>
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
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 shrink-0 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">+91</span>
                    <Input
                      placeholder="10-digit WhatsApp number"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.whatsapp}
                      onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    />
                  </div>
                )}
                {event.allow_gender_field && (
                  <div className="space-y-2">
                    <Label htmlFor="newMemberGender">
                      Gender {event.gender_field_required ? "" : <span className="text-muted-foreground">(optional)</span>}
                    </Label>
                    <Select value={form.gender || undefined} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                      <SelectTrigger id="newMemberGender" className="w-full sm:w-64">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                  team name, their own name, and their birth year: see &quot;First-time login instructions&quot;
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
