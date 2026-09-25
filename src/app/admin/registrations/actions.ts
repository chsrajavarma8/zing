"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireManager, requireStaff } from "@/lib/auth/admin-guards";
import { logAudit } from "@/lib/audit";
import { loadFilteredMembers, parseRegistrationFilter, sortByTeam, TEAM_STATUSES, type TeamStatus } from "@/lib/admin/registration-filters";
import { revalidatePath } from "next/cache";

const MAX_BULK = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setTeamsStatus(
  teamIds: string[],
  eventId: string,
  status: TeamStatus,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;
  if (!TEAM_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };

  const ids = [...new Set(Array.isArray(teamIds) ? teamIds : [])].filter((id) => typeof id === "string" && UUID.test(id));
  if (ids.length === 0) return { ok: false, error: "Select at least one team." };
  if (ids.length > MAX_BULK) return { ok: false, error: `You can update at most ${MAX_BULK} teams at once.` };

  const supabase = await createClient();
  const { data: before } = await supabase.from("teams").select("id, status").in("id", ids).eq("event_id", eventId);
  const { data, error } = await supabase.from("teams").update({ status }).in("id", ids).eq("event_id", eventId).select("id");
  // An RLS-filtered update touches zero rows without erroring (BUG-011).
  if (error || !data || data.length === 0) return { ok: false, error: "Could not update status." };

  await logAudit({
    actorProfileId: guard.ctx.user.userId,
    eventId,
    action: "bulk_set_team_status",
    entityType: "teams",
    before,
    after: { status, teamIds: (data as { id: string }[]).map((t) => t.id) },
  });

  revalidatePath("/admin/registrations");
  for (const t of data as { id: string }[]) revalidatePath(`/admin/registrations/${t.id}`);
  return { ok: true, updated: data.length };
}

// Every email or phone number of the teams matching the Registrations filter,
// de-duplicated and comma-separated, ready to paste into Gmail's BCC field or
// a WhatsApp broadcast list.
export async function getRegistrationContacts(
  eventId: string,
  q: string,
  status: string,
  kind: "email" | "phone",
): Promise<{ ok: true; text: string; count: number } | { ok: false; error: string }> {
  const guard = await requireStaff(eventId);
  if (!guard.ok) return guard;
  if (kind !== "email" && kind !== "phone") return { ok: false, error: "Invalid request." };

  const filter = parseRegistrationFilter({ q, status });
  const { rows, error } = await loadFilteredMembers(createAdminClient(), eventId, filter);
  if (error) return { ok: false, error: "Couldn't load registrations." };

  const values = new Set<string>();
  for (const m of sortByTeam(rows)) {
    const v = String((kind === "email" ? m.email : m.mobile) ?? "").trim();
    if (v) values.add(v);
  }

  await logAudit({
    actorProfileId: guard.ctx.user.userId,
    eventId,
    action: kind === "email" ? "copy_registration_emails" : "copy_registration_phones",
    entityType: "team_members",
    after: { ...filter, count: values.size },
  });

  return { ok: true, text: [...values].join(", "), count: values.size };
}
