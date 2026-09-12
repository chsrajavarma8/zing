import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PolicyPage } from "@/components/site/policy-page";
import { DocumentList } from "@/components/site/document-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Document } from "@/types/database";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Rules and Regulations",
  description: "Read the rules and regulations for participating in Zing Hackathon by Skillglider.",
  path: "/rules",
});

export default async function RulesPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const [{ data: policy }, { data: documents }] = await Promise.all([
    supabase
      .from("policy_versions")
      .select("version, content_markdown, published_at")
      .eq("event_id", event.id)
      .eq("type", "rules")
      .eq("is_current", true)
      .maybeSingle(),
    supabase.from("documents").select("*").eq("event_id", event.id).eq("type", "rules").eq("is_current", true),
  ]);

  return (
    <>
      <PolicyPage eyebrow="Play fair" title="Zing Hackathon Rules and Regulations" policy={policy as { version: string; content_markdown: string; published_at: string | null } | null} />
      {documents && documents.length > 0 && (
        <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Downloadable documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList documents={documents as unknown as Document[]} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
