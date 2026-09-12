"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePasswordChanged } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

const DRIVE_URL_RE = /^https:\/\/drive\.google\.com\/(drive\/folders\/|open\?id=)[A-Za-z0-9_-]+/;

export interface SubmissionInput {
  teamId: string;
  roundId: string;
  driveFolderUrl: string;
  checklist: Record<string, boolean>;
  publicAccessSelfConfirmed: boolean;
}

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

  const { data: round } = await supabase.from("rounds").select("ends_at").eq("id", input.roundId).maybeSingle();
  const endsAt = (round as unknown as { ends_at: string | null } | null)?.ends_at;
  if (endsAt && Date.now() > Date.parse(endsAt)) {
    return { ok: false, error: "The submission deadline for this round has passed." };
  }

  // RLS submissions_insert/update requires the caller to be the team's lead.
  const { error } = await supabase.from("submissions").upsert(
    {
      team_id: input.teamId,
      round_id: input.roundId,
      drive_folder_url: input.driveFolderUrl.trim(),
      checklist: input.checklist,
      public_access_self_confirmed: input.publicAccessSelfConfirmed,
      review_status: "pending",
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "team_id,round_id" },
  );

  if (error) return { ok: false, error: "Could not save submission. Please try again." };

  revalidatePath("/portal/submission");
  revalidatePath("/portal");
  return { ok: true };
}
