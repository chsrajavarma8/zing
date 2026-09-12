"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sendAccountSetupLink, generateInviteToken } from "@/lib/auth/provisioning";
import { revalidatePath } from "next/cache";

export async function inviteAdmin(eventId: string, email: string, role: "event_admin" | "reviewer") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const trimmedEmail = email.toLowerCase().trim();
  const token = generateInviteToken();
  const { error } = await supabase
    .from("admin_invites")
    .insert({ email: trimmedEmail, scope: "event", event_id: eventId, role, invited_by: user.id, token });
  if (error) return { ok: false, error: error.message };

  // Sends them a secure link to set their own password. The role is granted
  // only when they complete acceptAdminInvite() with this exact token from
  // an authenticated session matching this email - never by profile
  // creation alone (see 0018_admin_invite_tokens.sql).
  await sendAccountSetupLink(trimmedEmail, token);

  await logAudit({ actorProfileId: user.id, eventId, action: "invite_admin", entityType: "admin_invites", after: { email: trimmedEmail, role } });
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function revokeEventAdmin(eventAdminId: string, eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("event_admins").delete().eq("id", eventAdminId);
  if (error) return { ok: false, error: "Could not revoke access." };

  await logAudit({ actorProfileId: user.id, eventId, action: "revoke_admin", entityType: "event_admins", entityId: eventAdminId });
  revalidatePath("/admin/roles");
  return { ok: true };
}
