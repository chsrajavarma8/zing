import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { DocumentList } from "@/components/site/document-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Document } from "@/types/database";

const LABELS: Record<Document["type"], string> = {
  rules: "Rules and regulations",
  submission_instructions: "Round instructions",
  presentation_guidelines: "Presentation guidelines",
  exhibit_request: "Exhibit information",
  organizer_published: "Other documents",
};

export default async function PortalDocumentsPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("event_id", portal.event.id)
    .eq("is_current", true)
    .order("type");

  const docs = (documents as unknown as Document[] | null) ?? [];
  const grouped = docs.reduce<Record<string, Document[]>>((acc, d) => {
    (acc[d.type] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Documents and guidelines</h1>
        <p className="text-muted-foreground">Find the latest organizer-published instructions in one place.</p>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No documents have been published yet.</CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, list]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="text-base">{LABELS[type as Document["type"]] ?? type}</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList documents={list} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
