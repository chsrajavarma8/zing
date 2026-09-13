"use server";

import { createClient } from "@/lib/supabase/server";
import { isGenderOption } from "@/lib/gender";
import { isValidPhone, normalizePhoneInput, PHONE_VALIDATION_MESSAGE } from "@/lib/phone";
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

  // Never trust the client alone here: this action, unlike registration, has
  // no zod schema in front of it - a request built by hand (or a client bug
  // that skips the form's own check) must still be rejected server-side.
  const mobile = normalizePhoneInput(input.mobile);
  if (!isValidPhone(mobile)) {
    return { ok: false, error: PHONE_VALIDATION_MESSAGE };
  }
  const whatsapp = input.whatsappSameAsMobile ? mobile : normalizePhoneInput(input.whatsapp);
  if (!input.whatsappSameAsMobile && !isValidPhone(whatsapp)) {
    return { ok: false, error: `WhatsApp: ${PHONE_VALIDATION_MESSAGE}` };
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
      mobile,
      whatsapp,
      whatsapp_same_as_mobile: input.whatsappSameAsMobile,
      gender: input.gender || null,
    })
    .eq("id", memberId);

  if (error) {
    if (error.message.includes("team_members_mobile_normalized_idx")) {
      return { ok: false, error: "This mobile number is already registered with another participant." };
    }
    return { ok: false, error: error.message.includes("duplicate") ? "That college + roll number is already registered." : "Could not save changes." };
  }

  revalidatePath("/portal/profile");
  revalidatePath("/portal");
  return { ok: true };
}
