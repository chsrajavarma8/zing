"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { sendNotification, previewAudienceCount, type NotificationInput } from "@/app/admin/notifications/actions";
import { fromISTDatetimeLocalValue } from "@/lib/date";
import type { Round, Team } from "@/types/database";

export function NotificationComposer({ eventId, rounds, teams }: { eventId: string; rounds: Round[]; teams: Team[] }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audienceType, setAudienceType] = useState<NotificationInput["audienceType"]>("all");
  const [priority, setPriority] = useState<NotificationInput["priority"]>("normal");
  const [teamIds, setTeamIds] = useState<Set<string>>(new Set());
  const [emails, setEmails] = useState("");
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "");
  const [actionLink, setActionLink] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setCountLoading(true);
      previewAudienceCount(eventId, {
        audienceType,
        teamIds: Array.from(teamIds),
        emails: emails.split(/[\n,]/).map((e) => e.trim()).filter(Boolean),
        roundId,
      })
        .then((r) => setAudienceCount(r.count))
        .finally(() => setCountLoading(false));
    }, 400);
    return () => clearTimeout(id);
  }, [eventId, audienceType, teamIds, emails, roundId]);

  async function submit() {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required.");
      return;
    }
    setBusy(true);
    const result = await sendNotification(eventId, {
      title,
      message,
      audienceType,
      teamIds: Array.from(teamIds),
      emails: emails.split(/[\n,]/).map((e) => e.trim()).filter(Boolean),
      roundId,
      priority,
      actionLink,
      scheduledAt: fromISTDatetimeLocalValue(scheduledAt),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not send.");
      return;
    }
    toast.success(scheduledAt ? `Scheduled for ${result.recipientCount} recipient(s)` : `Sent to ${result.recipientCount} recipient(s)`);
    setTitle("");
    setMessage("");
    setScheduledAt("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compose notification</CardTitle>
        <CardDescription>Choose an audience below, then send.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {(title || message) && (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Preview</p>
            <p className="text-sm font-semibold">{title || "(no title)"}</p>
            <p className="text-sm text-muted-foreground">{message || "(no message)"}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audienceType} onValueChange={(v) => setAudienceType(v as NotificationInput["audienceType"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All participants</SelectItem>
                <SelectItem value="team_leads">Team leads</SelectItem>
                <SelectItem value="team_members">Team members</SelectItem>
                <SelectItem value="selected_teams">Selected teams</SelectItem>
                <SelectItem value="individual">Individual participants</SelectItem>
                <SelectItem value="round_based">Round-based</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as NotificationInput["priority"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Badge variant="outline" className="gap-1.5">
          <Users className="h-3 w-3" />
          {countLoading ? "Counting…" : `~${audienceCount ?? 0} recipient(s)`}
        </Badge>

        {audienceType === "selected_teams" && (
          <div className="space-y-2">
            <Label>Teams</Label>
            <div className="max-h-40 overflow-y-auto rounded-md border p-2">
              {teams.map((t) => (
                <label key={t.id} className="flex items-center gap-2 py-1 text-sm">
                  <Checkbox
                    checked={teamIds.has(t.id)}
                    onCheckedChange={(v) =>
                      setTeamIds((s) => {
                        const next = new Set(s);
                        if (v) next.add(t.id);
                        else next.delete(t.id);
                        return next;
                      })
                    }
                  />
                  {t.team_name}
                </label>
              ))}
            </div>
          </div>
        )}

        {audienceType === "individual" && (
          <div className="space-y-2">
            <Label>Emails (comma or newline separated)</Label>
            <Textarea rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} />
          </div>
        )}

        {audienceType === "round_based" && (
          <div className="space-y-2">
            <Label>Round</Label>
            <Select value={roundId} onValueChange={setRoundId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rounds.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Action link (optional)</Label>
          <Input value={actionLink} onChange={(e) => setActionLink(e.target.value)} placeholder="/portal/submission" />
        </div>

        <div className="space-y-2">
          <Label>Schedule for later (optional, IST)</Label>
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full sm:w-64" />
          <p className="text-xs text-muted-foreground">
            Leave blank to send immediately. Scheduled sends are dispatched by a cron job that only runs once this
            app is deployed to Vercel: see README for setup.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Delivered as an in-website notification only. Recipients see it in their notification bell and on
          <code className="mx-1 rounded bg-muted px-1 py-0.5">/portal/notifications</code>.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {scheduledAt ? "Schedule Event Update" : "Send Event Update"}
        </Button>
      </CardFooter>
    </Card>
  );
}
