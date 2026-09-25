"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/admin-guards";
import { revalidatePath } from "next/cache";

export async function issueIdCardsForTeam(teamId: string, eventId: string) {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data: members, error: membersError } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("event_id", eventId);
  if (membersError) return { ok: false, error: "Could not load team members." };
  const memberIds = (members as unknown as { id: string }[] | null)?.map((m) => m.id) ?? [];
  if (memberIds.length === 0) return { ok: false, error: "No members found." };

  const { data: existing } = await supabase.from("id_cards").select("team_member_id").in("team_member_id", memberIds);
  const already = new Set(((existing as unknown as { team_member_id: string }[] | null) ?? []).map((e) => e.team_member_id));
  const toCreate = memberIds.filter((id) => !already.has(id));

  if (toCreate.length === 0) return { ok: true, issued: 0 };

  const { data: inserted, error } = await supabase
    .from("id_cards")
    .insert(toCreate.map((team_member_id) => ({ team_member_id })))
    .select("id");
  if (error || !inserted || inserted.length !== toCreate.length) return { ok: false, error: "Could not issue ID cards." };

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "issue_id_cards", entityType: "id_cards", entityId: teamId, after: { count: toCreate.length } });
  revalidatePath("/admin/id-cards");
  return { ok: true, issued: toCreate.length };
}

export async function revokeIdCard(teamMemberId: string, eventId: string, revoked: boolean) {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data: member } = await supabase.from("team_members").select("id").eq("id", teamMemberId).eq("event_id", eventId).maybeSingle();
  if (!member) return { ok: false, error: "Participant not found." };

  const { data, error } = await supabase.from("id_cards").update({ revoked: Boolean(revoked) }).eq("team_member_id", teamMemberId).select("id");
  if (error || !data || data.length !== 1) return { ok: false, error: "Could not update this ID card." };

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: revoked ? "revoke_id_card" : "unrevoke_id_card", entityType: "id_cards", entityId: teamMemberId });
  revalidatePath("/admin/id-cards");
  return { ok: true };
}
