import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeSubmissionFileAccess } from "@/lib/submission-access";
import { matchAllowedType, sanitizeFileName, MAX_SUBMISSION_BYTES, SUBMISSION_TYPES } from "@/lib/uploads";
import { sharedRateLimit } from "@/lib/rate-limit";

// Step 1 of a submission upload (RISK-001): after authorizing the caller,
// issue a short-lived signed URL scoped to exactly one server-chosen object
// path. The browser then uploads straight to Supabase Storage, so the file
// never passes through a Vercel Function (4.5 MB request-body limit). The
// bucket's own file_size_limit/allowed_mime_types still apply to that upload.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { teamId?: unknown; roundId?: unknown; fileName?: unknown; fileType?: unknown; fileSize?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const access = await authorizeSubmissionFileAccess(body.teamId, body.roundId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const limited = await sharedRateLimit(`upload-url:${access.userId}`, 30, 10 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: "Too many upload attempts. Please wait a few minutes." }, { status: 429 });

  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileType = typeof body.fileType === "string" ? body.fileType : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : -1;

  if (!matchAllowedType(SUBMISSION_TYPES, fileName, fileType)) {
    return NextResponse.json({ error: "Unsupported file type. Upload a PDF, DOC, DOCX, PPT, PPTX, PNG, or JPEG file." }, { status: 400 });
  }
  if (!(fileSize > 0) || fileSize > MAX_SUBMISSION_BYTES) {
    return NextResponse.json({ error: "File must be under 25 MB." }, { status: 400 });
  }

  const path = `${access.teamId}/${access.roundId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("team-submissions").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });

  return NextResponse.json({ path: data.path, token: data.token });
}
