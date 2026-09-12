import { NextRequest, NextResponse } from "next/server";
import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File must be under 5 MB." }, { status: 400 });

  const admin = createAdminClient();
  const path = `${ctx.event.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;

  const { error: uploadError } = await admin.storage.from("branding").upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: "Upload failed." }, { status: 500 });

  const { data: pub } = admin.storage.from("branding").getPublicUrl(path);

  const { data: event } = await admin.from("events").select("branding").eq("id", ctx.event.id).maybeSingle();
  const existingBranding = (event as unknown as { branding: Record<string, unknown> } | null)?.branding ?? {};

  await admin
    .from("events")
    .update({ branding: { ...existingBranding, logo_url: pub.publicUrl } })
    .eq("id", ctx.event.id);

  await logAudit({ actorProfileId: ctx.user.userId, eventId: ctx.event.id, action: "upload_branding_logo", entityType: "events", entityId: ctx.event.id });

  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
