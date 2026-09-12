import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserContext, isStaff } from "@/lib/auth/session";

// Signed-URL download endpoint for the private `documents` storage bucket.
// Public documents (is_current) are downloadable by anyone; older versions
// require staff access to the document's event.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documents")
    .select("id, event_id, storage_path, external_url, is_current")
    .eq("id", id)
    .maybeSingle();

  const docRow = doc as unknown as {
    id: string;
    event_id: string;
    storage_path: string | null;
    external_url: string | null;
    is_current: boolean;
  } | null;

  if (!docRow) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (!docRow.is_current) {
    const ctx = await getUserContext();
    const staff = isStaff(ctx) && (ctx?.isSuperAdmin || ctx?.adminEventIds.includes(docRow.event_id) || ctx?.reviewerEventIds.includes(docRow.event_id));
    if (!staff) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (docRow.external_url) {
    return NextResponse.redirect(docRow.external_url);
  }

  if (!docRow.storage_path) {
    return NextResponse.json({ error: "This document has no file attached." }, { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("documents")
    .createSignedUrl(docRow.storage_path, 60 * 5);

  if (error || !signed) {
    return NextResponse.json({ error: "Could not generate a download link." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
