"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { replyToRequest } from "@/app/admin/requests/actions";
import type { RequestRow, RequestType } from "@/types/database";

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
  message: string;
  is_admin: boolean;
  created_at: string;
}

export function AdminRequestCard({
  request,
  eventId,
  messages,
}: {
  request: RequestRow & { teams: { team_name: string; reference_id: string } | null };
  eventId: string;
  messages: Message[];
}) {
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState(request.status);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const result = await replyToRequest(request.id, eventId, reply, status !== request.status ? status : undefined);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not send.");
      return;
    }
    toast.success("Reply sent");
    setReply("");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{TYPE_LABEL[request.type]}</Badge>
          <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
        </div>
        <CardTitle className="text-base">{request.subject}</CardTitle>
        <CardDescription>
          Reference: {request.reference_id} · {request.teams?.team_name} ({request.teams?.reference_id}) ·{" "}
          {new Date(request.created_at).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{request.message}</p>
        {request.type === "exhibition" && Object.keys(request.details ?? {}).length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            {Object.entries(request.details as Record<string, string>).map(([k, v]) =>
              v ? (
                <p key={k}>
                  <span className="font-medium capitalize">{k.replace(/_/g, " ")}:</span> {v}
                </p>
              ) : null,
            )}
          </div>
        )}
        {messages.length > 0 && (
          <>
            <Separator />
            {messages.map((m) => (
              <div key={m.id} className={`rounded-md border p-2 ${m.is_admin ? "bg-primary/5" : "bg-muted/30"}`}>
                <p className="text-xs font-medium text-muted-foreground">{m.is_admin ? "Organizer" : "Team"} · {new Date(m.created_at).toLocaleString()}</p>
                <p>{m.message}</p>
              </div>
            ))}
          </>
        )}
        <Separator />
        <Textarea placeholder="Reply to the team…" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as RequestRow["status"])}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In review</SelectItem>
              <SelectItem value="awaiting_response">Awaiting your response</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
