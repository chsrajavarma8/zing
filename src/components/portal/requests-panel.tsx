"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Inbox, Info } from "lucide-react";
import { toast } from "sonner";
import { createRequest } from "@/app/portal/requests/actions";
import { formatDateTime } from "@/lib/date";
import type { RequestRow, RequestType, ExhibitDetails } from "@/types/database";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "outline",
  in_progress: "secondary",
  awaiting_response: "secondary",
  resolved: "default",
  rejected: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In review",
  awaiting_response: "Awaiting your response",
  resolved: "Resolved",
  rejected: "Rejected",
};

const TYPE_LABEL: Record<RequestType, string> = {
  general: "General query",
  exhibition: "Exhibit request",
  presentation: "Presentation or schedule request",
  registration_correction: "Registration correction",
  technical_issue: "Technical issue",
};

interface Message {
  id: string;
  request_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

export function RequestsPanel({
  eventId,
  teamId,
  requests,
  messages,
}: {
  eventId: string;
  teamId: string;
  requests: RequestRow[];
  messages: Message[];
}) {
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<RequestType>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [exhibit, setExhibit] = useState<ExhibitDetails>({});
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await createRequest(eventId, teamId, type, subject, message, null, type === "exhibition" ? exhibit : undefined);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not submit request.");
      return;
    }
    toast.success(`Your request has been recorded. Reference: ${result.referenceId}.`);
    setSubject("");
    setMessage("");
    setExhibit({});
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">New request</CardTitle>
          {!creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New request
            </Button>
          )}
        </CardHeader>
        {creating && (
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-2">
                <Label>Request type</Label>
                <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Details</Label>
                <Textarea id="message" required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>

              {type === "exhibition" && (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Exhibit details</p>
                  <div className="space-y-2">
                    <Label htmlFor="projectTitle">Project title</Label>
                    <Input id="projectTitle" value={exhibit.project_title ?? ""} onChange={(e) => setExhibit((s) => ({ ...s, project_title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exhibitDescription">Exhibit description</Label>
                    <Textarea id="exhibitDescription" rows={2} value={exhibit.exhibit_description ?? ""} onChange={(e) => setExhibit((s) => ({ ...s, exhibit_description: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spaceNeeds">Space or equipment needs</Label>
                    <Input id="spaceNeeds" value={exhibit.space_or_equipment_needs ?? ""} onChange={(e) => setExhibit((s) => ({ ...s, space_or_equipment_needs: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exhibitNotes">Additional notes</Label>
                    <Textarea id="exhibitNotes" rows={2} value={exhibit.additional_notes ?? ""} onChange={(e) => setExhibit((s) => ({ ...s, additional_notes: e.target.value }))} />
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>Submitting an exhibit request does not guarantee approval.</AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit request
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {requests.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-3 h-8 w-8" />
          <p>No requests yet.</p>
        </div>
      ) : (
        requests.map((r) => {
          const thread = messages.filter((m) => m.request_id === r.id);
          return (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{TYPE_LABEL[r.type]}</Badge>
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </div>
                <CardTitle className="text-base">{r.subject}</CardTitle>
                <CardDescription>
                  Reference: {r.reference_id} · {formatDateTime(r.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{r.message}</p>
                {thread.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      {thread.map((m) => (
                        <div key={m.id} className={`rounded-md border p-2 ${m.is_admin ? "bg-primary/5" : "bg-muted/30"}`}>
                          <p className="text-xs font-medium text-muted-foreground">
                            {m.is_admin ? "Organizer" : "You"} · {formatDateTime(m.created_at)}
                          </p>
                          <p>{m.message}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
