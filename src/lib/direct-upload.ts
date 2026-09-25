"use client";

import { createClient } from "@/lib/supabase/client";

// Browser side of the signed-upload flow (RISK-001): ask the app for a
// single-path signed URL, upload the file straight to Supabase Storage, then
// ask the app to verify and record it. Every step's failure is surfaced.
export async function directUpload(params: {
  bucket: string;
  file: File;
  urlEndpoint: string;
  completeEndpoint: string;
  extra: Record<string, unknown>;
}): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const { bucket, file, urlEndpoint, completeEndpoint, extra } = params;

  const readJson = async (res: Response) => (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const start = await fetch(urlEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...extra, fileName: file.name, fileType: file.type, fileSize: file.size }),
  });
  const startBody = await readJson(start);
  if (!start.ok || typeof startBody.path !== "string" || typeof startBody.token !== "string") {
    return { ok: false, error: (startBody.error as string) ?? "Could not start the upload." };
  }

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(startBody.path, startBody.token, file, { contentType: file.type });
  if (uploadError) return { ok: false, error: "The upload failed. Check your connection and try again." };

  const done = await fetch(completeEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...extra, path: startBody.path, fileName: file.name }),
  });
  const doneBody = await readJson(done);
  if (!done.ok) return { ok: false, error: (doneBody.error as string) ?? "The upload could not be saved." };
  return { ok: true, data: doneBody };
}
