"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Lock, FileText, UploadCloud, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { saveDocumentLink, deleteSubmission } from "@/app/portal/submission/actions";
import { formatDateTime } from "@/lib/date";
import { directUpload } from "@/lib/direct-upload";
import type { Submission } from "@/types/database";

const ACCEPTED_LABEL = "PDF, DOC, DOCX, PPT, PPTX, PNG, or JPEG";
const ACCEPTED_ACCEPT_ATTR = ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg";
const MAX_SIZE_LABEL = "25 MB";
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_review: "outline",
  accepted: "default",
  rejected: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  accepted: "Accepted",
  rejected: "Rejected",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentSubmissionForm({
  teamId,
  roundId,
  submission,
  canEdit,
  windowOpen,
  unavailableReason,
}: {
  teamId: string;
  roundId: string;
  submission: Submission | null;
  canEdit: boolean;
  windowOpen: boolean;
  unavailableReason: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState(submission?.document_link_url ?? "");
  const [savingLink, setSavingLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = !canEdit || !windowOpen;
  const hasDocument = Boolean(submission?.document_storage_path || submission?.document_link_url);

  async function handleSaveLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingLink(true);
    const result = await saveDocumentLink(teamId, roundId, link);
    setSavingLink(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save link.");
      return;
    }
    toast.success("Document link saved.");
    router.refresh();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File must be under ${MAX_SIZE_LABEL}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      // Uploads go straight to Storage via a signed URL and are verified by
      // the server afterwards (no 4.5 MB serverless body limit).
      const result = await directUpload({
        bucket: "team-submissions",
        file,
        urlEndpoint: "/api/portal/submissions/upload-url",
        completeEndpoint: "/api/portal/submissions/complete",
        extra: { teamId, roundId },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Document uploaded.");
      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!submission) return;
    setDeleting(true);
    const result = await deleteSubmission(submission.id, teamId, roundId);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not delete submission.");
      return;
    }
    toast.success("Submission deleted");
    setLink("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Review status:</span>
        {submission ? (
          <Badge variant={STATUS_VARIANT[submission.review_status]}>{STATUS_LABEL[submission.review_status]}</Badge>
        ) : (
          <Badge variant="outline">Not submitted</Badge>
        )}
        {submission?.updated_at && (
          <span className="text-xs text-muted-foreground">Last updated {formatDateTime(submission.updated_at)}</span>
        )}
      </div>

      {submission && submission.review_status !== "pending_review" && (
        <Alert variant={submission.review_status === "rejected" ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{submission.review_status === "rejected" ? "Rejected" : "Accepted"}</AlertTitle>
          <AlertDescription>
            {submission.reviewer_notes || (submission.review_status === "rejected" ? "The organizers rejected this submission." : "This submission was accepted.")}
          </AlertDescription>
        </Alert>
      )}

      {locked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            {unavailableReason ?? "Only the team lead or the delegated submitter can submit for this round."}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Submit your document either by uploading a file ({ACCEPTED_LABEL}, up to {MAX_SIZE_LABEL}) or by sharing a
          document link (e.g. a Google Docs link with viewer access) - one or both.
        </AlertDescription>
      </Alert>

      {submission?.document_storage_path && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">{submission.file_name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(submission.file_size)}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={`/api/submissions/${submission.id}/download`} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`file-${roundId}`}>Upload a document</Label>
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            id={`file-${roundId}`}
            type="file"
            accept={ACCEPTED_ACCEPT_ATTR}
            disabled={locked || uploading}
            onChange={handleFileChange}
          />
          {uploading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
        </div>
        <p className="text-xs text-muted-foreground">Accepted: {ACCEPTED_LABEL}. Maximum size: {MAX_SIZE_LABEL}.</p>
      </div>

      <Separator />

      <form onSubmit={handleSaveLink} className="space-y-2">
        <Label htmlFor={`link-${roundId}`}>Or share a document link</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={`link-${roundId}`}
            placeholder="https://docs.google.com/document/d/..."
            value={link}
            disabled={locked}
            onChange={(e) => setLink(e.target.value)}
            className="min-w-64 flex-1"
          />
          {!locked && (
            <Button type="submit" disabled={savingLink} variant="outline">
              {savingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save link
            </Button>
          )}
          {submission?.document_link_url && (
            <Button type="button" variant="ghost" asChild>
              <a href={submission.document_link_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Open link
              </a>
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Make sure link sharing is enabled so organizers can view it.</p>
      </form>

      {hasDocument && !locked && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete submission
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes your uploaded file and/or document link for this round. You can submit again while the
                submission window is still open.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                Delete submission
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {!hasDocument && !submission && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UploadCloud className="h-3.5 w-3.5" /> Nothing submitted yet for this round.
        </div>
      )}
    </div>
  );
}
