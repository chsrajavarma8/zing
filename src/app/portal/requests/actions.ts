"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { RequestType, ExhibitDetails } from "@/types/database";

export async function createRequest(
  eventId: string,
  teamId: string,
  type: RequestType,
  subject: string,
  message: string,
  relatedRoundId?: string | null,
  details?: ExhibitDetails,
) {
  if (!subject.trim() || !message.trim()) return { ok: false, error: "Subject and details are required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("requests")
    .insert({
      event_id: eventId,
      team_id: teamId,
      requester_profile_id: user.id,
      type,
      subject: subject.trim(),
      message: message.trim(),
      related_round_id: relatedRoundId || null,
      details: details ?? {},
    })
    .select("id, reference_id")
    .single();

  if (error) return { ok: false, error: "Could not submit request." };
  revalidatePath("/portal/requests");
  const row = data as unknown as { id: string; reference_id: string };
  return { ok: true, requestId: row.id, referenceId: row.reference_id };
}
