"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function deleteDocument(documentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: doc } = await supabase.from("documents").select("event_id, storage_path").eq("id", documentId).maybeSingle();
  const docRow = doc as unknown as { event_id: string; storage_path: string | null } | null;

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) return { ok: false, error: "Could not delete." };

  if (docRow?.storage_path) {
    const admin = createAdminClient();
    await admin.storage.from("documents").remove([docRow.storage_path]);
  }

  if (docRow) {
    await logAudit({ actorProfileId: user.id, eventId: docRow.event_id, action: "delete_document", entityType: "documents", entityId: documentId });
  }

  revalidatePath("/admin/documents");
  return { ok: true };
}
