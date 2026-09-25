import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireManager } from "@/lib/auth/admin-guards";
import { logAudit } from "@/lib/audit";
import { verifyStoredUpload } from "@/lib/storage-verify";
import { BRANDING_TYPES, DOCUMENT_TYPES, MAX_BRANDING_BYTES, MAX_DOCUMENT_BYTES } from "@/lib/uploads";

const DOC_TYPES = ["rules", "submission_instructions", "presentation_guidelines", "exhibit_request", "organizer_published"];

// Verifies an admin upload (real size + content signature, RISK-008) and
// records it. Paths must be ones ../url could have issued for this event.
export async function POST(req: NextRequest) {
  const guard = await requireManager();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });
  const { ctx } = guard;

  const body = (await req.json().catch(() => null)) as
    | { kind?: unknown; path?: unknown; title?: unknown; docType?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const path = typeof body.path === "string" ? body.path : "";
  const admin = createAdminClient();

  if (body.kind === "branding") {
    if (!/^[0-9a-f-]{36}\/logo-[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path) || !path.startsWith(`${ctx.event.id}/`)) {
      return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
    }
    const verified = await verifyStoredUpload({ bucket: "branding", path, allowed: BRANDING_TYPES, maxBytes: MAX_BRANDING_BYTES });
    if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

    const { data: pub } = admin.storage.from("branding").getPublicUrl(path);
    const { data: event, error: readError } = await admin.from("events").select("branding").eq("id", ctx.event.id).maybeSingle();
    if (readError) return NextResponse.json({ error: "Could not save the logo." }, { status: 500 });
    const existing = ((event as { branding: Record<string, unknown> } | null)?.branding ?? {}) as Record<string, unknown>;
    const { data: updated, error } = await admin
      .from("events")
      .update({ branding: { ...existing, logo_url: pub.publicUrl } })
      .eq("id", ctx.event.id)
      .select("id");
    if (error || !updated?.length) {
      await admin.storage.from("branding").remove([path]);
      return NextResponse.json({ error: "Could not save the logo." }, { status: 500 });
    }
    await logAudit({ actorProfileId: ctx.user.userId, eventId: ctx.event.id, action: "upload_branding_logo", entityType: "events", entityId: ctx.event.id });
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  }

  if (body.kind === "document") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const docType = typeof body.docType === "string" ? body.docType : "";
    if (!title || title.length > 200) return NextResponse.json({ error: "Title is required (up to 200 characters)." }, { status: 400 });
    if (!DOC_TYPES.includes(docType)) return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
    if (!path.startsWith(`${ctx.event.id}/uploads/`) || path.includes("..") || path.split("/").length !== 3) {
      return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
    }
    const verified = await verifyStoredUpload({ bucket: "documents", path, allowed: DOCUMENT_TYPES, maxBytes: MAX_DOCUMENT_BYTES });
    if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

    const { error } = await admin.from("documents").insert({
      event_id: ctx.event.id,
      title,
      type: docType,
      storage_path: path,
      version: 1,
      is_current: true,
      published_at: new Date().toISOString(),
      created_by: ctx.user.userId,
    });
    if (error) {
      await admin.storage.from("documents").remove([path]);
      return NextResponse.json({ error: "Could not save document record." }, { status: 500 });
    }
    await logAudit({ actorProfileId: ctx.user.userId, eventId: ctx.event.id, action: "upload_document", entityType: "documents", entityId: path, after: { title, type: docType } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown upload kind." }, { status: 400 });
}
