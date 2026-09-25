import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectKind, type AllowedType } from "@/lib/uploads";

// Verifies an object the browser uploaded directly to Storage with a signed
// upload URL (RISK-001) before the app records it: the stored size must be
// within the limit, and the stored content type must be allowed AND match the
// file's actual leading bytes (RISK-008). Anything that fails is deleted.
export type VerifyResult =
  | { ok: true; size: number; mime: string }
  | { ok: false; error: string };

async function readLeadingBytes(bucket: string, path: string, count: number): Promise<Uint8Array | null> {
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !signed) return null;
  // Only the first bytes are needed. Abort the request once they've arrived
  // (awaiting reader.cancel() can stall on an unconsumed body), and never
  // wait longer than 10 s in total.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    const res = await fetch(signed.signedUrl, { headers: { Range: `bytes=0-${count - 1}` }, signal: controller.signal });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    while (total < count) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
  } catch {
    if (total === 0) return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  const out = new Uint8Array(Math.min(total, count));
  let offset = 0;
  for (const c of chunks) {
    const take = Math.min(c.length, out.length - offset);
    out.set(c.subarray(0, take), offset);
    offset += take;
    if (offset >= out.length) break;
  }
  return out;
}

export async function verifyStoredUpload(params: {
  bucket: string;
  path: string;
  allowed: AllowedType[];
  maxBytes: number;
}): Promise<VerifyResult> {
  const admin = createAdminClient();
  const reject = async (error: string): Promise<VerifyResult> => {
    await admin.storage.from(params.bucket).remove([params.path]);
    return { ok: false, error };
  };

  const { data: info, error } = await admin.storage.from(params.bucket).info(params.path);
  if (error || !info) return { ok: false, error: "The uploaded file could not be found. Please upload it again." };

  const size = info.size ?? 0;
  const mime = info.contentType ?? "";
  if (size <= 0) return reject("The uploaded file is empty.");
  if (size > params.maxBytes) return reject(`The file is larger than ${Math.round(params.maxBytes / (1024 * 1024))} MB.`);

  const type = params.allowed.find((t) => t.mime === mime);
  if (!type) return reject("This file type isn't accepted.");

  const bytes = await readLeadingBytes(params.bucket, params.path, 16);
  if (!bytes) return { ok: false, error: "The uploaded file could not be checked. Please try again." };
  if (detectKind(bytes) !== type.kind) {
    return reject("The file's contents don't match its type. Upload a genuine file of the accepted formats.");
  }

  return { ok: true, size, mime };
}
