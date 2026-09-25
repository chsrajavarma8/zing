import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePasswordChanged } from "@/lib/auth/guards";
import { submissionUnavailableReason } from "@/lib/rounds";

// Authorization for service-role submission file operations (upload URL
// issuance and upload completion). These routes bypass RLS, so they re-check
// the same boundary the database enforces for direct writes: the caller is
// the team's lead or its delegated submitter, the round belongs to the same
// event as the team, and the round's submission window is open.
export type SubmissionAccess =
  | { ok: true; userId: string; teamId: string; roundId: string }
  | { ok: false; status: number; error: string };

export async function authorizeSubmissionFileAccess(teamId: unknown, roundId: unknown): Promise<SubmissionAccess> {
  if (typeof teamId !== "string" || typeof roundId !== "string" || !teamId || !roundId) {
    return { ok: false, status: 400, error: "Missing team or round." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not signed in." };

  const guard = await requirePasswordChanged(supabase);
  if (!guard.ok) return { ok: false, status: 403, error: guard.error };

  const admin = createAdminClient();
  const [{ data: member }, { data: team }, { data: round }] = await Promise.all([
    admin.from("team_members").select("id, role").eq("profile_id", user.id).eq("team_id", teamId).maybeSingle(),
    admin.from("teams").select("id, event_id, submission_delegate_member_id").eq("id", teamId).maybeSingle(),
    admin.from("rounds").select("id, event_id, is_active, starts_at, ends_at").eq("id", roundId).maybeSingle(),
  ]);

  const m = member as { id: string; role: string } | null;
  const t = team as { id: string; event_id: string; submission_delegate_member_id: string | null } | null;
  const r = round as { id: string; event_id: string; is_active: boolean; starts_at: string | null; ends_at: string | null } | null;

  if (!m || !t) return { ok: false, status: 403, error: "You are not a member of this team." };
  if (m.role !== "lead" && t.submission_delegate_member_id !== m.id) {
    return { ok: false, status: 403, error: "Only the team lead or the delegated member can submit for this team." };
  }
  if (!r || r.event_id !== t.event_id) return { ok: false, status: 404, error: "Round not found." };

  const unavailable = submissionUnavailableReason(r);
  if (unavailable) return { ok: false, status: 403, error: unavailable };

  return { ok: true, userId: user.id, teamId, roundId };
}
