import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Audit log writes always go through the service role - there is no RLS
// insert policy on audit_logs for regular clients by design (see
// 0011_rls.sql), so every write here must originate from trusted server code
// that has already authorized the underlying action via the session client.
export async function logAudit(params: {
  actorProfileId: string;
  eventId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_profile_id: params.actorProfileId,
    event_id: params.eventId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
  });
}
