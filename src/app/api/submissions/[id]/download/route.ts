import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserContext, isStaff } from "@/lib/auth/session";

// Signed-URL download endpoint for the private `team-submissions` bucket.
// Only the submitting team's own members or event staff for that event may
// download - never public, unlike the "documents" bucket.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: submission } = await admin
    .from("submissions")
    .select("id, team_id, round_id, document_storage_path")
    .eq("id", id)
    .maybeSingle();

  const row = submission as unknown as { id: string; team_id: string; round_id: string; document_storage_path: string | null } | null;
  if (!row || !row.document_storage_path) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: team } = await admin.from("teams").select("event_id").eq("id", row.team_id).maybeSingle();
  const eventId = (team as { event_id: string } | null)?.event_id;

  const isTeamMember = ctx.teamMemberships.some((m) => m.teamId === row.team_id);
  const isEventStaff = Boolean(
    eventId && (ctx.isSuperAdmin || ctx.adminEventIds.includes(eventId) || ctx.reviewerEventIds.includes(eventId)),
  );
  if (!isTeamMember && !(isStaff(ctx) && isEventStaff)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { data: signed, error } = await admin.storage.from("team-submissions").createSignedUrl(row.document_storage_path, 60 * 5);
  if (error || !signed) return NextResponse.json({ error: "Could not generate a download link." }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
