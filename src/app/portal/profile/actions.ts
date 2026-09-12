"use server";

import { createClient } from "@/lib/supabase/server";
import { isGenderOption } from "@/lib/gender";
import { revalidatePath } from "next/cache";

export interface ProfileUpdateInput {
  fullName: string;
  dateOfBirth: string;
  college: string;
  rollNumber: string;
  mobile: string;
  whatsapp: string;
  whatsappSameAsMobile: boolean;
  gender: string;
}

export async function updateMyProfile(memberId: string, input: ProfileUpdateInput) {
  if (input.gender && !isGenderOption(input.gender)) {
    return { ok: false, error: "Choose a valid gender option." };
  }

  const supabase = await createClient();

  // RLS (team_members_update: profile_id = auth.uid()) is the real guard here -
  // this update can only ever touch the caller's own row.
  const { error } = await supabase
    .from("team_members")
    .update({
      full_name: input.fullName,
      date_of_birth: input.dateOfBirth,
      college: input.college,
      roll_number: input.rollNumber,
      mobile: input.mobile,
      whatsapp: input.whatsappSameAsMobile ? input.mobile : input.whatsapp,
      whatsapp_same_as_mobile: input.whatsappSameAsMobile,
      gender: input.gender || null,
    })
    .eq("id", memberId);

  if (error) {
    return { ok: false, error: error.message.includes("duplicate") ? "That college + roll number is already registered." : "Could not save changes." };
  }

  revalidatePath("/portal/profile");
  revalidatePath("/portal");
  return { ok: true };
}
