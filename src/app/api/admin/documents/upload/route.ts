import { NextRequest, NextResponse } from "next/server";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const ALLOWED_TYPES = ["rules", "submission_instructions", "presentation_guidelines", "exhibit_request", "organizer_published"];

export async function POST(req: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const title = String(form.get("title") ?? "").trim();
  const type = String(form.get("type") ?? "");

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(type)) return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "File must be under 25 MB." }, { status: 400 });

  const admin = createAdminClient();
  const path = `${ctx.event.id}/${type}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadError } = await admin.storage.from("documents").upload(path, file, { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: "Upload failed." }, { status: 500 });

  const { error: insertError } = await admin.from("documents").insert({
    event_id: ctx.event.id,
    title,
    type,
    storage_path: path,
    version: 1,
    is_current: true,
    published_at: new Date().toISOString(),
    created_by: ctx.user.userId,
  });

  if (insertError) return NextResponse.json({ error: "Could not save document record." }, { status: 500 });

  await logAudit({ actorProfileId: ctx.user.userId, eventId: ctx.event.id, action: "upload_document", entityType: "documents", entityId: path, after: { title, type } });

  return NextResponse.json({ ok: true });
}
