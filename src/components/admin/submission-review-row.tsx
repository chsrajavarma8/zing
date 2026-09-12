"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink, Loader2, Save, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { reviewSubmission } from "@/app/admin/submissions/actions";
import { formatDateTime } from "@/lib/date";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_review: "outline",
  accepted: "default",
  rejected: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  accepted: "Accepted",
  rejected: "Rejected",
};

interface Submission {
  id: string;
  drive_folder_url: string | null;
  document_link_url: string | null;
  document_storage_path: string | null;
  file_name: string | null;
  checklist: Record<string, boolean>;
  review_status: string;
  reviewer_notes: string | null;
  reviewed_at: string | null;
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
    if (status === "rejected" && !notes.trim()) {
      toast.error("A reason is required when rejecting a submission.");
      return;
    }
    setBusy(true);
    const result = await reviewSubmission(submission.id, eventId, status as "pending_review" | "accepted" | "rejected", notes);
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
        <div className="flex flex-col gap-1">
          {submission.drive_folder_url && (
            <a href={submission.drive_folder_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary underline underline-offset-4">
              Open folder <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {submission.document_link_url && (
            <a href={submission.document_link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary underline underline-offset-4">
              Open link <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {submission.document_storage_path && (
            <a
              href={`/api/submissions/${submission.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary underline underline-offset-4"
            >
              <FileText className="h-3 w-3" /> {submission.file_name ?? "Download file"} <Download className="h-3 w-3" />
            </a>
          )}
          {!submission.drive_folder_url && !submission.document_link_url && !submission.document_storage_path && (
            <span className="text-muted-foreground">Not submitted</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {checklistTotal > 0 ? `${checklistCount}/${checklistTotal}` : "N/A"}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[submission.review_status]}>{STATUS_LABEL[submission.review_status] ?? submission.review_status}</Badge>
        {submission.reviewed_at && (
          <p className="mt-1 text-xs text-muted-foreground">Reviewed {formatDateTime(submission.reviewed_at)}</p>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {submission.updated_at ? formatDateTime(submission.updated_at) : "N/A"}
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
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder={status === "rejected" ? "Reason for rejection (required)" : "Feedback for the team (optional)"}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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
