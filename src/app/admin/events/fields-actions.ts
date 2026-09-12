"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface RegistrationFieldInput {
  id?: string;
  key: string;
  label: string;
  fieldType: "text" | "textarea" | "select" | "checkbox" | "number" | "date";
  required: boolean;
  options: string[];
  orderIndex: number;
  active: boolean;
}

export async function upsertRegistrationField(eventId: string, input: RegistrationFieldInput) {
  const supabase = await createClient();
  const payload = {
    event_id: eventId,
    key: input.key.trim().toLowerCase().replace(/\s+/g, "_"),
    label: input.label,
    field_type: input.fieldType,
    required: input.required,
    options: input.options,
    order_index: input.orderIndex,
    active: input.active,
    applies_to: "team",
  };

  const { error } = input.id
    ? await supabase.from("registration_fields").update(payload).eq("id", input.id)
    : await supabase.from("registration_fields").insert(payload);

  if (error) return { ok: false, error: error.message.includes("duplicate") ? "A field with that key already exists." : "Could not save field." };
  revalidatePath("/admin/events");
  revalidatePath("/register");
  return { ok: true };
}

export async function deleteRegistrationField(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("registration_fields").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete." };
  revalidatePath("/admin/events");
  revalidatePath("/register");
  return { ok: true };
}
