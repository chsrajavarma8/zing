"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/admin-guards";
import { revalidatePath } from "next/cache";

export async function deleteDocument(documentId: string) {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const eventId = guard.ctx.event.id;

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("event_id", eventId)
    .select("id, storage_path");
  if (error || !deleted || deleted.length !== 1) return { ok: false, error: "Could not delete this document." };

  const storagePath = (deleted[0] as { storage_path: string | null }).storage_path;
  if (storagePath) {
    const admin = createAdminClient();
    const { error: removeError } = await admin.storage.from("documents").remove([storagePath]);
    if (removeError) console.error("[deleteDocument] record deleted but file removal failed:", storagePath, removeError.message);
  }

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "delete_document", entityType: "documents", entityId: documentId });
  revalidatePath("/admin/documents");
  return { ok: true };
}
