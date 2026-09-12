import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/session";
import type { Team, TeamMember, Event } from "@/types/database";

export interface PortalContext {
  userId: string;
  membership: TeamMember;
  team: Team;
  event: Event;
  teammates: TeamMember[];
}

// A participant may only ever belong to one team per event (unique email per
// event), but could in theory be registered across multiple events. The
// portal focuses on their most recently created membership - good enough for
// a single-tenant deployment, and each event's team gets its own row here if
// this is ever pointed at a multi-event install.
export async function getPortalContext(): Promise<PortalContext | null> {
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
    supabase.from("teams").select("*").eq("id", m.team_id).maybeSingle(),
    supabase.from("team_members").select("*").eq("team_id", m.team_id).order("role", { ascending: false }),
  ]);

  if (!team) return null;
  const t = team as unknown as Team;

  const { data: event } = await supabase.from("events").select("*").eq("id", t.event_id).maybeSingle();
  if (!event) return null;

  return {
    userId: ctx.userId,
    membership: m,
    team: t,
    event: event as unknown as Event,
    teammates: (teammates as unknown as TeamMember[] | null) ?? [],
  };
}
