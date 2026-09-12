"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function issueIdCardsForTeam(teamId: string, eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: members } = await supabase.from("team_members").select("id").eq("team_id", teamId);
  const memberIds = (members as unknown as { id: string }[] | null)?.map((m) => m.id) ?? [];
  if (memberIds.length === 0) return { ok: false, error: "No members found." };

  const { data: existing } = await supabase.from("id_cards").select("team_member_id").in("team_member_id", memberIds);
  const already = new Set(((existing as unknown as { team_member_id: string }[] | null) ?? []).map((e) => e.team_member_id));
  const toCreate = memberIds.filter((id) => !already.has(id));

  if (toCreate.length === 0) return { ok: true, issued: 0 };

  const { error } = await supabase.from("id_cards").insert(toCreate.map((team_member_id) => ({ team_member_id })));
  if (error) return { ok: false, error: "Could not issue ID cards." };

  await logAudit({ actorProfileId: user.id, eventId, action: "issue_id_cards", entityType: "id_cards", entityId: teamId, after: { count: toCreate.length } });
  revalidatePath("/admin/id-cards");
  return { ok: true, issued: toCreate.length };
}

export async function revokeIdCard(teamMemberId: string, eventId: string, revoked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("id_cards").update({ revoked }).eq("team_member_id", teamMemberId);
  if (error) return { ok: false, error: "Could not update." };

  await logAudit({ actorProfileId: user.id, eventId, action: revoked ? "revoke_id_card" : "unrevoke_id_card", entityType: "id_cards", entityId: teamMemberId });
  revalidatePath("/admin/id-cards");
  return { ok: true };
}
