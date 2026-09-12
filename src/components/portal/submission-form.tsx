"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Lock, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveSubmission, deleteSubmission } from "@/app/portal/submission/actions";
import { track } from "@/lib/analytics";
import { formatDateTime } from "@/lib/date";
import type { Submission } from "@/types/database";

const CHECKLIST_ITEMS = [
  { key: "presentation", label: "Presentation" },
  { key: "screenshots", label: "Screenshots" },
  { key: "demoVideo", label: "Demo video" },
  { key: "codebase", label: "Codebase" },
  { key: "readme", label: "README" },
];

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

export function SubmissionForm({
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
  const [url, setUrl] = useState(submission?.drive_folder_url ?? "");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    (submission?.checklist as Record<string, boolean>) ?? {},
  );
  const [confirmed, setConfirmed] = useState(submission?.public_access_self_confirmed ?? false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = !canEdit || !windowOpen;

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
    setUrl("");
    setChecklist({});
    setConfirmed(false);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await saveSubmission({
      teamId,
      roundId,
      driveFolderUrl: url,
      checklist,
      publicAccessSelfConfirmed: confirmed,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save.");
      track({
        name: "form_failed",
        props: { form: "submission", reason: result.error?.includes("deadline") ? "deadline_passed" : "validation" },
      });
      return;
    }
    track({ name: "submission_saved", props: { roundKey: roundId } });
    toast.success("Your submission link has been saved.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!submission && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Review status:</span>
          <Badge variant="outline">Not submitted</Badge>
        </div>
      )}
      {submission && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Review status:</span>
          <Badge variant={STATUS_VARIANT[submission.review_status]}>{STATUS_LABEL[submission.review_status]}</Badge>
          {submission.updated_at && (
            <span className="text-xs text-muted-foreground">
              Last updated {formatDateTime(submission.updated_at)}
            </span>
          )}
          {submission.drive_folder_url && (
            <a
              href={submission.drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary underline underline-offset-4"
            >
              Open folder <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

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
            {unavailableReason ?? "Only the team lead or the delegated submitter can submit or update this link."}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <FolderOpen className="h-4 w-4" />
          <AlertDescription>
            Set your Google Drive folder to &ldquo;Anyone with the link: Viewer&rdquo;. Include all required
            project materials in this one folder and check that the files open without requesting access.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor={`drive-${roundId}`}>Google Drive folder link</Label>
          <Input
            id={`drive-${roundId}`}
            placeholder="https://drive.google.com/drive/folders/..."
            value={url}
            disabled={locked}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Checklist</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <Checkbox
                  id={`${roundId}-${item.key}`}
                  disabled={locked}
                  checked={Boolean(checklist[item.key])}
                  onCheckedChange={(v) => setChecklist((c) => ({ ...c, [item.key]: Boolean(v) }))}
                />
                <Label htmlFor={`${roundId}-${item.key}`} className="font-normal">
                  {item.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-2">
          <Checkbox id={`confirm-${roundId}`} disabled={locked} checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} />
          <Label htmlFor={`confirm-${roundId}`} className="font-normal">
            I have checked that the folder and required files are accessible to anyone with the link.
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          A valid Google Drive URL does not automatically confirm public access. Organizers may flag inaccessible
          submissions for correction.
        </p>

        <div className="flex flex-wrap gap-2">
          {!locked && (
            <Button type="submit" disabled={busy} className="glow-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submission?.drive_folder_url ? "Update link" : "Save submission"}
            </Button>
          )}
          {submission?.drive_folder_url && (
            <Button type="button" variant="outline" asChild>
              <a href={submission.drive_folder_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Open folder
              </a>
            </Button>
          )}
          {submission && !locked && (
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
                    This removes your saved submission link for this round. You can submit again while the
                    submission window is still open.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Delete submission
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>
    </div>
  );
}
