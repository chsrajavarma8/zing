import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { DocumentUploadForm } from "@/components/admin/document-upload-form";
import { DocumentRow } from "@/components/admin/document-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Document } from "@/types/database";

export default async function AdminDocumentsPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: documents } = await supabase.from("documents").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground">Rules, submission instructions, presentation guidelines, and other files.</p>
      </div>

      {canManage(ctx) && <DocumentUploadForm />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {((documents as unknown as Document[] | null) ?? []).map((d) => (
            <DocumentRow key={d.id} document={d} canManage={canManage(ctx)} />
          ))}
          {(!documents || documents.length === 0) && <p className="text-center text-muted-foreground py-6">No documents uploaded yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
