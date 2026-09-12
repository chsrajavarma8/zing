"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePasswordChanged } from "@/lib/auth/guards";
import { submissionUnavailableReason } from "@/lib/rounds";
import { revalidatePath } from "next/cache";

const DRIVE_URL_RE = /^https:\/\/drive\.google\.com\/(drive\/folders\/|open\?id=)[A-Za-z0-9_-]+/;

// Format-only validation, deliberately no server-side fetch of the
// participant-supplied link (see security review, req. #15) - just reject
// anything that isn't a well-formed https URL, which also rules out
// javascript:/data: and other unsafe schemes.
function isValidHttpsUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

async function assertRoundWindowOpen(roundId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: round } = await supabase.from("rounds").select("is_active, starts_at, ends_at").eq("id", roundId).maybeSingle();
  const r = round as unknown as { is_active: boolean; starts_at: string | null; ends_at: string | null } | null;
  if (!r) return { ok: false, error: "Round not found." };
  const reason = submissionUnavailableReason(r);
  if (reason) return { ok: false, error: reason };
  return { ok: true };
}

export interface SubmissionInput {
  teamId: string;
  roundId: string;
  driveFolderUrl: string;
  checklist: Record<string, boolean>;
  publicAccessSelfConfirmed: boolean;
}

// Intermediate/Major rounds: one public Google Drive folder link + checklist.
export async function saveSubmission(input: SubmissionInput) {
  if (!DRIVE_URL_RE.test(input.driveFolderUrl.trim())) {
    return { ok: false, error: "Enter a valid Google Drive folder link (https://drive.google.com/drive/folders/...)." };
  }
  if (!input.publicAccessSelfConfirmed) {
    return { ok: false, error: "Confirm that the folder is shared with \"Anyone with the link\" (Viewer) before submitting." };
  }

  const supabase = await createClient();

  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const windowCheck = await assertRoundWindowOpen(input.roundId);
  if (!windowCheck.ok) return windowCheck;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS submissions_insert/update requires the caller to be the team's lead
  // or its delegated submitter (can_submit_for_team, 0022_...sql).
  const { error } = await supabase.from("submissions").upsert(
    {
      team_id: input.teamId,
      round_id: input.roundId,
      drive_folder_url: input.driveFolderUrl.trim(),
      checklist: input.checklist,
      public_access_self_confirmed: input.publicAccessSelfConfirmed,
      review_status: "pending_review",
      submitted_by: user?.id ?? null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "team_id,round_id" },
  );

  if (error) return { ok: false, error: "Could not save submission. Please try again." };

  revalidatePath("/portal/submission");
  revalidatePath("/portal");
  return { ok: true };
}

// Talent Round (and any other document-based round): a shareable document
// link (e.g. Google Docs), independent of any uploaded file - a team may
// provide either or both. File upload itself goes through
// /api/portal/submissions/upload (multipart, can't go through a server
// action), this action only handles the link half plus checklist-free save.
export async function saveDocumentLink(teamId: string, roundId: string, documentLinkUrl: string) {
  const trimmed = documentLinkUrl.trim();
  if (trimmed && !isValidHttpsUrl(trimmed)) {
    return { ok: false, error: "Enter a valid https:// document link." };
  }

  const supabase = await createClient();

  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const windowCheck = await assertRoundWindowOpen(roundId);
  if (!windowCheck.ok) return windowCheck;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("submissions").upsert(
    {
      team_id: teamId,
      round_id: roundId,
      document_link_url: trimmed || null,
      review_status: "pending_review",
      submitted_by: user?.id ?? null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "team_id,round_id" },
  );

  if (error) return { ok: false, error: "Could not save submission. Please try again." };

  revalidatePath("/portal/submission");
  revalidatePath("/portal");
  return { ok: true };
}

// Req. #11: authorised users may delete their team's submission only while
// the round's submission window is still open - enforced here (app layer)
// and by RLS (submissions_delete, 0022_...sql) plus the DB-level deadline
// check inside protect_submission_fields (0017_security_hardening.sql),
// which fires on every insert/update but not delete, so the window check
// here is the deadline backstop for deletion specifically.
export async function deleteSubmission(submissionId: string, teamId: string, roundId: string) {
  const supabase = await createClient();

  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, error: guard.error };

  const windowCheck = await assertRoundWindowOpen(roundId);
  if (!windowCheck.ok) return windowCheck;

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, team_id, document_storage_path")
    .eq("id", submissionId)
    .maybeSingle();
  const row = submission as unknown as { id: string; team_id: string; document_storage_path: string | null } | null;
  if (!row || row.team_id !== teamId) return { ok: false, error: "Submission not found." };

  // RLS submissions_delete requires the caller to be the team's lead or
  // delegated submitter (or staff).
  const { error } = await supabase.from("submissions").delete().eq("id", submissionId);
  if (error) return { ok: false, error: "Could not delete submission." };

  if (row.document_storage_path) {
    const admin = createAdminClient();
    await admin.storage.from("team-submissions").remove([row.document_storage_path]);
  }

  revalidatePath("/portal/submission");
  revalidatePath("/portal");
  return { ok: true };
}
