"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { reviewSubmission } from "@/app/admin/submissions/actions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accessible: "secondary",
  access_issue: "destructive",
  accepted: "default",
};

interface Submission {
  id: string;
  drive_folder_url: string | null;
  checklist: Record<string, boolean>;
  review_status: string;
  reviewer_notes: string | null;
  updated_at: string;
  teams: { team_name: string; reference_id: string } | null;
}

export function SubmissionReviewRow({ submission, eventId, canManage }: { submission: Submission; eventId: string; canManage: boolean }) {
  const [status, setStatus] = useState(submission.review_status);
  const [notes, setNotes] = useState(submission.reviewer_notes ?? "");
  const [busy, setBusy] = useState(false);

  const checklistCount = Object.values(submission.checklist ?? {}).filter(Boolean).length;
  const checklistTotal = Object.keys(submission.checklist ?? {}).length;

  async function save() {
    setBusy(true);
    const result = await reviewSubmission(submission.id, eventId, status as "pending" | "accessible" | "access_issue" | "accepted", notes);
    setBusy(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else toast.success("Review saved");
  }

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{submission.teams?.team_name}</p>
        <p className="font-mono text-xs text-muted-foreground">{submission.teams?.reference_id}</p>
      </TableCell>
      <TableCell>
        {submission.drive_folder_url ? (
          <a href={submission.drive_folder_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary underline underline-offset-4">
            Open <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-muted-foreground">Not submitted</span>
        )}
      </TableCell>
      <TableCell>
        {checklistTotal > 0 ? `${checklistCount}/${checklistTotal}` : "N/A"}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[submission.review_status]}>{submission.review_status.replace("_", " ")}</Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {submission.updated_at ? new Date(submission.updated_at).toLocaleString() : "N/A"}
      </TableCell>
      {canManage && (
        <TableCell>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">Review</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                  <SelectItem value="access_issue">Access Issue</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="Notes for the team (e.g. what to fix)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button size="sm" onClick={save} disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save review
              </Button>
            </PopoverContent>
          </Popover>
        </TableCell>
      )}
    </TableRow>
  );
}
