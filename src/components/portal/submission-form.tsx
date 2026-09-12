"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Lock, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { saveSubmission } from "@/app/portal/submission/actions";
import { track } from "@/lib/analytics";
import type { Submission } from "@/types/database";

const CHECKLIST_ITEMS = [
  { key: "presentation", label: "Presentation" },
  { key: "screenshots", label: "Screenshots" },
  { key: "demoVideo", label: "Demo video" },
  { key: "codebase", label: "Codebase" },
  { key: "readme", label: "README" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accessible: "secondary",
  access_issue: "destructive",
  accepted: "default",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  accessible: "Accessible",
  access_issue: "Access issue",
  accepted: "Accepted",
};

export function SubmissionForm({
  teamId,
  roundId,
  submission,
  canEdit,
  deadlinePassed,
}: {
  teamId: string;
  roundId: string;
  submission: Submission | null;
  canEdit: boolean;
  deadlinePassed: boolean;
}) {
  const [url, setUrl] = useState(submission?.drive_folder_url ?? "");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    (submission?.checklist as Record<string, boolean>) ?? {},
  );
  const [confirmed, setConfirmed] = useState(submission?.public_access_self_confirmed ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = !canEdit || deadlinePassed;

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
              Last updated {new Date(submission.updated_at).toLocaleString()}
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

      {submission?.review_status === "access_issue" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access issue</AlertTitle>
          <AlertDescription>
            {submission.reviewer_notes ||
              "The organizers could not access one or more required materials. Review the feedback and update access permissions."}
          </AlertDescription>
        </Alert>
      )}

      {locked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            {deadlinePassed
              ? "The submission deadline has passed. Contact the organizers if you need assistance."
              : "Only the team lead can submit or update this link."}
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
        </div>
      </form>
    </div>
  );
}
