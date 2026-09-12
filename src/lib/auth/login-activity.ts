import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserContext } from "@/lib/auth/session";

export type LoginOutcome = "success" | "invalid_credentials" | "rate_limited";
export type LoginActivityRole = "participant" | "team_lead" | "event_admin" | "reviewer" | "super_admin" | "unknown";

export function resolveLoginActivityRole(ctx: UserContext | null): LoginActivityRole {
  if (!ctx) return "unknown";
  if (ctx.isSuperAdmin) return "super_admin";
  if (ctx.adminEventIds.length > 0) return "event_admin";
  if (ctx.reviewerEventIds.length > 0) return "reviewer";
  if (ctx.teamMemberships.some((m) => m.role === "lead")) return "team_lead";
  if (ctx.teamMemberships.length > 0) return "participant";
  return "unknown";
}

// Fire-and-forget from the caller's perspective: a logging failure must
// never block or fail a sign-in attempt, so this only ever logs internally
// and never throws. Always writes via the service role - there is no client
// insert policy on login_activity (see 0024_login_activity.sql).
export async function recordLoginActivity(entry: {
  attemptedEmail: string;
  profileId?: string | null;
  role?: LoginActivityRole;
  outcome: LoginOutcome;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("login_activity").insert({
      attempted_email: entry.attemptedEmail,
      profile_id: entry.profileId ?? null,
      role: entry.role ?? "unknown",
      outcome: entry.outcome,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    });
  } catch (err) {
    console.error("[login-activity] failed to record entry:", err);
  }
}
