import { getUserContext, type UserContext } from "@/lib/auth/session";
import { getPublicEvent } from "@/lib/events";
import type { Event } from "@/types/database";

export interface AdminContext {
  user: UserContext;
  event: Event;
  role: "super_admin" | "event_admin" | "reviewer";
}

// Single-tenant admin scoping: the admin panel manages the one is_default
// event. A user must be a super admin, or an event_admin/reviewer on that
// specific event, to get anything back here - every admin page must call
// this and treat `null` as "show an access-denied state", never render
// admin data based on client-side role checks alone.
export async function getAdminContext(): Promise<AdminContext | null> {
  const user = await getUserContext();
  if (!user) return null;

  const event = await getPublicEvent();
  if (!event) return null;

  if (user.isSuperAdmin) return { user, event, role: "super_admin" };
  if (user.adminEventIds.includes(event.id)) return { user, event, role: "event_admin" };
  if (user.reviewerEventIds.includes(event.id)) return { user, event, role: "reviewer" };

  return null;
}

export function canManage(ctx: AdminContext): boolean {
  return ctx.role === "super_admin" || ctx.role === "event_admin";
}
