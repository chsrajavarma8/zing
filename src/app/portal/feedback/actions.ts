"use server";

import { createClient } from "@/lib/supabase/server";

export interface FeedbackInput {
  overallRating: number;
  registrationExperienceRating: number;
  portalUsabilityRating: number;
  communicationRating: number;
  whatWorkedWell: string;
  whatCouldImprove: string;
}

export async function submitFeedback(eventId: string, teamId: string, input: FeedbackInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("feedback").insert({
    event_id: eventId,
    team_id: teamId,
    profile_id: user.id,
    rating: input.overallRating,
    registration_experience_rating: input.registrationExperienceRating,
    portal_usability_rating: input.portalUsabilityRating,
    communication_rating: input.communicationRating,
    what_worked_well: input.whatWorkedWell.trim() || null,
    what_could_improve: input.whatCouldImprove.trim() || null,
  });

  if (error) return { ok: false, error: "Could not submit feedback." };
  return { ok: true };
}
