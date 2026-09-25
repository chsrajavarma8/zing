import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Removes uploaded objects that no database row references (RISK-001):
// uploads that were started but never completed, uploads rejected by
// verification and then re-sent with the same signed token (signed upload
// URLs stay valid for up to 2 hours - they are NOT single-use), and files
// left behind when finalization failed. Objects younger than the minimum age
// are kept so in-flight uploads are never touched.
const DEFAULT_MIN_AGE_MINUTES = 180; // > the 2 h signed-upload-URL lifetime

function minAgeMs(): number {
  const configured = Number(process.env.ORPHAN_UPLOAD_MIN_AGE_MINUTES);
  return (Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_MIN_AGE_MINUTES) * 60_000;
}

type Listed = { name: string; id: string | null; created_at: string | null };

async function listAll(bucket: string, prefix: string): Promise<Listed[]> {
  const admin = createAdminClient();
  const out: Listed[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error || !data) break;
    out.push(...(data as Listed[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function cleanupOrphanedUploads(): Promise<{ removed: number; failed: number }> {
  const admin = createAdminClient();
  const cutoff = Date.now() - minAgeMs();
  let removed = 0;
  let failed = 0;

  const isOldFile = (o: Listed) => o.id !== null && o.created_at !== null && Date.parse(o.created_at) < cutoff;
  const removeAll = async (bucket: string, paths: string[]) => {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) failed += batch.length;
      else removed += batch.length;
    }
  };

  // team-submissions/<team>/<round>/<file>
  const { data: subRows, error: subError } = await admin.from("submissions").select("document_storage_path").not("document_storage_path", "is", null);
  if (!subError) {
    const referenced = new Set(((subRows as { document_storage_path: string }[] | null) ?? []).map((r) => r.document_storage_path));
    const orphans: string[] = [];
    for (const team of await listAll("team-submissions", "")) {
      if (team.id !== null) continue; // folders have no id
      for (const round of await listAll("team-submissions", team.name)) {
        if (round.id !== null) continue;
        for (const file of await listAll("team-submissions", `${team.name}/${round.name}`)) {
          const path = `${team.name}/${round.name}/${file.name}`;
          if (isOldFile(file) && !referenced.has(path)) orphans.push(path);
        }
      }
    }
    await removeAll("team-submissions", orphans);
  }

  // documents/<event>/uploads/<file> (direct uploads only; older layouts untouched)
  const { data: docRows, error: docError } = await admin.from("documents").select("storage_path").not("storage_path", "is", null);
  if (!docError) {
    const referenced = new Set(((docRows as { storage_path: string }[] | null) ?? []).map((r) => r.storage_path));
    const orphans: string[] = [];
    for (const event of await listAll("documents", "")) {
      if (event.id !== null) continue;
      for (const file of await listAll("documents", `${event.name}/uploads`)) {
        const path = `${event.name}/uploads/${file.name}`;
        if (isOldFile(file) && !referenced.has(path)) orphans.push(path);
      }
    }
    await removeAll("documents", orphans);
  }

  return { removed, failed };
}
