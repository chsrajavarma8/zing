"use client";

import { useId, useState } from "react";
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
import { AlertCircle, Loader2, Plus, Trash2, Lock, Pencil, Save, ArrowLeftRight, UserCheck, X, AlertTriangle, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  addTeamMember,
  removeTeamMember,
  renameTeam,
  transferTeamLead,
  setSubmissionDelegate,
} from "@/app/portal/team/actions";
import { GENDER_OPTIONS, type Gender } from "@/lib/gender";
import type { Team, RosterMember, Event } from "@/types/database";

const EMPTY = {
  fullName: "",
  dateOfBirth: "",
  educationLevel: "college" as "school" | "college",
  college: "",
  rollNumber: "",
  classGrade: "",
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
  teammates: RosterMember[];
  event: Event;
  isLead: boolean;
  deadlinePassed: boolean;
}) {
  const router = useRouter();
  const fieldId = useId();
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
  const isIncomplete = teammates.length < event.team_size_min;
  const errorId = `${fieldId}-error`;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await addTeamMember(team.id, {
      ...form,
      gender: (form.gender || undefined) as Gender | undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.warning) toast.warning(result.warning);
    else toast.success("Member added. They'll receive an invitation email to set their password.");
    setForm(EMPTY);
    setAdding(false);
    router.refresh();
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    const result = await removeTeamMember(memberId);
    setRemoving(null);
    if (!result.ok) {
      toast.error(result.error);
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
    const result = await renameTeam(team.id, teamName);
    setRenameBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Team renamed");
    setRenaming(false);
    router.refresh();
  }

  async function handleTransfer(memberId: string) {
    setTransferring(memberId);
    const result = await transferTeamLead(team.id, memberId);
    setTransferring(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Leadership transferred");
    router.refresh();
  }

  async function handleDelegate(memberId: string | null) {
    setDelegateBusy(true);
    const result = await setSubmissionDelegate(team.id, memberId);
    setDelegateBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(memberId ? "Submission access granted" : "Submission access revoked");
    router.refresh();
  }

  const f = (name: string) => `${fieldId}-${name}`;

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
              <Label htmlFor={f("team-name")} className="sr-only">
                Team name
              </Label>
              <Input
                id={f("team-name")}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="max-w-xs"
                disabled={renameBusy}
              />
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

      {isIncomplete && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Team incomplete</AlertTitle>
          <AlertDescription>
            Your team has {teammates.length} member{teammates.length === 1 ? "" : "s"}, below the required minimum
            of {event.team_size_min}. Add {event.team_size_min - teammates.length} more member
            {event.team_size_min - teammates.length === 1 ? "" : "s"} below to complete your registration.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Members ({teammates.length}/{event.team_size_max})</CardTitle>
            {isIncomplete && <Badge variant="destructive">Incomplete</Badge>}
          </div>
          <CardDescription>Team size: {event.team_size_min}–{event.team_size_max}, including the lead.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {teammates.map((tm) => {
            const isDelegate = team.submission_delegate_member_id === tm.id;
            return (
              <div key={tm.id} className="rounded-lg border bg-background/60 p-3 text-sm">
                <div className="flex items-start gap-3">
                  <div
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                  >
                    {tm.full_name
                      .trim()
                      .split(/\s+/)
                      .filter((_, i, a) => i === 0 || i === a.length - 1)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{tm.full_name}</p>
                    {tm.email && <p className="break-all text-xs text-muted-foreground">{tm.email}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {tm.role === "lead" && (
                        <Badge variant="secondary" className="gap-1">
                          <Crown className="h-3 w-3" /> Lead
                        </Badge>
                      )}
                      {isDelegate && (
                        <Badge variant="outline" className="gap-1">
                          <UserCheck className="h-3 w-3" /> Can submit
                        </Badge>
                      )}
                      <Badge variant={tm.verification_status === "verified" ? "default" : "outline"} className="capitalize">
                        {tm.verification_status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {canManageTeam && tm.role !== "lead" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
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

                    <Button
                      variant={isDelegate ? "secondary" : "outline"}
                      size="sm"
                      disabled={delegateBusy}
                      onClick={() => handleDelegate(isDelegate ? null : tm.id)}
                    >
                      {delegateBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isDelegate ? <X className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {isDelegate ? "Revoke submit access" : "Allow submit"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${tm.full_name}`}
                      disabled={removing === tm.id}
                      onClick={() => handleRemove(tm.id)}
                    >
                      {removing === tm.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
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
              <form onSubmit={handleAdd} className="w-full space-y-3" aria-describedby={error ? errorId : undefined}>
                {error && (
                  <Alert variant="destructive" id={errorId} role="alert">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={f("name")}>Full name</Label>
                    <Input id={f("name")} autoComplete="off" required value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={f("dob")}>Date of birth</Label>
                    <Input id={f("dob")} type="date" required value={form.dateOfBirth} onChange={(e) => setForm((s) => ({ ...s, dateOfBirth: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={f("level")}>Studying in</Label>
                    <Select value={form.educationLevel} onValueChange={(v) => setForm((s) => ({ ...s, educationLevel: v as "school" | "college" }))}>
                      <SelectTrigger id={f("level")} className="w-full">
                        <SelectValue placeholder="Select education level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="school">School</SelectItem>
                        <SelectItem value="college">College / university</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={f("college")}>{form.educationLevel === "school" ? "School name" : "College / institution"}</Label>
                    <Input id={f("college")} required value={form.college} onChange={(e) => setForm((s) => ({ ...s, college: e.target.value }))} />
                  </div>
                  {form.educationLevel === "school" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor={f("grade")}>Class / grade</Label>
                      <Input id={f("grade")} required value={form.classGrade} onChange={(e) => setForm((s) => ({ ...s, classGrade: e.target.value }))} />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor={f("roll")}>College roll number</Label>
                      <Input id={f("roll")} required value={form.rollNumber} onChange={(e) => setForm((s) => ({ ...s, rollNumber: e.target.value }))} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor={f("email")}>Email address</Label>
                    <Input id={f("email")} type="email" autoComplete="off" required value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={f("mobile")}>Mobile number (+91)</Label>
                    <Input
                      id={f("mobile")}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={10}
                      required
                      value={form.mobile}
                      onChange={(e) => setForm((s) => ({ ...s, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={f("wa-same")}
                    checked={form.whatsappSameAsMobile}
                    onCheckedChange={(v) => setForm((s) => ({ ...s, whatsappSameAsMobile: Boolean(v) }))}
                  />
                  <Label htmlFor={f("wa-same")} className="font-normal">WhatsApp same as mobile</Label>
                </div>
                {!form.whatsappSameAsMobile && (
                  <div className="space-y-1.5">
                    <Label htmlFor={f("wa")}>WhatsApp number (+91)</Label>
                    <Input
                      id={f("wa")}
                      inputMode="numeric"
                      maxLength={10}
                      required
                      value={form.whatsapp}
                      onChange={(e) => setForm((s) => ({ ...s, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    />
                  </div>
                )}
                {event.allow_gender_field && (
                  <div className="space-y-2">
                    <Label htmlFor={f("gender")}>
                      Gender {event.gender_field_required ? "" : <span className="text-muted-foreground">(optional)</span>}
                    </Label>
                    <Select value={form.gender || undefined} onValueChange={(v) => setForm((s) => ({ ...s, gender: v }))}>
                      <SelectTrigger id={f("gender")} className="w-full sm:w-64">
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
                  The new member receives an invitation email and sets their own private password from that link.
                  You can&apos;t set or see a password for them.
                </p>
              </form>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
