import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/session";
import type { Team, TeamMember, Event, RosterMember } from "@/types/database";

export interface PortalContext {
  userId: string;
  membership: TeamMember;
  team: Team;
  event: Event;
  // Display-only roster (team_roster view): teammates' DOB, gender, phone
  // numbers and roll numbers are never exposed to other participants (BUG-016).
  teammates: RosterMember[];
}

// A participant may only ever belong to one team per event (unique email per
// event), but could in theory be registered across multiple events. The
// portal focuses on their most recently created membership - good enough for
// a single-tenant deployment, and each event's team gets its own row here if
// this is ever pointed at a multi-event install.
//
// Request-scoped memoization (RISK-004): the portal layout and every portal
// page call this; cache() dedupes it within one server request only.
export const getPortalContext = cache(async function getPortalContext(): Promise<PortalContext | null> {
  const ctx = await getUserContext();
  if (!ctx || ctx.teamMemberships.length === 0) return null;

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("team_members")
    .select("*")
    .eq("profile_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;
  const m = membership as unknown as TeamMember;

  const [{ data: team }, { data: teammates }] = await Promise.all([
    supabase.from("teams").select("*, events(*)").eq("id", m.team_id).maybeSingle(),
    supabase.from("team_roster").select("*").eq("team_id", m.team_id).order("role", { ascending: true }),
  ]);

  if (!team) return null;
  const { events: event, ...t } = team as unknown as Team & { events: Event | null };
  if (!event) return null;

  return {
    userId: ctx.userId,
    membership: m,
    team: t as Team,
    event,
    teammates: (teammates as unknown as RosterMember[] | null) ?? [],
  };
});
