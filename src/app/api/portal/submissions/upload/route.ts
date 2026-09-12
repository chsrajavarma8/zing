import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePasswordChanged } from "@/lib/auth/guards";
import { submissionUnavailableReason } from "@/lib/rounds";

// Accepted document types for round submissions (Talent Round and beyond) -
// mirrors the `team-submissions` bucket's allowed_mime_types
// (0025_submission_documents.sql), checked again here server-side since the
// bucket-level allow-list alone would only reject at upload time with a
// generic storage error, not a clear message.
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
];
const ALLOWED_LABEL = "PDF, DOC, DOCX, PPT, PPTX, PNG, or JPEG";
const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const teamId = String(form.get("teamId") ?? "");
  const roundId = String(form.get("roundId") ?? "");
  if (!file || !teamId || !roundId) {
    return NextResponse.json({ error: "Missing file, team, or round." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type. Upload a ${ALLOWED_LABEL} file.` }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be under 25 MB." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Authorization and timing are re-checked here with the service role,
  // never trusted from the client - the same boundary the RLS policies
  // enforce (can_submit_for_team + round window), kept in sync manually
  // since this route bypasses RLS by using the service-role client.
  const { data: member } = await admin
    .from("team_members")
    .select("id, role")
    .eq("profile_id", user.id)
    .eq("team_id", teamId)
    .maybeSingle();
  const m = member as { id: string; role: string } | null;
  if (!m) return NextResponse.json({ error: "You are not a member of this team." }, { status: 403 });

  const { data: team } = await admin.from("teams").select("submission_delegate_member_id").eq("id", teamId).maybeSingle();
  const isDelegate = (team as { submission_delegate_member_id: string | null } | null)?.submission_delegate_member_id === m.id;
  if (m.role !== "lead" && !isDelegate) {
    return NextResponse.json({ error: "Only the team lead or the delegated member can submit for this team." }, { status: 403 });
  }

  const { data: round } = await admin.from("rounds").select("id, is_active, starts_at, ends_at").eq("id", roundId).maybeSingle();
  const r = round as { id: string; is_active: boolean; starts_at: string | null; ends_at: string | null } | null;
  if (!r) return NextResponse.json({ error: "Round not found." }, { status: 404 });
  const unavailableReason = submissionUnavailableReason(r);
  if (unavailableReason) {
    return NextResponse.json({ error: unavailableReason }, { status: 403 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
  const path = `${teamId}/${roundId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await admin.storage.from("team-submissions").upload(path, file, { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });

  const { data: existing } = await admin
    .from("submissions")
    .select("document_storage_path")
    .eq("team_id", teamId)
    .eq("round_id", roundId)
    .maybeSingle();
  const previousPath = (existing as { document_storage_path: string | null } | null)?.document_storage_path;

  const { error: upsertError } = await admin.from("submissions").upsert(
    {
      team_id: teamId,
      round_id: roundId,
      document_storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      review_status: "pending_review",
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "team_id,round_id" },
  );

  if (upsertError) {
    await admin.storage.from("team-submissions").remove([path]);
    return NextResponse.json({ error: "Could not save submission record." }, { status: 500 });
  }

  if (previousPath && previousPath !== path) {
    await admin.storage.from("team-submissions").remove([previousPath]);
  }

  return NextResponse.json({ ok: true, fileName: file.name });
}
