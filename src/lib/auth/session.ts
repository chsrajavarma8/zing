import { createClient } from "@/lib/supabase/server";

export interface UserContext {
  userId: string;
  email: string;
  fullName: string | null;
  mustChangePassword: boolean;
  isSuperAdmin: boolean;
  adminEventIds: string[];
  reviewerEventIds: string[];
  teamMemberships: { teamId: string; eventId: string; role: "lead" | "member"; verified: boolean }[];
}

export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roles }, { data: eventAdmins }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, must_change_password").eq("id", user.id).maybeSingle(),
    supabase.from("platform_roles").select("role").eq("user_id", user.id),
    supabase.from("event_admins").select("event_id, role").eq("user_id", user.id),
    supabase
      .from("team_members")
      .select("team_id, event_id, role, verification_status")
      .eq("profile_id", user.id),
  ]);

  return {
    userId: user.id,
    email: (profile as { email?: string } | null)?.email ?? user.email ?? "",
    fullName: (profile as { full_name?: string | null } | null)?.full_name ?? null,
    mustChangePassword: Boolean((profile as { must_change_password?: boolean } | null)?.must_change_password),
    isSuperAdmin: Boolean(roles?.some((r) => (r as { role: string }).role === "super_admin")),
    adminEventIds:
      (eventAdmins as { event_id: string; role: string }[] | null)
        ?.filter((r) => r.role === "event_admin")
        .map((r) => r.event_id) ?? [],
    reviewerEventIds:
      (eventAdmins as { event_id: string; role: string }[] | null)
        ?.filter((r) => r.role === "reviewer")
        .map((r) => r.event_id) ?? [],
    teamMemberships:
      (memberships as { team_id: string; event_id: string; role: "lead" | "member"; verification_status: string }[] | null)?.map(
        (m) => ({
          teamId: m.team_id,
          eventId: m.event_id,
          role: m.role,
          verified: m.verification_status === "verified",
        }),
      ) ?? [],
  };
}

export function isStaff(ctx: UserContext | null): boolean {
  if (!ctx) return false;
  return ctx.isSuperAdmin || ctx.adminEventIds.length > 0 || ctx.reviewerEventIds.length > 0;
}

export function defaultLandingPath(ctx: UserContext | null): string {
  if (!ctx) return "/login";
  if (isStaff(ctx)) return "/admin";
  if (ctx.mustChangePassword) return "/change-password";
  return "/portal";
}
