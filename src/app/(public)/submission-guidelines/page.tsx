import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/site/page-header";
import { DocumentList } from "@/components/site/document-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Reveal, StaggerReveal } from "@/components/motion/reveal";
import { FolderOpen, ShieldAlert, Clock, CheckCircle2, FileStack, Eye, Link2, ArrowRight } from "lucide-react";
import type { Document } from "@/types/database";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Submission Guidelines",
  description: "How to prepare and submit your project for Zing Hackathon using one public Google Drive folder.",
  path: "/submission-guidelines",
});

const CHECKLIST = ["Presentation slides", "Project screenshots", "Demo video", "Codebase", "README or project documentation", "Additional round-specific materials, if requested"];

const STEPS = [
  "Create your project folder in Google Drive.",
  "Add all required materials.",
  'Set General access to "Anyone with the link."',
  'Select "Viewer" access.',
  "Check that the folder and required files open without requesting permission.",
  "Paste the folder link into your participant portal.",
  "Save it before the published deadline.",
];

export default async function SubmissionGuidelinesPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("event_id", event.id)
    .eq("type", "submission_instructions")
    .eq("is_current", true);

  return (
    <main>
      <PageHeader
        eyebrow="Final submission"
        title="Your complete submission, in one link."
        description="Create one Google Drive folder for your team and include all required project materials."
      />

      {/* Visual sequence: the three-step mental model, before the detailed
          checklist/instructions below. */}
      <div className="border-b border-primary/12 bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
            <StaggerReveal step={0.1} className="contents">
              {[
                { icon: FileStack, label: "Prepare materials" },
                { icon: Eye, label: "Set public viewer access" },
                { icon: Link2, label: "Submit one Drive folder link" },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-6">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-ivory text-primary">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <p className="max-w-[9rem] font-heading text-base font-semibold">{step.label}</p>
                  </div>
                  {i < 2 && <ArrowRight className="hidden h-5 w-5 shrink-0 text-primary/40 sm:block" aria-hidden />}
                </div>
              ))}
            </StaggerReveal>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-16 sm:px-6">
        <Card className="card-glow border-primary/30">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading">Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <FolderOpen className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-2 text-base text-muted-foreground">
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Keep the folder clean</AlertTitle>
          <AlertDescription>
            Include project materials only. Remove passwords, API keys, confidential information, and private
            participant details.
          </AlertDescription>
        </Alert>

        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access notice</AlertTitle>
          <AlertDescription>
            A valid Google Drive URL does not automatically confirm public access. Organizers may flag inaccessible
            submissions for correction.
          </AlertDescription>
        </Alert>

        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Deadline notice</AlertTitle>
          <AlertDescription>
            Saving a folder link does not lock its contents. Follow the published rules for changes after the
            deadline.
          </AlertDescription>
        </Alert>

        {documents && documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Downloadable instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList documents={documents as unknown as Document[]} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
