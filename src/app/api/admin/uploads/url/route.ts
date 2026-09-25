import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireManager } from "@/lib/auth/admin-guards";
import {
  BRANDING_TYPES,
  DOCUMENT_TYPES,
  MAX_BRANDING_BYTES,
  MAX_DOCUMENT_BYTES,
  matchAllowedType,
  sanitizeFileName,
} from "@/lib/uploads";

// Admin uploads (organizer documents up to 25 MB, branding up to 5 MB) go
// straight to Storage through a single-path signed URL (RISK-001); see
// ../complete for verification. Only event admins / super admins.
export async function POST(req: NextRequest) {
  const guard = await requireManager();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });
  const { ctx } = guard;

  const body = (await req.json().catch(() => null)) as
    | { kind?: unknown; fileName?: unknown; fileType?: unknown; fileSize?: unknown; docType?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const kind = body.kind === "branding" ? "branding" : body.kind === "document" ? "document" : null;
  if (!kind) return NextResponse.json({ error: "Unknown upload kind." }, { status: 400 });

  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileType = typeof body.fileType === "string" ? body.fileType : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : -1;
  const allowed = kind === "branding" ? BRANDING_TYPES : DOCUMENT_TYPES;
  const max = kind === "branding" ? MAX_BRANDING_BYTES : MAX_DOCUMENT_BYTES;

  const type = matchAllowedType(allowed, fileName, fileType);
  if (!type) {
    return NextResponse.json(
      { error: kind === "branding" ? "Upload a PNG, JPEG, or WebP image." : "Upload a PDF, PNG, or JPEG file." },
      { status: 400 },
    );
  }
  if (!(fileSize > 0) || fileSize > max) {
    return NextResponse.json({ error: `File must be under ${Math.round(max / (1024 * 1024))} MB.` }, { status: 400 });
  }

  const bucket = kind === "branding" ? "branding" : "documents";
  const path =
    kind === "branding"
      ? `${ctx.event.id}/logo-${randomUUID()}.${type.extensions[0]}`
      : `${ctx.event.id}/uploads/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });

  return NextResponse.json({ path: data.path, token: data.token, bucket });
}
