import { PageHeader } from "@/components/site/page-header";
import { Markdown } from "@/components/site/markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { formatDateLong } from "@/lib/date";

interface Policy {
  version: string;
  content_markdown: string;
  published_at: string | null;
}

export function PolicyPage({ eyebrow, title, policy }: { eyebrow: string; title: string; policy: Policy | null }) {
  const isDraft = policy?.version?.startsWith("draft");
  const description = policy
    ? `Version ${policy.version}${policy.published_at ? ` · Effective ${formatDateLong(policy.published_at)}` : ""}`
    : undefined;

  return (
    <main>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {isDraft && (
          <Alert className="mb-6" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Draft: pending organizer review</AlertTitle>
            <AlertDescription>
              This document has not been finalized or legally approved yet. Organizers should review and publish a
              final version from the admin panel before launch.
            </AlertDescription>
          </Alert>
        )}
        {policy ? <Markdown>{policy.content_markdown}</Markdown> : <p className="text-muted-foreground">Not published yet.</p>}
      </div>
    </main>
  );
}
