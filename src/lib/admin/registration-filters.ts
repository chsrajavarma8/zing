import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by the Registrations list, its CSV exports and the copy-contacts
// action, so "what the admin is looking at" and "what gets exported/copied"
// always mean the same set of teams.

export const TEAM_STATUSES = ["pending", "verified", "disqualified"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export interface RegistrationFilter {
  q: string;
  status: TeamStatus | "all";
}

export function parseRegistrationFilter(raw: { q?: unknown; status?: unknown }): RegistrationFilter {
  const q = (typeof raw.q === "string" ? raw.q.trim() : "").slice(0, 100);
  const status = TEAM_STATUSES.includes(raw.status as TeamStatus) ? (raw.status as TeamStatus) : "all";
  return { q, status };
}

// The search term is embedded in a PostgREST or() filter string, where
// commas, parentheses, quotes and backslashes are syntax, and in an ilike
// pattern, where % and * are wildcards. Strip them rather than escape: none
// of them matter for finding a team, person, email or phone number.
function searchPattern(q: string): string | null {
  const term = q.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
  return term ? `%${term}%` : null;
}

// Team ids whose team name / team reference, or any member's name, email,
// phone or participant reference, contains the search term. null means "no
// search term" (every team matches).
export async function matchingTeamIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  eventId: string,
  q: string,
): Promise<{ ids: string[] | null; error: boolean }> {
  const p = searchPattern(q);
  if (!p) return { ids: null, error: false };

  const [teams, members] = await Promise.all([
    supabase.from("teams").select("id").eq("event_id", eventId).or(`team_name.ilike.${p},reference_id.ilike.${p}`),
    supabase
      .from("team_members")
      .select("team_id")
      .eq("event_id", eventId)
      .or(`full_name.ilike.${p},email.ilike.${p},mobile.ilike.${p},whatsapp.ilike.${p},reference_id.ilike.${p}`),
  ]);
  if (teams.error || members.error) {
    console.error("[registration-filters] search failed:", teams.error?.message ?? members.error?.message);
    return { ids: null, error: true };
  }

  const ids = new Set<string>();
  for (const t of (teams.data as { id: string }[] | null) ?? []) ids.add(t.id);
  for (const m of (members.data as { team_id: string }[] | null) ?? []) ids.add(m.team_id);
  return { ids: [...ids], error: false };
}

// PostgREST caps a single response (1000 rows by default), so page through
// until a short page comes back or large events get silently truncated.
const FETCH_PAGE = 1000;
// Keeps the `team_id=in.(...)` query string well under URL length limits.
const ID_CHUNK = 200;

export type MemberRow = Record<string, unknown> & {
  teams: { team_name?: string; reference_id?: string; status?: string } | null;
};

// Every team member (with their team) of the teams matching the filter.
export async function loadFilteredMembers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  eventId: string,
  filter: RegistrationFilter,
): Promise<{ rows: MemberRow[]; error: boolean }> {
  const search = await matchingTeamIds(supabase, eventId, filter.q);
  if (search.error) return { rows: [], error: true };
  if (search.ids && search.ids.length === 0) return { rows: [], error: false };

  const idChunks: (string[] | null)[] = [];
  if (search.ids) for (let i = 0; i < search.ids.length; i += ID_CHUNK) idChunks.push(search.ids.slice(i, i + ID_CHUNK));
  else idChunks.push(null);

  const rows: MemberRow[] = [];
  for (const ids of idChunks) {
    for (let from = 0; ; from += FETCH_PAGE) {
      let query = supabase
        .from("team_members")
        // teams <-> team_members has two relationships (team_members.team_id and
        // teams.submission_delegate_member_id, 0022), so the embed must name the
        // FK or PostgREST rejects it as ambiguous (PGRST201).
        .select("*, teams!team_members_team_id_fkey!inner(team_name, reference_id, status)")
        .eq("event_id", eventId);
      if (filter.status !== "all") query = query.eq("teams.status", filter.status);
      if (ids) query = query.in("team_id", ids);
      const { data, error } = await query
        .order("created_at")
        .order("id")
        .range(from, from + FETCH_PAGE - 1);
      if (error) {
        console.error("[registration-filters] failed to load members:", error.code, error.message);
        return { rows: [], error: true };
      }
      const page = (data as MemberRow[] | null) ?? [];
      rows.push(...page);
      if (page.length < FETCH_PAGE) break;
    }
  }
  return { rows, error: false };
}

export function teamNameOf(m: MemberRow): string {
  return m.teams?.team_name ?? "";
}

// Members of the same team together, the team lead first within a team.
export function sortByTeam(rows: MemberRow[]): MemberRow[] {
  return rows.sort(
    (a, b) => teamNameOf(a).localeCompare(teamNameOf(b)) || Number(b.role === "lead") - Number(a.role === "lead"),
  );
}
