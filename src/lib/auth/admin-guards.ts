import "server-only";
import { getAdminContext, canManage, type AdminContext } from "@/lib/auth/admin";

// Explicit role + event-scope checks for admin server actions (BUG-011).
// Server actions are public POST endpoints: RLS is still the row-level
// boundary underneath, but an RLS-filtered UPDATE/DELETE affects zero rows
// without raising an error, so every action must (1) authorize up front and
// (2) confirm its mutation actually touched a row before reporting success
// or writing an audit entry.

export type Guarded = { ok: true; ctx: AdminContext } | { ok: false; error: string };

const NOT_AUTHORIZED = "You do not have permission to do this.";

function inScope(ctx: AdminContext, eventId: string | undefined): boolean {
  return eventId === undefined || ctx.event.id === eventId;
}

// super_admin or event_admin of this event.
export async function requireManager(eventId?: string): Promise<Guarded> {
  const ctx = await getAdminContext();
  if (!ctx || !canManage(ctx) || !inScope(ctx, eventId)) return { ok: false, error: NOT_AUTHORIZED };
  return { ok: true, ctx };
}

// Any staff role on this event, including reviewers.
export async function requireStaff(eventId?: string): Promise<Guarded> {
  const ctx = await getAdminContext();
  if (!ctx || !inScope(ctx, eventId)) return { ok: false, error: NOT_AUTHORIZED };
  return { ok: true, ctx };
}

export async function requireSuperAdmin(eventId?: string): Promise<Guarded> {
  const ctx = await getAdminContext();
  if (!ctx || ctx.role !== "super_admin" || !inScope(ctx, eventId)) return { ok: false, error: NOT_AUTHORIZED };
  return { ok: true, ctx };
}
