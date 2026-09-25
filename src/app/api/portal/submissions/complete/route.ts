import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeSubmissionFileAccess } from "@/lib/submission-access";
import { verifyStoredUpload } from "@/lib/storage-verify";
import { isPathUnder, MAX_SUBMISSION_BYTES, SUBMISSION_TYPES } from "@/lib/uploads";

const BUCKET = "team-submissions";

// Step 2 of a submission upload: re-authorize, confirm the object sits at a
// path this team/round was issued, verify its real size and content
// (RISK-008), record it, and only then remove the team's previous file and
// any abandoned uploads in the same folder.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { teamId?: unknown; roundId?: unknown; path?: unknown; fileName?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const access = await authorizeSubmissionFileAccess(body.teamId, body.roundId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const path = typeof body.path === "string" ? body.path : "";
  const folder = `${access.teamId}/${access.roundId}`;
  if (!isPathUnder(path, folder)) return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });

  const verified = await verifyStoredUpload({ bucket: BUCKET, path, allowed: SUBMISSION_TYPES, maxBytes: MAX_SUBMISSION_BYTES });
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

  const admin = createAdminClient();
  const fileName = typeof body.fileName === "string" && body.fileName.trim() ? body.fileName.trim().slice(0, 200) : path.split("/").pop()!;

  const { error: upsertError } = await admin.from("submissions").upsert(
    {
      team_id: access.teamId,
      round_id: access.roundId,
      document_storage_path: path,
      file_name: fileName,
      file_size: verified.size,
      mime_type: verified.mime,
      review_status: "pending_review",
      submitted_by: access.userId,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "team_id,round_id" },
  );

  if (upsertError) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "Could not save submission record." }, { status: 500 });
  }

  // The new file is recorded; everything else in this team/round folder
  // (the previous file, abandoned uploads) is now unreferenced.
  const { data: objects } = await admin.storage.from(BUCKET).list(folder, { limit: 100 });
  const stale = (objects ?? []).map((o) => `${folder}/${o.name}`).filter((p) => p !== path);
  if (stale.length > 0) {
    const { error: cleanupError } = await admin.storage.from(BUCKET).remove(stale);
    if (cleanupError) console.error("[submissions/complete] stale file cleanup failed:", cleanupError.message);
  }

  return NextResponse.json({ ok: true, fileName });
}
